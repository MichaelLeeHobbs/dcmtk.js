# Data & Metadata Tools

Tools for reading, converting, validating, and indexing DICOM file metadata.

All tools return `Promise<Result<T>>` and accept optional `timeoutMs` and `signal` (AbortSignal) parameters.

---

## dcm2xml

Convert a DICOM file to XML representation.

```typescript
import { dcm2xml } from '@ubercode/dcmtk';

const result = await dcm2xml('/path/to/image.dcm');
if (result.ok) {
    console.log(result.value.xml);
}
```

| Option               | Type             | Default | Description                                    |
| -------------------- | ---------------- | ------- | ---------------------------------------------- |
| `namespace`          | `boolean`        | —       | Include XML namespace declaration              |
| `charset`            | `Dcm2xmlCharset` | —       | Character set: `'utf8'`, `'latin1'`, `'ascii'` |
| `writeBinaryData`    | `boolean`        | —       | Write binary data (base64 encoded)             |
| `encodeBinaryBase64` | `boolean`        | —       | Encode binary inline                           |

**Result:** `{ xml: string }`

---

## dicom2json

Convert a DICOM file to DICOM JSON Model (PS3.18 F.2) **without DCMTK binaries** — a pure-JS parser
(~75x faster than the dcm2xml path: no process spawn, no XML intermediate, bulk pixel data never loaded).

```typescript
import { dicom2json, dicom2jsonFromBuffer } from '@ubercode/dcmtk';

const result = await dicom2json('/path/to/image.dcm');
if (result.ok) {
    console.log(result.value.data['00100010']); // Patient Name element
    console.log('Source:', result.value.source); // 'js'
}

// Synchronous, in-memory variant (no file I/O):
const bufferResult = dicom2jsonFromBuffer(buffer, { charsetAssume: 'latin-1' });
```

| Option                | Type      | Default | Description                                                                                     |
| --------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------- |
| `charsetAssume`       | `string`  | —       | Charset to assume when SpecificCharacterSet (0008,0005) is absent (`'ISO_IR 100'`, `'latin-1'`) |
| `charsetFallback`     | `string`  | —       | Charset to decode with when the file's charset is unsupported (`'latin-1'` recommended)         |
| `utf8MislabelPromote` | `boolean` | `false` | Decode values detected as mislabeled UTF-8 as UTF-8 instead of the declared charset             |
| `dcmtkFallback`       | `boolean` | `false` | Retry with the deprecated dcm2json binary path when the JS parser fails                         |

**Result:** `{ data: DicomJsonModel, warnings: readonly string[], source: 'js' | 'xml' | 'direct' }`

Character sets: all single-byte ISO_IR sets, UTF-8, GB18030/GBK, Shift_JIS, and the common
ISO 2022 code extensions (Japanese IR 13/87, Korean IR 149, Chinese IR 58) are decoded natively.

**UTF-8 mislabel detection:** when the resolved charset is single-byte (or the ASCII default
because 0008,0005 is absent) and a value's raw bytes contain a byte ≥ 0x80 while forming valid
UTF-8, the value is near-certainly mislabeled UTF-8 — the dcm2json binary rejected such files
with exit 80; the JS decoders cannot fail on byte content. The parser pushes a
`possible UTF-8 mislabel: <tag>` warning (one per distinct tag) either way; with
`utf8MislabelPromote: true` those values are decoded as UTF-8 instead of producing mojibake.
The same options are accepted by `DicomInstance.open` and `DicomReceiver`'s
`instanceOpenOptions`, and the warnings surface on `DicomInstance.warnings`.

Differences from the dcm2json binary path (both verified against `dcmdump` ground truth):

- File meta group 0002 elements are **included**, so `DicomDataset.transferSyntaxUID` works.
- Private tags keep their real block numbers (dcm2xml renumbers private blocks incorrectly).
- Known limitation: files using **explicit VR** `SV`/`UV`/`OV` (rare, 2019-era VRs) fail to
  tokenize — enable `dcmtkFallback` to cover them. Implicit VR files are unaffected.

---

## dcm2json (deprecated)

> **Deprecated:** use [`dicom2json`](#dicom2json). This path spawns DCMTK binaries, is ~75x slower,
> and renumbers private tag blocks in its XML output. It remains available as an escape hatch
> (see `dcmtkFallback` above).

Convert a DICOM file to DICOM JSON Model (PS3.18 F.2) using DCMTK binaries.

```typescript
import { dcm2json } from '@ubercode/dcmtk';

const result = await dcm2json('/path/to/image.dcm');
if (result.ok) {
    console.log(result.value.data['00100010']); // Patient Name element
    console.log('Source:', result.value.source); // 'xml' or 'direct'
}
```

| Option       | Type      | Default | Description                             |
| ------------ | --------- | ------- | --------------------------------------- |
| `directOnly` | `boolean` | —       | Skip XML path, use direct dcm2json only |

**Result:** `{ data: DicomJsonModel, source: 'xml' | 'direct' }`

Internally uses a two-phase strategy: dcm2xml then XML parsing (more reliable), with direct dcm2json
as fallback. The fallback only runs when time budget remains; when both paths fail, the error
includes both failures.

---

## dcmdump

Dump DICOM file contents as text.

```typescript
import { dcmdump } from '@ubercode/dcmtk';

const result = await dcmdump('/path/to/image.dcm');
if (result.ok) {
    console.log(result.value.text);
}

// Search for a specific tag
const tagResult = await dcmdump('/path/to/image.dcm', {
    searchTag: '(0010,0010)',
});
```

| Option        | Type            | Default      | Description                              |
| ------------- | --------------- | ------------ | ---------------------------------------- |
| `format`      | `DcmdumpFormat` | `'standard'` | Output format: `'standard'` or `'short'` |
| `allTags`     | `boolean`       | —            | Print all tags including private tags    |
| `searchTag`   | `string`        | —            | Search for specific tag `"(XXXX,XXXX)"`  |
| `printValues` | `boolean`       | —            | Print tag values with enhanced detail    |

**Result:** `{ text: string }`

---

## dcmconv

Convert DICOM file transfer syntax.

```typescript
import { dcmconv, TransferSyntax } from '@ubercode/dcmtk';

const result = await dcmconv('/path/to/input.dcm', '/path/to/output.dcm', {
    transferSyntax: TransferSyntax.EXPLICIT_LITTLE,
});
```

| Option           | Type                  | Default | Description                          |
| ---------------- | --------------------- | ------- | ------------------------------------ |
| `transferSyntax` | `TransferSyntaxValue` | —       | **Required.** Target transfer syntax |

**Result:** `{ outputPath: string }`

**TransferSyntax constants:**

| Constant          | Value   | Description                        |
| ----------------- | ------- | ---------------------------------- |
| `IMPLICIT_LITTLE` | `'+ti'` | Implicit VR Little Endian          |
| `EXPLICIT_LITTLE` | `'+te'` | Explicit VR Little Endian          |
| `EXPLICIT_BIG`    | `'+tb'` | Explicit VR Big Endian             |
| `JPEG_LOSSLESS`   | `'+tl'` | JPEG Lossless                      |
| `JPEG2K_LOSSLESS` | `'+t2'` | JPEG 2000 Lossless                 |
| `RLE`             | `'+tr'` | RLE Lossless                       |
| `DEFLATED`        | `'+td'` | Deflated Explicit VR Little Endian |

---

## dcmodify

Modify DICOM tags in-place.

```typescript
import { dcmodify } from '@ubercode/dcmtk';

const result = await dcmodify('/path/to/image.dcm', {
    modifications: [
        { tag: '(0010,0010)', value: 'DOE^JOHN' },
        { tag: '(0010,0020)', value: 'PATIENT-001' },
    ],
    erasePrivateTags: true,
});
```

| Option             | Type                | Default | Description                      |
| ------------------ | ------------------- | ------- | -------------------------------- |
| `modifications`    | `TagModification[]` | `[]`    | Array of `{ tag, value }` to set |
| `erasures`         | `string[]`          | —       | Tag paths to erase               |
| `erasePrivateTags` | `boolean`           | —       | Erase all private tags           |
| `noBackup`         | `boolean`           | —       | Do not create `.bak` backup file |
| `insertIfMissing`  | `boolean`           | —       | Insert tag if it doesn't exist   |

At least one of `modifications`, `erasures`, or `erasePrivateTags` must be specified.

**Result:** `{ filePath: string }`

Uses `spawnCommand` (not exec) for injection safety — DICOM values may contain shell-special characters.

---

## dcmftest

Test if a file is a valid DICOM Part 10 file.

```typescript
import { dcmftest } from '@ubercode/dcmtk';

const result = await dcmftest('/path/to/file.dcm');
if (result.ok) {
    console.log(result.value.isDicom ? 'Valid DICOM' : 'Not DICOM');
}
```

**Result:** `{ isDicom: boolean }`

---

## dcmgpdir

Modify an existing DICOMDIR file.

```typescript
import { dcmgpdir } from '@ubercode/dcmtk';

const result = await dcmgpdir({
    inputFiles: ['image1.dcm', 'image2.dcm'],
    outputFile: './DICOMDIR',
    inputDirectory: './dicom-files',
});
```

| Option             | Type       | Default | Description                          |
| ------------------ | ---------- | ------- | ------------------------------------ |
| `inputFiles`       | `string[]` | —       | **Required.** DICOM files to include |
| `outputFile`       | `string`   | —       | Output DICOMDIR file path            |
| `filesetId`        | `string`   | —       | File-set ID to embed                 |
| `inputDirectory`   | `string`   | —       | Root directory for referenced files  |
| `mapFilenames`     | `boolean`  | —       | Map filenames to DICOM format        |
| `inventAttributes` | `boolean`  | —       | Invent missing type 1 attributes     |

**Result:** `{ outputPath: string }`

---

## dcmmkdir

Create a new DICOMDIR file.

```typescript
import { dcmmkdir } from '@ubercode/dcmtk';

const result = await dcmmkdir({
    inputFiles: ['image1.dcm', 'image2.dcm'],
    outputFile: './DICOMDIR',
});
```

| Option             | Type       | Default | Description                          |
| ------------------ | ---------- | ------- | ------------------------------------ |
| `inputFiles`       | `string[]` | —       | **Required.** DICOM files to include |
| `outputFile`       | `string`   | —       | Output DICOMDIR file path            |
| `filesetId`        | `string`   | —       | File-set ID to embed                 |
| `append`           | `boolean`  | —       | Append to existing DICOMDIR          |
| `inputDirectory`   | `string`   | —       | Root directory for referenced files  |
| `mapFilenames`     | `boolean`  | —       | Map filenames to DICOM format        |
| `inventAttributes` | `boolean`  | —       | Invent missing type 1 attributes     |

**Result:** `{ outputPath: string }`

---

## dcmqridx

Register DICOM files in a Query/Retrieve SCP database index.

```typescript
import { dcmqridx } from '@ubercode/dcmtk';

// Register files
const result = await dcmqridx({
    indexDirectory: '/var/dcmtk/db',
    inputFiles: ['image1.dcm', 'image2.dcm'],
});

// Print database contents
const printResult = await dcmqridx({
    indexDirectory: '/var/dcmtk/db',
    print: true,
});
if (printResult.ok && printResult.value.mode === 'print') {
    console.log(printResult.value.output);
}
```

| Option           | Type       | Default | Description                                     |
| ---------------- | ---------- | ------- | ----------------------------------------------- |
| `indexDirectory` | `string`   | —       | **Required.** Storage area/index directory path |
| `inputFiles`     | `string[]` | —       | DICOM files to register                         |
| `print`          | `boolean`  | —       | List database contents (`-p` flag)              |
| `notNew`         | `boolean`  | —       | Mark status as "not new" (`-n` flag)            |

**Result:** `{ mode: 'register' } | { mode: 'print', output: string }`
