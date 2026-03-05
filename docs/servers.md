# Server Classes

The library provides 6 long-lived server classes that wrap DCMTK server binaries, plus `DicomReceiver` — a pooled receiver that manages multiple `Dcmrecv` workers behind a single TCP port. Each server manages a child process with typed event listeners, graceful shutdown, and AbortSignal support.

## Common Pattern

All servers follow the same lifecycle:

```typescript
// 1. Create with validated options (returns Result)
const result = ServerClass.create(options);
if (!result.ok) {
    /* handle error */
}
const server = result.value;

// 2. Listen for typed events
server.onEvent('EVENT_NAME', data => {
    /* ... */
});

// 3. Start the server
await server.start();

// 4. Stop gracefully
await server.stop();
```

### DcmtkProcess Base Class

All servers extend `DcmtkProcess`, which provides:

- **Typed EventEmitter** — `onEvent()` for strongly-typed event listeners
- **Disposable** — `Symbol.dispose` / `Symbol.asyncDispose` for `using` statements
- **AbortSignal** — pass `signal` in create options to externally abort
- **Process state** — `ProcessState.IDLE | STARTING | RUNNING | STOPPING | STOPPED | ERRORED`

### Single-Threaded Association Model

**All DCMTK server binaries are single-threaded and handle one association at a time.** When multiple clients connect concurrently, connections queue at the TCP level — the server processes them strictly sequentially:

```
ASSOCIATION_RECEIVED   (sender 1)
STORED_FILE            (sender 1)
STORED_FILE            (sender 1)
ASSOCIATION_RELEASE    (sender 1)
ASSOCIATION_RECEIVED   (sender 2)   ← can't start until sender 1 completes
STORED_FILE            (sender 2)
ASSOCIATION_RELEASE    (sender 2)
```

Associations **never interleave** — there is no scenario where files from different associations are mixed together in the output stream. This is a property of the underlying DCMTK C++ binaries, not something enforced by this library.

### Association Tracking

`Dcmrecv` and `StoreSCP` include a built-in `AssociationTracker` that automatically correlates received files to their association. Two high-level events provide all the context you need:

| Event                  | Data                                                                   | Description                                      |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| `FILE_RECEIVED`        | `{ filePath, associationId, callingAE, calledAE, source }`             | Each file enriched with association context      |
| `ASSOCIATION_COMPLETE` | `{ associationId, callingAE, calledAE, files, durationMs, endReason }` | Summary when association ends (release or abort) |

```typescript
server.onFileReceived(data => {
    console.log(`${data.associationId}: ${data.filePath} from ${data.callingAE}`);
});

server.onAssociationComplete(summary => {
    console.log(`${summary.associationId}: ${summary.files.length} files in ${summary.durationMs}ms`);
});
```

The tracker assigns synthetic IDs (`assoc-1`, `assoc-2`, ...) since DCMTK's output does not include native association identifiers. These IDs are consistent within a server's lifetime.

> **Note:** `storescp` does not include calling/called AE titles in its verbose output, so `callingAE` and `calledAE` will be empty strings. Use `dcmrecv` if you need sender identification by AE title.

---

## DicomReceiver

Pooled DICOM receiver with auto-scaling. Manages multiple long-lived `Dcmrecv` workers behind a single TCP proxy port. Incoming connections are routed to idle workers automatically, and workers are reused across associations without restart.

**DicomReceiver does NOT extend DcmtkProcess** — it extends `EventEmitter` directly because it manages multiple processes plus a TCP server.

### Architecture

```
Remote SCU ──TCP──► DicomReceiver (:4242)
                    ┌─ TCP Proxy ─────────────┐
                    │  route to idle worker    │
                    └───┬─────────┬────────────┘
                        │         │
                     Dcmrecv   Dcmrecv
                     :50001    :50002 ...
                     (busy)    (idle)
```

### Options

| Option                | Type          | Default     | Description                                                                    |
| --------------------- | ------------- | ----------- | ------------------------------------------------------------------------------ |
| `port`                | `number`      | —           | **Required.** External listening port (0 = no TCP proxy, use `handleSocket()`) |
| `storageDir`          | `string`      | —           | **Required.** Root dir for association dirs                                    |
| `aeTitle`             | `string`      | `'DCMRECV'` | AE Title for workers                                                           |
| `minPoolSize`         | `number`      | `2`         | Minimum idle workers to maintain                                               |
| `maxPoolSize`         | `number`      | `10`        | Maximum total workers                                                          |
| `connectionTimeoutMs` | `number`      | `10000`     | Timeout waiting for idle worker                                                |
| `configFile`          | `string`      | —           | Config file passed to dcmrecv workers                                          |
| `configProfile`       | `string`      | —           | Config profile name                                                            |
| `acseTimeout`         | `number`      | —           | ACSE timeout in seconds (passed to workers)                                    |
| `dimseTimeout`        | `number`      | —           | DIMSE timeout in seconds (passed to workers)                                   |
| `maxPdu`              | `number`      | —           | Maximum PDU receive size (4096–131072)                                         |
| `signal`              | `AbortSignal` | —           | External cancellation                                                          |

### Events

| Event                  | Data                                                                                                                                               | Description                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `FILE_RECEIVED`        | `{ filePath, associationId, associationDir, callingAE, calledAE, source, instance }`                                                               | File moved to association dir; `instance` is a parsed `DicomInstance` |
| `ASSOCIATION_COMPLETE` | `{ associationId, associationDir, callingAE, calledAE, source, files, durationMs, endReason, totalBytes, bytesPerSecond, startAt, endAt, output }` | Association ended; includes transfer stats and captured output        |
| `ASSOCIATION_RECEIVED` | `{ associationId, callingAE, calledAE, source }`                                                                                                   | New association received by a worker                                  |
| `C_STORE_REQUEST`      | `{ associationId, raw }`                                                                                                                           | C-STORE request received (per-file progress)                          |
| `ECHO_REQUEST`         | `{ associationId }`                                                                                                                                | C-ECHO request received                                               |
| `REFUSING_ASSOCIATION` | `{ reason }`                                                                                                                                       | Worker refused an association                                         |
| `error`                | `{ error, filePath?, associationId?, associationDir?, callingAE?, calledAE?, source? }`                                                            | Error with optional file/association context                          |

### Worker Lifecycle

- Workers are **started once** and **reused across many associations**
- After an association completes, the worker returns to the idle pool — no restart needed
- Scale-up: after routing a connection, if idle < `minPoolSize` and total < `maxPoolSize`, new workers are spawned
- Scale-down: after a worker becomes idle, if idle > `minPoolSize + 2`, excess workers are stopped

### File Storage

```
storageDir/
├── assoc-1/           ← created when connection is routed
│   ├── file1.dcm      ← moved from worker temp dir
│   └── file2.dcm
├── assoc-2/
│   └── file1.dcm
└── ...                ← user responsible for cleanup
```

### Example

```typescript
import { DicomReceiver } from '@ubercode/dcmtk';

const result = DicomReceiver.create({
    port: 4242,
    storageDir: '/data/received',
    minPoolSize: 2,
    maxPoolSize: 8,
    acseTimeout: 30,
    maxPdu: 65536,
});
if (!result.ok) {
    console.error(result.error.message);
    return;
}
const receiver = result.value;

receiver.onFileReceived(data => {
    console.log(`File: ${data.filePath} (patient: ${data.instance.patientName})`);
});

receiver.onAssociationComplete(data => {
    const mbPerSec = data.bytesPerSecond > 0 ? (data.bytesPerSecond / 1_048_576).toFixed(1) : '0';
    console.log(`Done: ${data.files.length} files, ${data.totalBytes} bytes, ${mbPerSec} MB/s`);
    console.log(`Output lines: ${data.output.length}`);
});

receiver.onAssociationReceived(data => {
    console.log(`Association from ${data.callingAE} (${data.source})`);
});

await receiver.start();
// ... connections are automatically load-balanced across workers
await receiver.stop();
```

#### External Socket Mode (`handleSocket`)

When managing your own TCP listener (e.g., a protocol router), use `handleSocket()` to route sockets directly:

```typescript
const result = DicomReceiver.create({
    port: 0, // no built-in TCP proxy
    storageDir: '/data/received',
});
if (!result.ok) return;
const receiver = result.value;

await receiver.start();

// Route sockets from your own listener
myServer.on('connection', socket => {
    if (isDicomConnection(socket)) {
        receiver.handleSocket(socket);
    }
});
```

---

## Dcmrecv

DICOM receiver (C-STORE SCP) using the `dcmrecv` binary. Receives and stores incoming DICOM files.

### Options

| Option             | Type                    | Default     | Description                       |
| ------------------ | ----------------------- | ----------- | --------------------------------- |
| `port`             | `number`                | —           | **Required.** Listening port      |
| `outputDirectory`  | `string`                | —           | Directory to store received files |
| `aeTitle`          | `string`                | —           | AE Title for this SCP             |
| `subdirectoryMode` | `SubdirectoryModeValue` | `'none'`    | Subdirectory creation mode        |
| `filenameMode`     | `FilenameModeValue`     | `'default'` | Filename generation mode          |
| `storageMode`      | `StorageModeValue`      | `'normal'`  | How to handle incoming data       |
| `startTimeoutMs`   | `number`                | —           | Timeout for server startup        |
| `drainTimeoutMs`   | `number`                | —           | Timeout for graceful shutdown     |
| `signal`           | `AbortSignal`           | —           | External cancellation             |

### Events

| Event                      | Data                                             | Description                   |
| -------------------------- | ------------------------------------------------ | ----------------------------- |
| `ASSOCIATION_RECEIVED`     | `{ callingAETitle, calledAETitle, peerAddress }` | New association request       |
| `ASSOCIATION_ACKNOWLEDGED` | `{ maxSendPDV }`                                 | Association accepted          |
| `C_STORE_REQUEST`          | `{ sopClassUID }`                                | Incoming storage request      |
| `STORED_FILE`              | `{ filename }`                                   | File successfully written     |
| `ASSOCIATION_RELEASE`      | —                                                | Association released normally |
| `ASSOCIATION_ABORTED`      | —                                                | Association aborted           |
| `ECHO_REQUEST`             | —                                                | C-ECHO verification request   |
| `REFUSING_ASSOCIATION`     | `{ reason }`                                     | Association refused           |
| `CANNOT_START_LISTENER`    | `{ message }`                                    | Fatal: failed to bind port    |
| `LISTENING`                | —                                                | Server ready for connections  |

### Example

```typescript
import { Dcmrecv } from '@ubercode/dcmtk';

const result = Dcmrecv.create({
    port: 4242,
    outputDirectory: './incoming',
    aeTitle: 'MY_SCP',
});

if (result.ok) {
    const server = result.value;

    server.onEvent('C_STORE_REQUEST', data => {
        console.log(`Receiving: ${data.sopClassUID}`);
    });

    server.onEvent('STORED_FILE', data => {
        console.log(`Saved: ${data.filename}`);
    });

    await server.start();
}
```

---

## StoreSCP

Advanced storage SCP using the `storescp` binary. Offers more configuration than Dcmrecv including config file support and transfer syntax negotiation.

### Options

| Option                    | Type                           | Default | Description                       |
| ------------------------- | ------------------------------ | ------- | --------------------------------- |
| `port`                    | `number`                       | —       | **Required.** Listening port      |
| `aeTitle`                 | `string`                       | —       | AE Title for this SCP             |
| `outputDirectory`         | `string`                       | —       | Directory to store received files |
| `configFile`              | `string`                       | —       | Path to storescp config file      |
| `configProfile`           | `string`                       | —       | Config profile name               |
| `preferredTransferSyntax` | `PreferredTransferSyntaxValue` | —       | Preferred transfer syntax         |
| `sortByStudy`             | `boolean`                      | —       | Sort files by study date          |
| `sortByStudyInstanceUID`  | `boolean`                      | —       | Sort files by Study Instance UID  |
| `startTimeoutMs`          | `number`                       | —       | Timeout for server startup        |
| `drainTimeoutMs`          | `number`                       | —       | Timeout for graceful shutdown     |
| `signal`                  | `AbortSignal`                  | —       | External cancellation             |

### Events

| Event                      | Data                                             | Description                      |
| -------------------------- | ------------------------------------------------ | -------------------------------- |
| `ASSOCIATION_RECEIVED`     | `{ callingAETitle, calledAETitle, peerAddress }` | New association request          |
| `ASSOCIATION_ACKNOWLEDGED` | `{ maxSendPDV }`                                 | Association accepted             |
| `C_STORE_REQUEST`          | `{ sopClassUID }`                                | Incoming storage request         |
| `STORED_FILE`              | `{ filename }`                                   | File successfully written        |
| `STORING_FILE`             | `{ filename }`                                   | File being written (in progress) |
| `SUBDIRECTORY_CREATED`     | `{ directory }`                                  | New subdirectory created         |
| `ASSOCIATION_RELEASE`      | —                                                | Association released normally    |
| `ASSOCIATION_ABORTED`      | —                                                | Association aborted              |
| `ECHO_REQUEST`             | —                                                | C-ECHO verification request      |
| `REFUSING_ASSOCIATION`     | `{ reason }`                                     | Association refused              |
| `CANNOT_START_LISTENER`    | `{ message }`                                    | Fatal: failed to bind port       |
| `LISTENING`                | —                                                | Server ready for connections     |

### Example

```typescript
import { StoreSCP } from '@ubercode/dcmtk';

const result = StoreSCP.create({
    port: 11112,
    outputDirectory: './received',
    aeTitle: 'STORE_SCP',
    sortByStudyInstanceUID: true,
});

if (result.ok) {
    const scp = result.value;

    scp.onEvent('STORING_FILE', data => {
        console.log(`Storing: ${data.filename}`);
    });

    await scp.start();
}
```

---

## DcmQRSCP

DICOM Query/Retrieve SCP using the `dcmqrscp` binary. Provides C-FIND, C-MOVE, and C-GET services backed by a DICOM database.

### Options

| Option           | Type          | Default | Description                                |
| ---------------- | ------------- | ------- | ------------------------------------------ |
| `configFile`     | `string`      | —       | **Required.** Path to dcmqrscp config file |
| `port`           | `number`      | —       | Listening port                             |
| `singleProcess`  | `boolean`     | —       | Run in single-process mode                 |
| `checkFind`      | `boolean`     | —       | Enable C-FIND support checking             |
| `checkMove`      | `boolean`     | —       | Enable C-MOVE support checking             |
| `disableGet`     | `boolean`     | —       | Disable C-GET support                      |
| `maxPdu`         | `number`      | —       | Maximum PDU size                           |
| `acseTimeout`    | `number`      | —       | ACSE timeout in seconds                    |
| `dimseTimeout`   | `number`      | —       | DIMSE timeout in seconds                   |
| `verbose`        | `boolean`     | `true`  | Enable verbose output                      |
| `startTimeoutMs` | `number`      | —       | Timeout for server startup                 |
| `drainTimeoutMs` | `number`      | —       | Timeout for graceful shutdown              |
| `signal`         | `AbortSignal` | —       | External cancellation                      |

### Events

| Event                      | Data             | Description                   |
| -------------------------- | ---------------- | ----------------------------- |
| `LISTENING`                | `{ port }`       | Server ready for connections  |
| `ASSOCIATION_RECEIVED`     | `{ peerInfo }`   | New association request       |
| `ASSOCIATION_ACKNOWLEDGED` | `{ maxSendPDV }` | Association accepted          |
| `C_FIND_REQUEST`           | `{ raw }`        | Incoming C-FIND query         |
| `C_MOVE_REQUEST`           | `{ raw }`        | Incoming C-MOVE request       |
| `C_GET_REQUEST`            | `{ raw }`        | Incoming C-GET request        |
| `C_STORE_REQUEST`          | `{ raw }`        | Incoming C-STORE request      |
| `ASSOCIATION_RELEASE`      | —                | Association released normally |
| `ASSOCIATION_ABORTED`      | —                | Association aborted           |
| `CANNOT_START_LISTENER`    | `{ message }`    | Fatal: failed to bind port    |

### Example

```typescript
import { DcmQRSCP } from '@ubercode/dcmtk';

const result = DcmQRSCP.create({
    configFile: '/etc/dcmtk/dcmqrscp.cfg',
    port: 4242,
    singleProcess: true,
});

if (result.ok) {
    const qr = result.value;

    qr.onEvent('C_FIND_REQUEST', data => {
        console.log('Query received:', data.raw);
    });

    qr.onEvent('C_MOVE_REQUEST', data => {
        console.log('Move request:', data.raw);
    });

    await qr.start();
}
```

---

## Wlmscpfs

DICOM Worklist Management SCP using the `wlmscpfs` binary. Serves worklist items from the filesystem.

### Options

| Option                | Type          | Default | Description                                       |
| --------------------- | ------------- | ------- | ------------------------------------------------- |
| `port`                | `number`      | —       | **Required.** Listening port                      |
| `worklistDirectory`   | `string`      | —       | **Required.** Directory containing worklist files |
| `enableFileRejection` | `boolean`     | `true`  | Reject invalid worklist files                     |
| `maxPdu`              | `number`      | —       | Maximum PDU size                                  |
| `acseTimeout`         | `number`      | —       | ACSE timeout in seconds                           |
| `dimseTimeout`        | `number`      | —       | DIMSE timeout in seconds                          |
| `maxAssociations`     | `number`      | —       | Max concurrent associations                       |
| `verbose`             | `boolean`     | `true`  | Enable verbose output                             |
| `startTimeoutMs`      | `number`      | —       | Timeout for server startup                        |
| `drainTimeoutMs`      | `number`      | —       | Timeout for graceful shutdown                     |
| `signal`              | `AbortSignal` | —       | External cancellation                             |

### Events

| Event                      | Data             | Description                    |
| -------------------------- | ---------------- | ------------------------------ |
| `LISTENING`                | `{ port }`       | Server ready for connections   |
| `ASSOCIATION_RECEIVED`     | `{ peerInfo }`   | New association request        |
| `ASSOCIATION_ACKNOWLEDGED` | `{ maxSendPDV }` | Association accepted           |
| `C_FIND_REQUEST`           | `{ raw }`        | Incoming worklist C-FIND query |
| `ASSOCIATION_RELEASE`      | —                | Association released normally  |
| `ASSOCIATION_ABORTED`      | —                | Association aborted            |
| `ECHO_REQUEST`             | —                | C-ECHO verification request    |
| `CANNOT_START_LISTENER`    | `{ message }`    | Fatal: failed to bind port     |

### Example

```typescript
import { Wlmscpfs } from '@ubercode/dcmtk';

const result = Wlmscpfs.create({
    port: 4243,
    worklistDirectory: './worklist-data',
});

if (result.ok) {
    const wlm = result.value;

    wlm.onEvent('C_FIND_REQUEST', data => {
        console.log('Worklist query:', data.raw);
    });

    await wlm.start();
}
```

---

## DcmprsCP

Print Management SCP using the `dcmprscp` binary. Manages DICOM print jobs via a configuration file.

### Options

| Option           | Type          | Default | Description                                    |
| ---------------- | ------------- | ------- | ---------------------------------------------- |
| `configFile`     | `string`      | —       | **Required.** Path to dcmpstat.cfg config file |
| `printer`        | `string`      | —       | Printer name from config                       |
| `dump`           | `boolean`     | —       | Dump print job details                         |
| `logLevel`       | `string`      | —       | Log level (fatal/error/warn/info/debug/trace)  |
| `logConfig`      | `string`      | —       | Path to log config file                        |
| `startTimeoutMs` | `number`      | —       | Timeout for server startup                     |
| `drainTimeoutMs` | `number`      | —       | Timeout for graceful shutdown                  |
| `signal`         | `AbortSignal` | —       | External cancellation                          |

### Events

| Event                      | Data             | Description                   |
| -------------------------- | ---------------- | ----------------------------- |
| `DATABASE_READY`           | `{ directory }`  | Database initialized          |
| `ASSOCIATION_RECEIVED`     | `{ peerInfo }`   | New association request       |
| `ASSOCIATION_ACKNOWLEDGED` | `{ maxSendPDV }` | Association accepted          |
| `ASSOCIATION_RELEASE`      | —                | Association released normally |
| `ASSOCIATION_ABORTED`      | —                | Association aborted           |
| `CANNOT_START_LISTENER`    | `{ message }`    | Fatal: failed to bind port    |
| `CONFIG_ERROR`             | `{ message }`    | Fatal: configuration error    |

---

## Dcmpsrcv

Viewer network receiver using the `dcmpsrcv` binary. Receives DICOM objects for a presentation state viewer.

### Options

| Option           | Type          | Default | Description                                    |
| ---------------- | ------------- | ------- | ---------------------------------------------- |
| `configFile`     | `string`      | —       | **Required.** Path to dcmpstat.cfg config file |
| `receiverId`     | `string`      | —       | Receiver identifier                            |
| `logLevel`       | `string`      | —       | Log level (fatal/error/warn/info/debug/trace)  |
| `logConfig`      | `string`      | —       | Path to log config file                        |
| `startTimeoutMs` | `number`      | —       | Timeout for server startup                     |
| `drainTimeoutMs` | `number`      | —       | Timeout for graceful shutdown                  |
| `signal`         | `AbortSignal` | —       | External cancellation                          |

### Events

| Event                      | Data                   | Description                   |
| -------------------------- | ---------------------- | ----------------------------- |
| `LISTENING`                | `{ port, receiverId }` | Server ready for connections  |
| `DATABASE_READY`           | `{ directory }`        | Database initialized          |
| `ASSOCIATION_RECEIVED`     | `{ peerInfo }`         | New association request       |
| `ASSOCIATION_ACKNOWLEDGED` | `{ maxSendPDV }`       | Association accepted          |
| `ECHO_REQUEST`             | `{ peerInfo }`         | C-ECHO verification request   |
| `C_STORE_REQUEST`          | `{ sopClassUID }`      | Incoming storage request      |
| `FILE_DELETED`             | `{ filename }`         | File removed                  |
| `ASSOCIATION_RELEASE`      | —                      | Association released normally |
| `ASSOCIATION_ABORTED`      | —                      | Association aborted           |
| `CANNOT_START_LISTENER`    | `{ message }`          | Fatal: failed to bind port    |
| `CONFIG_ERROR`             | `{ message }`          | Fatal: configuration error    |
| `TERMINATING`              | —                      | Server shutting down          |
