# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dcmtk is a modern TypeScript library wrapping all 60+ DCMTK (DICOM Toolkit) C++ command-line binaries with type-safe APIs. Built to the standards defined in `docs/TypeScript Coding Standard for Mission-Critical Systems.md`. **Requires DCMTK installed on the system** (detected via `DCMTK_PATH` env var or known install locations).

The full build plan is in `PLAN.md`. All implementation phases (1-8) are complete.

## Commands

```bash
pnpm run test                # Run all tests
pnpm run test:coverage       # Run tests with coverage (95% threshold enforced)
pnpm run test:watch          # Run tests in watch mode
pnpm run lint                # Lint with --max-warnings 0
pnpm run lint:fix            # Lint and auto-fix
pnpm run format              # Format with Prettier
pnpm run format:check        # Check formatting
pnpm run typecheck           # TypeScript type checking (tsc --noEmit)
pnpm run build               # Build with tsup (CJS + ESM + DTS)
pnpm run clean               # Remove dist/ and coverage/
pnpm run dry-run             # npm pack --dry-run to verify package contents
```

## Code Style

- Semicolons required
- Single quotes
- 4-space indentation
- Max line length: 160 characters
- Trailing commas (es5)
- LF line endings
- Arrow parens: avoid for single params
- Prettier formats all code; ESLint enforces mission-critical rules

## Governing Standards

All code **shall** comply with `docs/TypeScript Coding Standard for Mission-Critical Systems.md`. Key rules:

- **No `any`** (Rule 3.2) — use `unknown` + type guards
- **No traditional enums** (Rule 3.5) — use `as const` objects + union types
- **No recursion** (Rule 8.2) — use iterative algorithms with bounded loops
- **Result pattern** (Rule 6.2) — functions that can fail return `Result<T, E>`, never throw for expected failures
- **Branded types** (Rule 7.3) — domain primitives like `DicomTag`, `AETitle`, not raw strings
- **Immutability** (Rule 7.1) — `readonly` by default, explicit mutations via ChangeSet
- **Mandatory timeouts** (Rule 4.2) — all async operations have configurable timeouts
- **95% coverage** (Rule 9.1) — enforced by vitest config (branches threshold: 94%); currently at 99% statements
- **Exhaustive switches** (Rule 8.3) — `default: assertUnreachable(x)` in all switch statements
- **Functions <= 40 lines** (Rule 8.4) — warn, with skip for blank lines and comments
- **TSDoc on all public APIs** (Rule 10.1)

## Architecture

### Core Infrastructure (`src/`)

- `src/types.ts` — `Result<T, E>`, `ok()`, `err()`, `assertUnreachable()`, `DcmtkProcessResult`, `ExecOptions`, `SpawnOptions`, `ProcessLine`
- `src/brands.ts` — Branded types: `DicomTag`, `AETitle`, `DicomTagPath`, `SOPClassUID`, `TransferSyntaxUID`, `DicomFilePath`, `Port` + factory functions
- `src/constants.ts` — Timeouts, PDU sizes, platform paths, required binaries, buffer limits
- `src/validation.ts` — Zod schemas + parse functions bridging to branded types
- `src/findDcmtkPath.ts` — Platform-aware DCMTK binary discovery with caching
- `src/exec.ts` — `execCommand()` + `spawnCommand()` for short-lived processes
- `src/DcmtkProcess.ts` — Base class for long-lived processes (typed EventEmitter, Disposable)
- `src/parsers/` — `EventPattern` interface definitions, `LineParser` for line-by-line output parsing

### Short-lived Tool Wrappers (`src/tools/`)

51 async functions wrapping DCMTK binaries, organized by category:

- **Data & Metadata** — `dcm2xml`, `dcm2json`, `dcmdump`, `dcmconv`, `dcmodify`, `dcmftest`, `dcmgpdir`, `dcmmkdir`, `dcmqridx`
- **File Conversion** — `xml2dcm`, `json2dcm`, `dump2dcm`, `img2dcm`, `pdf2dcm`, `dcm2pdf`, `cda2dcm`, `dcm2cda`, `stl2dcm`
- **Compression** — `dcmcrle`, `dcmdrle`, `dcmencap`, `dcmdecap`, `dcmcjpeg`, `dcmdjpeg`, `dcmcjpls`, `dcmdjpls`
- **Image Processing** — `dcmj2pnm`, `dcm2pnm`, `dcmscale`, `dcmquant`, `dcmdspfn`, `dcod2lum`, `dconvlum`
- **Network** — `echoscu`, `dcmsend`, `storescu`, `findscu`, `movescu`, `getscu`, `termscu`
- **Structured Reports** — `dsrdump`, `dsr2xml`, `xml2dsr`, `drtdump`
- **Presentation State & Print** — `dcmpsmk`, `dcmpschk`, `dcmprscu`, `dcmpsprt`, `dcmp2pgm`, `dcmmkcrv`, `dcmmklut`

### Long-lived Server Classes (`src/servers/`)

- `Dcmrecv` — DICOM receiver (dcmrecv), C-STORE SCP
- `StoreSCP` — Storage SCP (storescp), advanced options
- `DcmQRSCP` — Query/Retrieve SCP (dcmqrscp), C-FIND/C-MOVE/C-GET
- `Wlmscpfs` — Worklist Management SCP (wlmscpfs)
- `DcmprsCP` — Print Management SCP (dcmprscp)
- `Dcmpsrcv` — Viewer network receiver (dcmpsrcv)
- `DicomReceiver` — Pooled receiver managing multiple `Dcmrecv` workers behind a TCP proxy with auto-scaling

All DCMTK server binaries are **single-threaded** and handle **one association at a time**. Concurrent connections queue at the TCP level — associations never interleave. `Dcmrecv` and `StoreSCP` include a built-in `AssociationTracker` that automatically correlates files to associations via `FILE_RECEIVED` and `ASSOCIATION_COMPLETE` events.

### High-Throughput Sender (`src/senders/`)

- `DicomSender` — Queued sender wrapping `storescu` with three modes (single, multiple, bucket), adaptive backpressure, retry, and typed events
- `types.ts` — `DicomSenderOptions`, `SendOptions`, `SendResult`, `SenderStatus`, event data types, `SenderMode`/`SenderHealth` const objects, `DicomSenderEventMap`

`DicomSender` extends `EventEmitter` directly (not DcmtkProcess) — it manages short-lived `storescu` calls, not a long-lived process. Private constructor + static `create()` with Zod `.strict()` validation. No `start()` needed — ready to send immediately after `create()`. `send()` returns `Promise<Result<SendResult>>` that resolves when the actual `storescu` call completes.

### High-Level PACS Client (`src/pacs/`)

- `PacsClient` — Connection-config-once client with `echo()`, `findStudies()`/`findSeries()`/`findImages()`/`findWorklist()`, `find()`, `retrieveStudy()`/`retrieveSeries()`, `store()`
- `types.ts` — `PacsClientConfig`, filter types (`StudyFilter`, `SeriesFilter`, `ImageFilter`, `WorklistFilter`), result types, `QueryLevel`/`RetrieveMode` const objects
- `queryKeys.ts` — Maps filter objects to findscu `-k` arguments with return key sets per query level
- `parseResults.ts` — Temp dir management, batch dcm2json parsing of findscu `--extract` output into `DicomDataset[]`

### Event Definitions (`src/events/`)

- Typed event patterns for each server: `dcmrecv.ts` (10), `storescp.ts` (12), `dcmprscp.ts` (7), `dcmpsrcv.ts` (12)

### DICOM Data Layer (`src/dicom/`)

- `DicomDataset` — Immutable dataset with typed accessors, path traversal, wildcard search
- `ChangeSet` — Immutable builder for tag modifications and erasures
- `DicomInstance` — Unified DICOM object with fluent API (open, modify, write)
- `vr.ts` — 34 standard DICOM Value Representations
- `dictionary.ts` — 4,902-entry DICOM tag dictionary
- `tagPath.ts` — Tag path parsing and segment utilities
- `xmlToJson.ts` — Re-export of XML-to-JSON conversion

### Data Files (`src/data/`)

- `dictionary.json` — Generated DICOM tag dictionary
- `sopClasses.ts` — SOP Class UID to name mappings
- `storescp.cfg` — Default storescp configuration

### Toolchain

- **TypeScript** 5.8+ with `erasableSyntaxOnly`, maximum strictness (`tsconfig.json`)
- **tsup** for dual CJS+ESM build with DTS generation (`tsup.config.ts`, uses `tsconfig.build.json`)
- **Vitest** for testing with v8 coverage (`vitest.config.ts`)
- **ESLint 9** flat config with typescript-eslint type-checked rules (`eslint.config.mjs`)
- **Prettier** for formatting (`.prettierrc`)
- **Husky** + **lint-staged** for pre-commit hooks
- **pnpm** as package manager

## Test Layout (Hybrid)

- **Colocated unit tests** in `src/` (e.g., `src/types.test.ts` next to `src/types.ts`)
- **Type tests** in `test/` (type-level assertions for public API)
- 929 unit/fuzz/edge-case tests across 48 files, plus 43 integration test files (run separately via `pnpm run test:integration`)
- Test files excluded from build via `tsconfig.build.json`
- Only `dist/` ships in the npm package

## Key Files

| File                                                              | Purpose                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `PLAN.md`                                                         | Full multi-phase build plan                                       |
| `docs/TypeScript Coding Standard for Mission-Critical Systems.md` | Governing coding standard                                         |
| `docs/adr/`                                                       | Architecture Decision Records                                     |
| `_configs/`                                                       | DCMTK config files (source for dictionary generation)             |
| `src/data/`                                                       | Shipped data files (dictionary.json, sopClasses.ts, storescp.cfg) |
| `scripts/`                                                        | Generation scripts (generateDictionary.ts)                        |
| `dicomSamples/`                                                   | Sample .dcm files for integration tests                           |

## API Reference

### Result Pattern

All fallible operations return `Result<T>` — never throw for expected failures.

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

Narrow with `if (result.ok)` before accessing `.value` or `.error`. Helpers: `ok(value)`, `err(error)`, `mapResult(result, fn)`.

### Branded Types

| Type                | Factory                             | Validator                       |
| ------------------- | ----------------------------------- | ------------------------------- |
| `DicomTag`          | `createDicomTag('00100010')`        | `parseDicomTag(input)`          |
| `AETitle`           | `createAETitle('MY_SCP')`           | `parseAETitle(input)`           |
| `Port`              | `createPort(4242)`                  | `parsePort(input)`              |
| `DicomTagPath`      | `createDicomTagPath('(0010,0010)')` | `parseDicomTagPath(input)`      |
| `SOPClassUID`       | `createSOPClassUID('1.2.840...')`   | `parseSOPClassUID(input)`       |
| `TransferSyntaxUID` | `createTransferSyntaxUID('...')`    | `parseTransferSyntaxUID(input)` |
| `DicomFilePath`     | `createDicomFilePath('/path')`      | —                               |

Factory functions are unchecked. Validators return `Result<T>`.

### Tool Wrappers (51 async functions)

All tools: `(options) => Promise<Result<T>>`. All accept optional `signal: AbortSignal` and `timeoutMs: number`.

#### Data & Metadata

| Function   | Signature                                      | Description             |
| ---------- | ---------------------------------------------- | ----------------------- |
| `dcm2xml`  | `(inputPath, options?) => Result<{xml}>`       | DICOM to XML            |
| `dcm2json` | `(inputPath, options?) => Result<{json}>`      | DICOM to JSON Model     |
| `dcmdump`  | `(options) => Result<{output}>`                | Dump DICOM contents     |
| `dcmconv`  | `(options) => Result<{outputPath}>`            | Convert transfer syntax |
| `dcmodify` | `(inputPath, options) => Result<{outputPath}>` | Modify DICOM tags       |
| `dcmftest` | `(options) => Result<{isValidDicom}>`          | Validate DICOM file     |
| `dcmgpdir` | `(options) => Result<{}>`                      | Modify DICOMDIR         |
| `dcmmkdir` | `(options) => Result<{}>`                      | Create DICOMDIR         |
| `dcmqridx` | `(options) => Result<{}>`                      | Index DICOM database    |

#### File Conversion

| Function   | Signature                           | Description            |
| ---------- | ----------------------------------- | ---------------------- |
| `xml2dcm`  | `(options) => Result<{outputPath}>` | XML to DICOM           |
| `json2dcm` | `(options) => Result<{outputPath}>` | JSON to DICOM          |
| `dump2dcm` | `(options) => Result<{outputPath}>` | Dump text to DICOM     |
| `img2dcm`  | `(options) => Result<{outputPath}>` | Image to DICOM         |
| `pdf2dcm`  | `(options) => Result<{outputPath}>` | PDF to DICOM           |
| `dcm2pdf`  | `(options) => Result<{outputPath}>` | Extract PDF from DICOM |
| `cda2dcm`  | `(options) => Result<{outputPath}>` | CDA to DICOM           |
| `dcm2cda`  | `(options) => Result<{outputPath}>` | Extract CDA from DICOM |
| `stl2dcm`  | `(options) => Result<{outputPath}>` | STL to DICOM           |

#### Compression & Encoding

| Function   | Signature                           | Description            |
| ---------- | ----------------------------------- | ---------------------- |
| `dcmcrle`  | `(options) => Result<{outputPath}>` | RLE compress           |
| `dcmdrle`  | `(options) => Result<{outputPath}>` | RLE decompress         |
| `dcmencap` | `(options) => Result<{outputPath}>` | Encapsulate compressed |
| `dcmdecap` | `(options) => Result<{outputPath}>` | Decapsulate compressed |
| `dcmcjpeg` | `(options) => Result<{outputPath}>` | JPEG compress          |
| `dcmdjpeg` | `(options) => Result<{outputPath}>` | JPEG decompress        |
| `dcmcjpls` | `(options) => Result<{outputPath}>` | JPEG-LS compress       |
| `dcmdjpls` | `(options) => Result<{outputPath}>` | JPEG-LS decompress     |

#### Image Processing

| Function   | Signature                           | Description                |
| ---------- | ----------------------------------- | -------------------------- |
| `dcmj2pnm` | `(options) => Result<{outputPath}>` | DICOM to BMP/JPEG/PNG/TIFF |
| `dcm2pnm`  | `(options) => Result<{outputPath}>` | DICOM to PNM/PGM           |
| `dcmscale` | `(options) => Result<{outputPath}>` | Scale DICOM images         |
| `dcmquant` | `(options) => Result<{outputPath}>` | Color quantize             |
| `dcmdspfn` | `(options) => Result<{output}>`     | Display function utilities |
| `dcod2lum` | `(options) => Result<{output}>`     | OD to luminance            |
| `dconvlum` | `(options) => Result<{output}>`     | Luminance conversion       |

#### Network

| Function   | Signature                          | Description           |
| ---------- | ---------------------------------- | --------------------- |
| `echoscu`  | `(options) => Result<{}>`          | C-ECHO verification   |
| `dcmsend`  | `(options) => Result<{}>`          | Send files (C-STORE)  |
| `storescu` | `(options) => Result<{}>`          | Store SCU (C-STORE)   |
| `findscu`  | `(options) => Result<{responses}>` | C-FIND query          |
| `movescu`  | `(options) => Result<{}>`          | C-MOVE retrieve       |
| `getscu`   | `(options) => Result<{}>`          | C-GET retrieve        |
| `termscu`  | `(options) => Result<{}>`          | Terminate association |

#### Structured Reports

| Function  | Signature                           | Description     |
| --------- | ----------------------------------- | --------------- |
| `dsrdump` | `(options) => Result<{output}>`     | Dump SR         |
| `dsr2xml` | `(options) => Result<{xml}>`        | SR to XML       |
| `xml2dsr` | `(options) => Result<{outputPath}>` | XML to SR       |
| `drtdump` | `(options) => Result<{output}>`     | Dump RT objects |

#### Presentation State & Print

| Function   | Signature                           | Description               |
| ---------- | ----------------------------------- | ------------------------- |
| `dcmpsmk`  | `(options) => Result<{outputPath}>` | Create presentation state |
| `dcmpschk` | `(options) => Result<{output}>`     | Check presentation state  |
| `dcmprscu` | `(options) => Result<{}>`           | Print SCU                 |
| `dcmpsprt` | `(options) => Result<{}>`           | Print presentation state  |
| `dcmp2pgm` | `(options) => Result<{outputPath}>` | Presentation state to PGM |
| `dcmmkcrv` | `(options) => Result<{outputPath}>` | Create curve data         |
| `dcmmklut` | `(options) => Result<{outputPath}>` | Create lookup table       |

### Server Classes

All servers: `static create(options) => Result<Server>`, then `server.start() => Promise<void>`, `server.stop() => Promise<void>`.

| Class      | Binary   | Key Options                          | Events                                                             |
| ---------- | -------- | ------------------------------------ | ------------------------------------------------------------------ |
| `Dcmrecv`  | dcmrecv  | `port`, `outputDirectory`, `aeTitle` | `ASSOCIATION_RECEIVED`, `C_STORE_REQUEST`, `STORED_FILE`, ...      |
| `StoreSCP` | storescp | `port`, `outputDirectory`, `aeTitle` | `ASSOCIATION_RECEIVED`, `STORING_FILE`, `ASSOCIATION_RELEASE`, ... |
| `DcmQRSCP` | dcmqrscp | `configFile`, `port`                 | `LISTENING`, `C_FIND_REQUEST`, `C_MOVE_REQUEST`, ...               |
| `Wlmscpfs` | wlmscpfs | `port`, `worklistDirectory`          | `LISTENING`, `C_FIND_REQUEST`, `ECHO_REQUEST`, ...                 |
| `DcmprsCP` | dcmprscp | `configFile`                         | `DATABASE_READY`, `ASSOCIATION_RECEIVED`, `CONFIG_ERROR`, ...      |
| `Dcmpsrcv` | dcmpsrcv | `configFile`, `receiverId`           | `LISTENING`, `C_STORE_REQUEST`, `FILE_DELETED`, ...                |

`DicomReceiver` is a **pooled receiver** (not a DcmtkProcess subclass) that manages multiple `Dcmrecv` workers behind a TCP proxy. It auto-scales between `minPoolSize` and `maxPoolSize` workers, routes connections to idle workers, and organizes received files into per-association directories. Workers are long-lived and reused across associations.

Listen to typed events via `server.onEvent('EVENT_NAME', data => { ... })`.

All servers extend `DcmtkProcess` (EventEmitter + Disposable) and support `AbortSignal`.

### DicomReceiver

Pooled DICOM receiver managing multiple `Dcmrecv` workers behind a TCP proxy.

Options include `port`, `storageDir`, `aeTitle`, pool sizing (`minPoolSize`/`maxPoolSize`), `connectionTimeoutMs`, `configFile`/`configProfile`, `acseTimeout`, `dimseTimeout`, `maxPdu`, and `signal`. Set `port: 0` for external socket mode (no TCP proxy).

Events: `FILE_RECEIVED`, `ASSOCIATION_COMPLETE` (includes `output` lines), `ASSOCIATION_RECEIVED`, `C_STORE_REQUEST`, `ECHO_REQUEST`, `REFUSING_ASSOCIATION`, `error`.

```typescript
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

receiver.onFileReceived(data => console.log(data.filePath, data.instance.patientName));
receiver.onAssociationComplete(data => console.log(data.files, data.totalBytes, data.output.length));
receiver.onAssociationReceived(data => console.log(data.callingAE, data.source));
receiver.onCStoreRequest(data => console.log(data.associationId, data.raw));

await receiver.start();
// ... connections auto-routed to idle workers, files organized per-association
await receiver.stop();

// External socket mode: receiver.handleSocket(socket) routes a net.Socket to a worker
// Pool monitoring
receiver.poolStatus; // PoolStatus: { idle: number; busy: number; total: number }
```

`PoolStatus`, `PoolAssociationReceivedData`, `PoolCStoreRequestData`, `PoolEchoRequestData`, `PoolRefusingAssociationData` are exported as named types.

### DicomSender

High-throughput DICOM sender with queuing, bucketing, and adaptive backpressure.

```typescript
const result = DicomSender.create({
    host: '192.168.1.100',
    port: 104,
    calledAETitle: 'PACS',
    mode: 'multiple', // 'single' | 'multiple' | 'bucket'
    maxAssociations: 4,
});
if (!result.ok) {
    console.error(result.error.message);
    return;
}
const sender = result.value;

sender.onSendComplete(data => console.log(data.fileCount, 'files in', data.durationMs, 'ms'));
sender.onSendFailed(data => console.error(data.error.message, 'after', data.attempts, 'attempts'));
sender.onHealthChanged(data => console.log(data.previousHealth, '→', data.newHealth));

await sender.send(['/path/to/file.dcm']); // resolves when actually sent
sender.status; // { health, activeAssociations, effectiveMaxAssociations, queueLength, ... }
await sender.stop(); // graceful shutdown
```

Three modes: **single** (serial FIFO), **multiple** (up to N concurrent storescu calls), **bucket** (accumulate files, flush on timeout or max size). Backpressure halves effective concurrency on consecutive failures, recovers on consecutive successes.

### PacsClient

High-level PACS client encapsulating connection config and DICOM network operations.

```typescript
const clientResult = PacsClient.create({ host: '192.168.1.100', port: 104, calledAETitle: 'PACS' });
if (!clientResult.ok) {
    console.error(clientResult.error.message);
    return;
}
const client = clientResult.value;

await client.echo(); // C-ECHO
await client.findStudies({ patientId: 'PAT001' }); // C-FIND → DicomDataset[]
await client.findSeries({ studyInstanceUID: '1.2.3' }); // C-FIND → DicomDataset[]
await client.findImages({ studyInstanceUID: '1.2.3', seriesInstanceUID: '1.2.3.4' });
await client.findWorklist({ keys: ['0040,0100.0008,0060=CT'] }); // Worklist C-FIND
await client.find(['0008,0052=STUDY', '0010,0020=PAT001']); // Raw C-FIND
await client.retrieveStudy('1.2.3', { outputDirectory: '/tmp' }); // C-GET (default) or C-MOVE
await client.store(['/path/to/file.dcm']); // C-STORE
```

### DICOM Data Layer

#### DicomDataset

Immutable wrapper around DICOM JSON Model.

```typescript
const dsResult = DicomDataset.fromJson(jsonObject);
if (!dsResult.ok) {
    /* handle error */
}
const ds = dsResult.value;
ds.patientName; // string (convenience getter)
ds.getString('00100020'); // string with optional fallback
ds.getNumber('00200013'); // Result<number>
ds.getStrings('00080060'); // Result<ReadonlyArray<string>>
ds.hasTag('00100010'); // boolean
ds.getElementAtPath(tagPath); // Result<DicomJsonElement>
ds.findValues(wildcardPath); // ReadonlyArray<unknown>
```

Convenience getters: `patientName`, `patientID`, `studyDate`, `modality`, `accession`, `sopClassUID`, `studyInstanceUID`, `seriesInstanceUID`, `sopInstanceUID`, `transferSyntaxUID`.

#### ChangeSet

Immutable builder for DICOM modifications.

```typescript
const changes = ChangeSet.empty().setTag(createDicomTagPath('(0010,0010)'), 'DOE^JOHN').eraseTag(createDicomTagPath('(0010,0020)')).erasePrivateTags();

changes.isEmpty; // boolean
changes.modifications; // ReadonlyMap
changes.erasures; // ReadonlySet
changes.toModifications(); // TagModification[]
changes.merge(other); // ChangeSet
```

#### DicomInstance

Unified DICOM object with fluent API for reading, modifying, and writing.

```typescript
const openResult = await DicomInstance.open('/path/to/file.dcm');
if (!openResult.ok) {
    /* handle error */
}
const inst = openResult.value;
inst.patientName; // string (convenience getter)
inst.dataset; // DicomDataset
inst.filePath; // string | undefined
inst.changes; // ChangeSet

const modified = inst.setPatientName('DOE^JOHN').erasePrivateTags();
const updated = inst.withChanges(changes); // merge external ChangeSet
const moved = inst.withFilePath('/new/path.dcm'); // change file path
await modified.applyChanges(); // modify in-place
await modified.writeAs('/output.dcm'); // copy + modify → new DicomInstance
await inst.fileSize(); // Result<number>
await inst.unlink(); // delete file
```

### Key Utilities

- `findDcmtkPath(binary?)` — Discover DCMTK install path
- `xmlToJson(xml)` — Convert DCMTK XML to DICOM JSON Model
- `lookupTag(tag)` / `lookupTagByName(name)` / `lookupTagByKeyword(kw)` — Dictionary lookups
- `SOP_CLASSES` / `sopClassNameFromUID(uid)` — SOP Class mappings
- `VR` — Value Representation constants and metadata
- `batch(items, operation, options?)` — Parallel batch processing with concurrency control
- `retry(fn, options?)` — Retry with exponential backoff
