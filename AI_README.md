# dcmtk — AI API Reference

Type-safe Node.js bindings for DCMTK command-line utilities. Requires Node.js >= 20 and system-installed DCMTK binaries.

```bash
npm install dcmtk
```

## Result Pattern

All fallible operations return `Result<T>` — never throw for expected failures.

```typescript
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
```

Narrow with `if (result.ok)` before accessing `.value` or `.error`.

## Branded Types

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

## Tool Wrappers (48 async functions)

All tools: `(options) => Promise<Result<T>>`. All accept optional `signal: AbortSignal` and `timeoutMs: number`.

### Data & Metadata

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

### File Conversion

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

### Compression & Encoding

| Function   | Signature                           | Description            |
| ---------- | ----------------------------------- | ---------------------- |
| `dcmcrle`  | `(options) => Result<{outputPath}>` | RLE compress           |
| `dcmdrle`  | `(options) => Result<{outputPath}>` | RLE decompress         |
| `dcmencap` | `(options) => Result<{outputPath}>` | Encapsulate compressed |
| `dcmdecap` | `(options) => Result<{outputPath}>` | Decapsulate compressed |
| `dcmcjpeg` | `(options) => Result<{outputPath}>` | JPEG compress          |
| `dcmdjpeg` | `(options) => Result<{outputPath}>` | JPEG decompress        |

### Image Processing

| Function   | Signature                           | Description                |
| ---------- | ----------------------------------- | -------------------------- |
| `dcmj2pnm` | `(options) => Result<{outputPath}>` | DICOM to BMP/JPEG/PNG/TIFF |
| `dcm2pnm`  | `(options) => Result<{outputPath}>` | DICOM to PNM/PGM           |
| `dcmscale` | `(options) => Result<{outputPath}>` | Scale DICOM images         |
| `dcmquant` | `(options) => Result<{outputPath}>` | Color quantize             |
| `dcmdspfn` | `(options) => Result<{output}>`     | Display function utilities |
| `dcod2lum` | `(options) => Result<{output}>`     | OD to luminance            |
| `dconvlum` | `(options) => Result<{output}>`     | Luminance conversion       |

### Network

| Function   | Signature                          | Description           |
| ---------- | ---------------------------------- | --------------------- |
| `echoscu`  | `(options) => Result<{}>`          | C-ECHO verification   |
| `dcmsend`  | `(options) => Result<{}>`          | Send files (C-STORE)  |
| `storescu` | `(options) => Result<{}>`          | Store SCU (C-STORE)   |
| `findscu`  | `(options) => Result<{responses}>` | C-FIND query          |
| `movescu`  | `(options) => Result<{}>`          | C-MOVE retrieve       |
| `getscu`   | `(options) => Result<{}>`          | C-GET retrieve        |
| `termscu`  | `(options) => Result<{}>`          | Terminate association |

### Structured Reports

| Function  | Signature                           | Description     |
| --------- | ----------------------------------- | --------------- |
| `dsrdump` | `(options) => Result<{output}>`     | Dump SR         |
| `dsr2xml` | `(options) => Result<{xml}>`        | SR to XML       |
| `xml2dsr` | `(options) => Result<{outputPath}>` | XML to SR       |
| `drtdump` | `(options) => Result<{output}>`     | Dump RT objects |

### Presentation State & Print

| Function   | Signature                           | Description               |
| ---------- | ----------------------------------- | ------------------------- |
| `dcmpsmk`  | `(options) => Result<{outputPath}>` | Create presentation state |
| `dcmpschk` | `(options) => Result<{output}>`     | Check presentation state  |
| `dcmprscu` | `(options) => Result<{}>`           | Print SCU                 |
| `dcmpsprt` | `(options) => Result<{}>`           | Print presentation state  |
| `dcmp2pgm` | `(options) => Result<{outputPath}>` | Presentation state to PGM |
| `dcmmkcrv` | `(options) => Result<{outputPath}>` | Create curve data         |
| `dcmmklut` | `(options) => Result<{outputPath}>` | Create lookup table       |

## Server Classes

All servers: `static create(options) => Result<Server>`, then `server.start() => Promise<void>`, `server.stop() => Promise<void>`.

| Class      | Binary   | Key Options                          | Events                                                             |
| ---------- | -------- | ------------------------------------ | ------------------------------------------------------------------ |
| `Dcmrecv`  | dcmrecv  | `port`, `outputDirectory`, `aeTitle` | `ASSOCIATION_RECEIVED`, `C_STORE_REQUEST`, `STORED_FILE`, ...      |
| `StoreSCP` | storescp | `port`, `outputDirectory`, `aeTitle` | `ASSOCIATION_RECEIVED`, `STORING_FILE`, `ASSOCIATION_RELEASE`, ... |
| `DcmprsCP` | dcmprscp | `configFile`                         | `DATABASE_READY`, `ASSOCIATION_RECEIVED`, `CONFIG_ERROR`, ...      |
| `Dcmpsrcv` | dcmpsrcv | `configFile`, `receiverId`           | `LISTENING`, `C_STORE_REQUEST`, `FILE_DELETED`, ...                |

Listen to typed events via `server.onEvent('EVENT_NAME', data => { ... })`.

All servers extend `DcmtkProcess` (EventEmitter + Disposable) and support `AbortSignal`.

## DICOM Data Layer

### DicomDataset

Immutable wrapper around DICOM JSON Model.

```typescript
const result = DicomDataset.fromJson(jsonObject);
if (result.ok) {
    const ds = result.value;
    ds.patientName; // string (convenience getter)
    ds.getString('00100020'); // string with optional fallback
    ds.getNumber('00200013'); // Result<number>
    ds.getStrings('00080060'); // Result<ReadonlyArray<string>>
    ds.hasTag('00100010'); // boolean
    ds.getElementAtPath(tagPath); // Result<DicomJsonElement>
    ds.findValues(wildcardPath); // ReadonlyArray<unknown>
}
```

Convenience getters: `patientName`, `patientID`, `studyDate`, `modality`, `accession`, `sopClassUID`, `studyInstanceUID`, `seriesInstanceUID`, `sopInstanceUID`, `transferSyntaxUID`.

### ChangeSet

Immutable builder for DICOM modifications.

```typescript
const changes = ChangeSet.empty().setTag(createDicomTagPath('(0010,0010)'), 'DOE^JOHN').eraseTag(createDicomTagPath('(0010,0020)')).erasePrivateTags();

changes.isEmpty; // boolean
changes.modifications; // ReadonlyMap
changes.erasures; // ReadonlySet
changes.toModifications(); // TagModification[]
changes.merge(other); // ChangeSet
```

### DicomFile

File I/O combining dataset reading and modification.

```typescript
const result = await DicomFile.open('/path/to/file.dcm');
if (result.ok) {
    const file = result.value;
    file.dataset; // DicomDataset
    file.filePath; // DicomFilePath
    file.changes; // ChangeSet

    const updated = file.withChanges(changes); // new DicomFile
    await updated.applyChanges(); // modify in-place
    await updated.writeAs('/output.dcm'); // copy + modify
    await file.fileSize(); // Result<number>
    await file.unlink(); // delete file
}
```

## Key Utilities

- `findDcmtkPath(binary?)` — Discover DCMTK install path
- `xmlToJson(xml)` — Convert DCMTK XML to DICOM JSON Model
- `lookupTag(tag)` / `lookupTagByName(name)` / `lookupTagByKeyword(kw)` — Dictionary lookups
- `SOP_CLASSES` / `sopClassNameFromUID(uid)` — SOP Class mappings
- `VR` — Value Representation constants and metadata
