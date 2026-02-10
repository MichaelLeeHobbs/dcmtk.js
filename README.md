# dcmtk

Type-safe Node.js bindings for the [DCMTK](https://dicom.offis.de/dcmtk.php.en) (DICOM Toolkit) command-line utilities. Wraps 48 DCMTK binaries and 4 long-lived server processes with a modern async/await API, branded types, and the Result pattern for safe error handling.

## Features

- **48 tool wrappers** — async functions for every DCMTK command-line binary (data conversion, network, image processing, structured reports, presentation state)
- **4 server classes** — long-lived DICOM listeners with typed EventEmitter APIs and graceful shutdown
- **DICOM data layer** — immutable `DicomDataset`, explicit `ChangeSet` builder, and `DicomFile` I/O
- **Result pattern** — all fallible operations return `Result<T>` instead of throwing, enabling safe error narrowing
- **Branded types** — `DicomTag`, `AETitle`, `Port`, and more prevent primitive-type mix-ups at compile time
- **Full TypeScript** — strict mode, dual CJS/ESM build, complete `.d.ts` declarations
- **AbortSignal support** — cancel any operation with standard `AbortController`
- **Zero native dependencies** — delegates to system-installed DCMTK binaries

## Prerequisites

- **Node.js** >= 20
- **DCMTK** installed on the system — set the `DCMTK_PATH` environment variable or install to a standard location (`/usr/bin`, `/usr/local/bin`, `C:\Program Files\DCMTK`)

## Installation

```bash
npm install dcmtk
```

## Quick Start

### Read DICOM metadata

```typescript
import { dcm2json } from 'dcmtk';

const result = await dcm2json('/path/to/image.dcm');

if (result.ok) {
    console.log(result.value.json); // DICOM JSON Model object
} else {
    console.error(result.error);
}
```

### Network C-ECHO

```typescript
import { echoscu } from 'dcmtk';

const result = await echoscu({
    peer: '127.0.0.1',
    port: 4242,
    calledAETitle: 'PACS',
});

if (result.ok) {
    console.log('PACS is reachable');
}
```

### Receive DICOM files

```typescript
import { Dcmrecv } from 'dcmtk';

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

    // Later: graceful shutdown
    await server.stop();
}
```

## DICOM Data Layer

The library provides an immutable data layer for reading and modifying DICOM files.

```typescript
import { DicomFile, ChangeSet, createDicomTagPath } from 'dcmtk';

// Open a file and read its dataset
const result = await DicomFile.open('/path/to/image.dcm');

if (result.ok) {
    const file = result.value;

    // Read metadata via the dataset
    console.log(file.dataset.patientName); // convenience getter
    console.log(file.dataset.getString('00100020')); // Patient ID by tag

    // Build changes with an immutable ChangeSet
    const changes = ChangeSet.empty()
        .setTag(createDicomTagPath('(0010,0010)'), 'DOE^JOHN')
        .setTag(createDicomTagPath('(0010,0020)'), 'ANON-001')
        .erasePrivateTags();

    // Apply in-place or write to a new file
    const updated = file.withChanges(changes);
    await updated.applyChanges(); // modifies original
    // or: await updated.writeAs('/path/to/anonymized.dcm');
}
```

## Result Pattern

All fallible operations return `Result<T>` — a discriminated union with an `ok` boolean flag. This replaces try/catch for expected failure modes.

```typescript
import { dcmftest } from 'dcmtk';

const result = await dcmftest({ inputPath: '/path/to/file.dcm' });

if (result.ok) {
    console.log(`Valid DICOM: ${result.value.isValidDicom}`);
} else {
    // result.error is typed — no casting needed
    console.error(`Failed: ${result.error}`);
}
```

## Branded Types

Branded types prevent accidental mix-ups of plain strings at compile time.

```typescript
import { createAETitle, createPort, createDicomTag } from 'dcmtk';

const aeTitle = createAETitle('MY_SCP'); // AETitle branded type
const port = createPort(4242); // Port branded type
const tag = createDicomTag('00100010'); // DicomTag branded type
```

Validation functions (`parseAETitle`, `parsePort`, etc.) return `Result<T>` for runtime input validation.

## Tool Reference

### Data & Metadata

| Function   | DCMTK Binary | Description                 |
| ---------- | ------------ | --------------------------- |
| `dcm2xml`  | dcm2xml      | Convert DICOM to XML        |
| `dcm2json` | dcm2json     | Convert DICOM to JSON Model |
| `dcmdump`  | dcmdump      | Dump DICOM file contents    |
| `dcmconv`  | dcmconv      | Convert transfer syntax     |
| `dcmodify` | dcmodify     | Modify DICOM tags           |
| `dcmftest` | dcmftest     | Test if file is valid DICOM |
| `dcmgpdir` | dcmgpdir     | Modify DICOMDIR             |
| `dcmmkdir` | dcmmkdir     | Create DICOMDIR             |

### File Conversion

| Function   | DCMTK Binary | Description                      |
| ---------- | ------------ | -------------------------------- |
| `xml2dcm`  | xml2dcm      | XML to DICOM                     |
| `json2dcm` | json2dcm     | JSON to DICOM                    |
| `dump2dcm` | dump2dcm     | Dump text to DICOM               |
| `img2dcm`  | img2dcm      | Image to DICOM (JPEG, PNG, etc.) |
| `pdf2dcm`  | pdf2dcm      | PDF to encapsulated DICOM        |
| `dcm2pdf`  | dcm2pdf      | Extract PDF from DICOM           |
| `cda2dcm`  | cda2dcm      | CDA to encapsulated DICOM        |
| `dcm2cda`  | dcm2cda      | Extract CDA from DICOM           |
| `stl2dcm`  | stl2dcm      | STL to encapsulated DICOM        |

### Compression & Encoding

| Function   | DCMTK Binary | Description                 |
| ---------- | ------------ | --------------------------- |
| `dcmcrle`  | dcmcrle      | RLE compression             |
| `dcmdrle`  | dcmdrle      | RLE decompression           |
| `dcmencap` | dcmencap     | Encapsulate compressed data |
| `dcmdecap` | dcmdecap     | Decapsulate compressed data |
| `dcmcjpeg` | dcmcjpeg     | JPEG compression            |
| `dcmdjpeg` | dcmdjpeg     | JPEG decompression          |

### Image Processing

| Function   | DCMTK Binary | Description                           |
| ---------- | ------------ | ------------------------------------- |
| `dcmj2pnm` | dcmj2pnm     | DICOM to image (BMP, JPEG, PNG, TIFF) |
| `dcm2pnm`  | dcm2pnm      | DICOM to PNM/PGM image                |
| `dcmscale` | dcmscale     | Scale DICOM images                    |
| `dcmquant` | dcmquant     | Color quantize DICOM images           |
| `dcmdspfn` | dcmdspfn     | Display function utilities            |
| `dcod2lum` | dcod2lum     | Convert OD values to luminance        |
| `dconvlum` | dconvlum     | Convert luminance calibration data    |

### Network

| Function   | DCMTK Binary | Description                      |
| ---------- | ------------ | -------------------------------- |
| `echoscu`  | echoscu      | C-ECHO verification              |
| `dcmsend`  | dcmsend      | Send DICOM files (C-STORE)       |
| `storescu` | storescu     | Store SCU (C-STORE with options) |
| `findscu`  | findscu      | Query SCP (C-FIND)               |
| `movescu`  | movescu      | Retrieve from SCP (C-MOVE)       |
| `getscu`   | getscu       | Retrieve from SCP (C-GET)        |
| `termscu`  | termscu      | Terminate association            |

### Structured Reports

| Function  | DCMTK Binary | Description            |
| --------- | ------------ | ---------------------- |
| `dsrdump` | dsrdump      | Dump structured report |
| `dsr2xml` | dsr2xml      | SR to XML              |
| `xml2dsr` | xml2dsr      | XML to SR              |
| `drtdump` | drtdump      | Dump RT objects        |

### Presentation State & Print

| Function   | DCMTK Binary | Description               |
| ---------- | ------------ | ------------------------- |
| `dcmpsmk`  | dcmpsmk      | Create presentation state |
| `dcmpschk` | dcmpschk     | Check presentation state  |
| `dcmprscu` | dcmprscu     | Print SCU                 |
| `dcmpsprt` | dcmpsprt     | Print presentation state  |
| `dcmp2pgm` | dcmp2pgm     | Presentation state to PGM |
| `dcmmkcrv` | dcmmkcrv     | Create curve data         |
| `dcmmklut` | dcmmklut     | Create lookup table       |

## Server Reference

| Class      | DCMTK Binary | Description                       |
| ---------- | ------------ | --------------------------------- |
| `Dcmrecv`  | dcmrecv      | DICOM receiver (C-STORE SCP)      |
| `StoreSCP` | storescp     | Storage SCP with advanced options |
| `DcmprsCP` | dcmprscp     | Print Management SCP              |
| `Dcmpsrcv` | dcmpsrcv     | Viewer network receiver           |

All servers use a static `create()` factory that returns `Result<T>`, and extend `DcmtkProcess` with typed event listeners via `onEvent()`. They support `AbortSignal` for cancellation and implement `Disposable` for resource cleanup.

## License

[MIT](LICENSE) - Michael Hobbs
