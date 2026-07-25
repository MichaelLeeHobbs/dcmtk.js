# @ubercode/dcmtk

> **RELEASE CANDIDATE** — the public API is frozen for 1.0. In production use. Breaking changes before
> 1.0 final would require a compelling reason and will be called out in the [changelog](CHANGELOG.md).

[![npm version](https://img.shields.io/npm/v/@ubercode/dcmtk.svg)](https://www.npmjs.com/package/@ubercode/dcmtk)
[![npm downloads](https://img.shields.io/npm/dm/@ubercode/dcmtk.svg)](https://www.npmjs.com/package/@ubercode/dcmtk)
[![CI](https://github.com/MichaelLeeHobbs/dcmtk.js/actions/workflows/ci.yml/badge.svg)](https://github.com/MichaelLeeHobbs/dcmtk.js/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Type-safe Node.js bindings for the [DCMTK](https://dicom.offis.de/dcmtk.php.en) (DICOM Toolkit) command-line utilities. Wraps 51 DCMTK binaries, 6 long-lived server processes, a pooled DicomReceiver with auto-scaling workers, and a high-throughput DicomSender with queuing and backpressure — all with a modern async/await API, branded types, and the Result pattern for safe error handling.

## Features

- **51 tool wrappers** — async functions for every DCMTK command-line binary with `verbosity` control and full CLI flag coverage
- **Network resilience** — all 7 network tools support PDU sizing, ACSE/DIMSE/association timeouts, and hostname lookup control
- **6 server classes + DicomReceiver + DicomSender** — long-lived DICOM listeners with typed EventEmitter APIs, a pooled receiver with auto-scaling workers, and a high-throughput sender with queuing, bucketing, and backpressure
- **PacsClient** — high-level PACS client with Echo, Query, Retrieve, and Store operations
- **DICOM data layer** — immutable `DicomDataset`, explicit `ChangeSet` builder, and `DicomInstance` unified file I/O
- **Result pattern** — all fallible operations return `Result<T>` instead of throwing
- **Branded types** — `DicomTag`, `AETitle`, `Port`, and more prevent primitive-type mix-ups at compile time
- **Full TypeScript** — strict mode, dual CJS/ESM build, complete `.d.ts` declarations
- **AbortSignal support** — cancel any operation with standard `AbortController`
- **Zero native dependencies** — delegates to system-installed DCMTK binaries

## Prerequisites

- **Node.js** >= 20
- **DCMTK** installed on the system — set the `DCMTK_PATH` environment variable or install to a standard location (`/usr/bin`, `/usr/local/bin`, `C:\Program Files\DCMTK`). Pre-built Docker images with Node.js + DCMTK are available: [`michaelleehobbs/nodejs-dcmtk`](https://hub.docker.com/r/michaelleehobbs/nodejs-dcmtk)

## Installation

```bash
npm install @ubercode/dcmtk
# or
pnpm add @ubercode/dcmtk
# or
yarn add @ubercode/dcmtk
```

## Quick Start

### Read DICOM metadata

```typescript
import { dcm2json } from '@ubercode/dcmtk';

const result = await dcm2json('/path/to/image.dcm');

if (result.ok) {
    console.log(result.value.data); // DICOM JSON Model object
} else {
    console.error(result.error);
}
```

### Network C-ECHO

```typescript
import { echoscu } from '@ubercode/dcmtk';

const result = await echoscu({
    host: '127.0.0.1',
    port: 4242,
    calledAETitle: 'PACS',
    verbosity: 'verbose',
    associationTimeout: 10,
});

if (result.ok) {
    console.log('PACS is reachable');
}
```

### Receive DICOM files

```typescript
import { Dcmrecv } from '@ubercode/dcmtk';

const result = Dcmrecv.create({ port: 4242, outputDirectory: './incoming' });

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

> For production workloads with concurrent connections, use [`DicomReceiver`](docs/servers.md#dicomreceiver) — a pooled receiver that manages multiple `Dcmrecv` workers behind a TCP proxy with auto-scaling.

## Documentation

| Guide                                        | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| [Getting Started](docs/GETTING_STARTED.md)   | Installation, DICOM glossary, tutorials, troubleshooting |
| [Core Concepts](docs/core-concepts.md)       | Result pattern, branded types, timeouts, AbortSignal     |
| [PACS Client](docs/pacs-client.md)           | High-level Echo, Query, Retrieve, Store API              |
| [DICOM Data Layer](docs/dicom-data-layer.md) | DicomDataset, ChangeSet, DicomInstance                   |
| [Servers](docs/servers.md)                   | 6 server classes + DicomReceiver pooled receiver         |
| [Senders](docs/senders.md)                   | DicomSender high-throughput sender with backpressure     |
| [Utilities](docs/utilities.md)               | batch processing, retry with backoff                     |

## Tool Reference

51 async functions wrapping DCMTK command-line binaries, organized by category:

| Category           | Tools                                                                                 | Docs                                                      |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Data & Metadata    | dcm2xml, dcm2json, dcmdump, dcmconv, dcmodify, dcmftest, dcmgpdir, dcmmkdir, dcmqridx | [data-metadata.md](docs/tools/data-metadata.md)           |
| File Conversion    | xml2dcm, json2dcm, dump2dcm, img2dcm, pdf2dcm, dcm2pdf, cda2dcm, dcm2cda, stl2dcm     | [file-conversion.md](docs/tools/file-conversion.md)       |
| Compression        | dcmcrle, dcmdrle, dcmencap, dcmdecap, dcmcjpeg, dcmdjpeg, dcmcjpls, dcmdjpls          | [compression.md](docs/tools/compression.md)               |
| Image Processing   | dcmj2pnm, dcm2pnm, dcmscale, dcmquant, dcmdspfn, dcod2lum, dconvlum                   | [image-processing.md](docs/tools/image-processing.md)     |
| Network            | echoscu, dcmsend, storescu, findscu, movescu, getscu, termscu                         | [network.md](docs/tools/network.md)                       |
| Structured Reports | dsrdump, dsr2xml, xml2dsr, drtdump                                                    | [structured-reports.md](docs/tools/structured-reports.md) |
| Presentation State | dcmpsmk, dcmpschk, dcmprscu, dcmpsprt, dcmp2pgm, dcmmkcrv, dcmmklut                   | [presentation-state.md](docs/tools/presentation-state.md) |

## Server Reference

| Class           | Binary          | Description                                | Docs                                        |
| --------------- | --------------- | ------------------------------------------ | ------------------------------------------- |
| `Dcmrecv`       | dcmrecv         | DICOM receiver (C-STORE SCP)               | [servers.md](docs/servers.md#dcmrecv)       |
| `StoreSCP`      | storescp        | Storage SCP with advanced options          | [servers.md](docs/servers.md#storescp)      |
| `DcmQRSCP`      | dcmqrscp        | Query/Retrieve SCP (C-FIND, C-MOVE, C-GET) | [servers.md](docs/servers.md#dcmqrscp)      |
| `Wlmscpfs`      | wlmscpfs        | Worklist Management SCP                    | [servers.md](docs/servers.md#wlmscpfs)      |
| `DcmprsCP`      | dcmprscp        | Print Management SCP                       | [servers.md](docs/servers.md#dcmprscp)      |
| `Dcmpsrcv`      | dcmpsrcv        | Viewer network receiver                    | [servers.md](docs/servers.md#dcmpsrcv)      |
| `DicomReceiver` | dcmrecv (pool)  | Pooled receiver with auto-scaling workers  | [servers.md](docs/servers.md#dicomreceiver) |
| `DicomSender`   | storescu (pool) | High-throughput sender with backpressure   | [senders.md](docs/senders.md)               |

## License

[MIT](LICENSE) - Michael Hobbs

The bundled DICOM data dictionary (`src/data/dictionary.json`) is generated from DCMTK's
`dcmdata/data/dicom.dic`, vendored at `_configs/dicom.dic` with its original OFFIS e.V.
copyright notice intact and redistributed under the [DCMTK license](https://github.com/DCMTK/dcmtk/blob/master/COPYRIGHT).
