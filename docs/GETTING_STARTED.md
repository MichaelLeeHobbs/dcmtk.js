# Getting Started with dcmtk

A step-by-step guide to using the `dcmtk` library for working with DICOM medical imaging files in Node.js and TypeScript.

---

## Prerequisites

### System Requirements

- **Node.js** >= 20
- **DCMTK** (DICOM Toolkit) installed on your system

### Installing DCMTK

The `dcmtk` library does not bundle DCMTK binaries. You must install DCMTK separately on your system.

**Windows:**

1. Download the latest DCMTK binaries from https://dicom.offis.de/dcmtk.php.en
2. Extract the archive to a directory (e.g., `C:\Program Files\DCMTK`)
3. Add the `bin` directory to your system PATH, or set the `DCMTK_PATH` environment variable:

```
set DCMTK_PATH=C:\Program Files\DCMTK\bin
```

**macOS:**

```bash
brew install dcmtk
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get install dcmtk
```

**Linux (RHEL/Fedora):**

```bash
sudo dnf install dcmtk
```

### Installing the Library

```bash
npm install dcmtk
```

or with pnpm:

```bash
pnpm add dcmtk
```

or with yarn:

```bash
yarn add dcmtk
```

---

## DICOM Glossary

If you are new to DICOM, here are the key terms you will encounter throughout this guide and the library:

| Term                | Definition                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **DICOM**           | Digital Imaging and Communications in Medicine -- the international standard for medical images and related information.              |
| **Tag**             | A numeric identifier for a data element in a DICOM file, written as two 4-digit hex groups, e.g., `(0010,0010)` for Patient Name.     |
| **VR**              | Value Representation -- the data type of a DICOM tag's value (e.g., `PN` for Person Name, `DA` for Date, `UI` for Unique Identifier). |
| **SOP Class**       | Service-Object Pair Class -- defines a type of DICOM object or service, such as CT Image Storage or MR Image Storage.                 |
| **Transfer Syntax** | The encoding rules for DICOM data, including byte ordering and compression (e.g., JPEG Lossless, Explicit VR Little Endian).          |
| **AE Title**        | Application Entity Title -- a 1-16 character identifier that names a DICOM node on a network.                                         |
| **SCP**             | Service Class Provider -- the server side in a DICOM network exchange.                                                                |
| **SCU**             | Service Class User -- the client side in a DICOM network exchange.                                                                    |
| **C-ECHO**          | A DICOM service for testing connectivity between two nodes (similar to a network ping).                                               |
| **C-STORE**         | A DICOM service for sending (storing) images or other objects from an SCU to an SCP.                                                  |
| **C-FIND**          | A DICOM service for querying an SCP for matching studies, series, or images.                                                          |
| **C-MOVE**          | A DICOM service for requesting an SCP to push images to a specified destination.                                                      |
| **C-GET**           | A DICOM service for pulling images directly from an SCP to the requesting SCU.                                                        |
| **DICOMDIR**        | A directory index file that catalogs DICOM objects stored on media (like a CD or USB drive).                                          |

---

## Quick Start

### Verify DCMTK Installation

Before using any tool, verify that DCMTK is correctly installed and detectable:

```typescript
import { findDcmtkPath } from 'dcmtk';

const result = findDcmtkPath();

if (result.ok) {
    console.log(`DCMTK found at: ${result.value}`);
} else {
    console.error('DCMTK not found:', result.error.message);
}
```

`findDcmtkPath` searches in this order:

1. The `DCMTK_PATH` environment variable
2. Platform-specific known install locations (e.g., `/usr/bin`, `C:\Program Files\DCMTK`)
3. The system PATH

The result is cached after the first successful call.

---

### Understanding the Result Type

Every fallible operation in this library returns a `Result<T>` instead of throwing exceptions. This is a discriminated union you must narrow before accessing the value or error:

```typescript
type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

**Pattern: Check `result.ok` before accessing properties**

```typescript
import { dcm2json } from 'dcmtk';

const result = await dcm2json('/path/to/image.dcm');

if (result.ok) {
    // TypeScript knows result.value exists here
    console.log('Patient data:', result.value.data);
} else {
    // TypeScript knows result.error exists here
    console.error('Failed:', result.error.message);
}
```

You can build helper functions to convert Results to exceptions when you prefer try/catch:

```typescript
function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: Error }): T {
    if (result.ok) {
        return result.value;
    }
    throw result.error;
}

// Usage -- throws on failure instead of requiring narrowing
const { data } = unwrap(await dcm2json('/path/to/image.dcm'));
```

---

### Validating a DICOM File

Check whether a file is a valid DICOM Part 10 file:

```typescript
import { dcmftest } from 'dcmtk';

const result = await dcmftest('/path/to/file.dcm');

if (result.ok) {
    console.log(result.value.isDicom ? 'Valid DICOM file' : 'Not a DICOM file');
} else {
    console.error('Test failed:', result.error.message);
}
```

---

### Reading DICOM Metadata

**Text dump with dcmdump:**

```typescript
import { dcmdump } from 'dcmtk';

const result = await dcmdump('/path/to/image.dcm');

if (result.ok) {
    console.log(result.value.text);
}
```

Search for a specific tag:

```typescript
const result = await dcmdump('/path/to/image.dcm', {
    searchTag: '(0010,0010)',
});

if (result.ok) {
    console.log('Patient Name entry:', result.value.text);
}
```

**JSON model with dcm2json:**

```typescript
import { dcm2json } from 'dcmtk';

const result = await dcm2json('/path/to/image.dcm');

if (result.ok) {
    const model = result.value.data;
    // Access tags by their 8-character hex key
    console.log('Patient Name:', model['00100010']);
    console.log('Study Date:', model['00080020']);
}
```

**Structured access with DicomDataset:**

```typescript
import { DicomDataset, dcm2json } from 'dcmtk';

const jsonResult = await dcm2json('/path/to/image.dcm');
if (!jsonResult.ok) {
    console.error(jsonResult.error.message);
    process.exit(1);
}

const dsResult = DicomDataset.fromJson(jsonResult.value.data);
if (dsResult.ok) {
    const ds = dsResult.value;

    // Convenience getters for common tags
    console.log('Patient Name:', ds.patientName);
    console.log('Patient ID:', ds.patientID);
    console.log('Modality:', ds.modality);
    console.log('Study Date:', ds.studyDate);

    // Generic accessors by tag
    console.log('Accession:', ds.getString('00080050'));

    // Check for tag presence
    console.log('Has pixel data:', ds.hasTag('7FE00010'));
}
```

---

### Converting DICOM Files

**Convert transfer syntax with dcmconv:**

```typescript
import { dcmconv, TransferSyntax } from 'dcmtk';

const result = await dcmconv('/path/to/input.dcm', '/path/to/output.dcm', {
    transferSyntax: TransferSyntax.EXPLICIT_LITTLE,
});

if (result.ok) {
    console.log(`Converted to: ${result.value.outputPath}`);
}
```

Available transfer syntax presets: `IMPLICIT_LITTLE`, `EXPLICIT_LITTLE`, `EXPLICIT_BIG`, `JPEG_LOSSLESS`, `JPEG2K_LOSSLESS`, `RLE`, `DEFLATED`.

**Convert a JPEG image to DICOM with img2dcm:**

```typescript
import { img2dcm } from 'dcmtk';

const result = await img2dcm('/path/to/photo.jpg', '/path/to/output.dcm', {
    inputFormat: 'jpeg',
});

if (result.ok) {
    console.log(`Created DICOM file: ${result.value.outputPath}`);
}
```

**Export a DICOM image as PNG with dcmj2pnm:**

```typescript
import { dcmj2pnm } from 'dcmtk';

const result = await dcmj2pnm('/path/to/image.dcm', '/path/to/image.png', {
    outputFormat: 'png',
});

if (result.ok) {
    console.log(`Exported to: ${result.value.outputPath}`);
}
```

---

### Modifying DICOM Files

**Low-level modification with dcmodify:**

```typescript
import { dcmodify } from 'dcmtk';

const result = await dcmodify('/path/to/image.dcm', {
    modifications: [
        { tag: '(0010,0010)', value: 'DOE^JOHN' },
        { tag: '(0010,0020)', value: 'PATIENT-001' },
    ],
});

if (result.ok) {
    console.log(`Modified: ${result.value.filePath}`);
}
```

Erase tags or private data:

```typescript
const result = await dcmodify('/path/to/image.dcm', {
    erasures: ['(0010,0010)', '(0010,0020)'],
    erasePrivateTags: true,
});
```

**High-level modification with ChangeSet and DicomFile:**

```typescript
import { DicomFile, ChangeSet, createDicomTagPath } from 'dcmtk';

// Open a DICOM file
const openResult = await DicomFile.open('/path/to/image.dcm');
if (!openResult.ok) {
    console.error(openResult.error.message);
    process.exit(1);
}

const file = openResult.value;

// Read the current patient name
console.log('Current patient:', file.dataset.patientName);

// Build an immutable set of changes
const changes = ChangeSet.empty()
    .setTag(createDicomTagPath('(0010,0010)'), 'ANONYMOUS')
    .setTag(createDicomTagPath('(0010,0020)'), 'ANON-001')
    .erasePrivateTags();

// Write changes to a new file (original is untouched)
const updated = file.withChanges(changes);
const writeResult = await updated.writeAs('/path/to/anonymized.dcm');

if (writeResult.ok) {
    console.log('Anonymized copy created');
}
```

Each call to `setTag`, `eraseTag`, or `erasePrivateTags` returns a new `ChangeSet` instance. The original is never modified.

---

### Network Operations

**Test connectivity with C-ECHO:**

```typescript
import { echoscu } from 'dcmtk';

const result = await echoscu({
    host: '192.168.1.100',
    port: 4242,
    calledAETitle: 'PACS_SCP',
    callingAETitle: 'MY_SCU',
});

if (result.ok) {
    console.log('PACS is reachable');
} else {
    console.error('Echo failed:', result.error.message);
}
```

**Send DICOM files with C-STORE:**

```typescript
import { storescu } from 'dcmtk';

const result = await storescu({
    host: '192.168.1.100',
    port: 4242,
    calledAETitle: 'PACS_SCP',
    files: ['/path/to/image1.dcm', '/path/to/image2.dcm'],
});

if (result.ok) {
    console.log('Files sent successfully');
} else {
    console.error('Send failed:', result.error.message);
}
```

**Query a PACS with C-FIND:**

```typescript
import { findscu, QueryModel } from 'dcmtk';

const result = await findscu({
    host: '192.168.1.100',
    port: 4242,
    calledAETitle: 'PACS_SCP',
    queryModel: QueryModel.STUDY,
    keys: [
        '0010,0020=PATIENT-001', // Patient ID
        '0008,0050=', // Accession Number (return all)
        '0008,0020=20240101-', // Study Date (from Jan 1, 2024)
    ],
});

if (result.ok) {
    console.log('Query completed');
} else {
    console.error('Query failed:', result.error.message);
}
```

---

### Running a Storage Server

Start a DICOM storage server that receives files over the network:

```typescript
import { Dcmrecv } from 'dcmtk';

const createResult = Dcmrecv.create({
    port: 4242,
    outputDirectory: './incoming',
    aeTitle: 'MY_SCP',
});

if (!createResult.ok) {
    console.error('Failed to create server:', createResult.error.message);
    process.exit(1);
}

const server = createResult.value;

// Listen for typed events
server.onEvent('ASSOCIATION_RECEIVED', data => {
    console.log(`Association from: ${data.callingAETitle}`);
});

server.onEvent('C_STORE_REQUEST', data => {
    console.log(`Receiving: ${data.sopClassUID}`);
});

server.onEvent('STORED_FILE', data => {
    console.log(`Saved: ${data.filename}`);
});

server.onEvent('ASSOCIATION_RELEASE', () => {
    console.log('Association released');
});

// Start listening
await server.start();
console.log('Server listening on port 4242');

// Later: graceful shutdown
// await server.stop();
```

For more advanced storage server options (e.g., custom transfer syntax negotiation, config file), use `StoreSCP`:

```typescript
import { StoreSCP } from 'dcmtk';

const createResult = StoreSCP.create({
    port: 11112,
    outputDirectory: './received',
    aeTitle: 'STORE_SCP',
});

if (createResult.ok) {
    const scp = createResult.value;

    scp.onEvent('STORING_FILE', data => {
        console.log(`Storing: ${data.filename}`);
    });

    await scp.start();
}
```

---

### Cancellation with AbortSignal

All tools and servers support cancellation via the standard `AbortController`:

```typescript
import { dcm2json } from 'dcmtk';

const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const result = await dcm2json('/path/to/large-file.dcm', {
    signal: controller.signal,
    timeoutMs: 60000,
});

if (!result.ok) {
    console.error('Aborted or failed:', result.error.message);
}
```

---

### Configuring Timeouts

Every tool accepts a `timeoutMs` option. The default is 30 seconds (30000 ms). For large files or slow networks, increase the timeout:

```typescript
import { storescu } from 'dcmtk';

const result = await storescu({
    host: '192.168.1.100',
    port: 4242,
    files: ['/path/to/large-study.dcm'],
    timeoutMs: 120000, // 2 minutes
});
```

---

### Branded Types

The library uses branded types to prevent accidental mix-ups of primitive values at compile time. A `Port` cannot be passed where an `AETitle` is expected, even though both are ultimately numbers and strings.

**Creating branded values:**

```typescript
import { createAETitle, createPort, createDicomTag, createDicomTagPath } from 'dcmtk';

const aeTitle = createAETitle('MY_SCP'); // type: AETitle
const port = createPort(4242); // type: Port
const tag = createDicomTag('00100010'); // type: DicomTag
const path = createDicomTagPath('(0010,0010)'); // type: DicomTagPath
```

**Validating untrusted input:**

The `create*` factory functions are unchecked -- they trust the caller. For runtime validation of user input, use the `parse*` functions, which return `Result<T>`:

```typescript
import { parseAETitle, parsePort } from 'dcmtk';

const aeResult = parseAETitle(userInput);
if (aeResult.ok) {
    console.log('Valid AE Title:', aeResult.value);
} else {
    console.error('Invalid AE Title:', aeResult.error.message);
}

const portResult = parsePort(userProvidedPort);
if (portResult.ok) {
    console.log('Valid port:', portResult.value);
}
```

---

## Error Handling

### Pattern: Explicit Result narrowing

This is the recommended approach. Check `result.ok` and handle both branches:

```typescript
import { dcm2json } from 'dcmtk';

const result = await dcm2json('/path/to/image.dcm');

if (result.ok) {
    // Use result.value safely
    console.log('Conversion source:', result.value.source);
    console.log('Tags:', Object.keys(result.value.data).length);
} else {
    // Handle the error
    console.error('Conversion failed:', result.error.message);
}
```

### Pattern: Early return on failure

When chaining multiple operations, return early on the first failure:

```typescript
import { dcm2json, DicomDataset, dcmodify } from 'dcmtk';

async function anonymizeFile(inputPath: string): Promise<void> {
    // Step 1: Read the file
    const jsonResult = await dcm2json(inputPath);
    if (!jsonResult.ok) {
        console.error('Read failed:', jsonResult.error.message);
        return;
    }

    // Step 2: Parse the dataset
    const dsResult = DicomDataset.fromJson(jsonResult.value.data);
    if (!dsResult.ok) {
        console.error('Parse failed:', dsResult.error.message);
        return;
    }

    console.log(`Anonymizing patient: ${dsResult.value.patientName}`);

    // Step 3: Apply modifications
    const modResult = await dcmodify(inputPath, {
        modifications: [
            { tag: '(0010,0010)', value: 'ANONYMOUS' },
            { tag: '(0010,0020)', value: 'ANON-001' },
        ],
        erasePrivateTags: true,
    });

    if (!modResult.ok) {
        console.error('Modify failed:', modResult.error.message);
        return;
    }

    console.log('Anonymization complete');
}
```

### Pattern: Collecting errors from multiple operations

```typescript
import { dcmftest } from 'dcmtk';

const files = ['/path/to/file1.dcm', '/path/to/file2.dcm', '/path/to/file3.dcm'];
const errors: string[] = [];

for (const file of files) {
    const result = await dcmftest(file);
    if (!result.ok) {
        errors.push(`${file}: ${result.error.message}`);
    } else if (!result.value.isDicom) {
        errors.push(`${file}: not a valid DICOM file`);
    }
}

if (errors.length > 0) {
    console.error('Validation errors:');
    for (const msg of errors) {
        console.error(`  - ${msg}`);
    }
}
```

---

## Troubleshooting

### "DCMTK binaries not found"

This means `findDcmtkPath` could not locate the DCMTK binaries. Check:

1. **Is DCMTK installed?** Run `dcmdump --version` in your terminal.
2. **Is `DCMTK_PATH` set?** Set it to the directory containing the DCMTK executables (e.g., `export DCMTK_PATH=/usr/local/bin`).
3. **Are the binaries on PATH?** Ensure the directory containing `dcmdump`, `dcm2json`, etc. is in your system PATH.
4. **On Windows:** Make sure you are pointing to the `bin` directory inside the DCMTK install folder.

### "Cannot listen on port"

When starting a server (`Dcmrecv`, `StoreSCP`):

- **Port already in use:** Another process is using the port. Choose a different port or stop the other process.
- **Insufficient permissions:** Ports below 1024 require elevated privileges on most systems. Use a port above 1024 (e.g., 4242, 11112).

### "Association rejected"

When using network tools (`echoscu`, `storescu`, `findscu`):

- **AE Title mismatch:** The remote SCP may require a specific Called AE Title. Set `calledAETitle` to match what the server expects.
- **Presentation context issues:** The remote SCP may not support the SOP Class or Transfer Syntax of your file.
- **Firewall blocking:** Ensure the target port is open and reachable.

### Timeout errors

- **Increase `timeoutMs`:** The default timeout is 30 seconds. Large files or slow networks may need longer.
- **Check network connectivity:** Ensure you can reach the target host and port.
- **Use AbortSignal for custom timeout logic:** See the cancellation section above.

### "Not a valid DICOM file"

- The file may not have a proper DICOM Part 10 header. Use `dcmftest` to check.
- Some older DICOM files use non-standard encoding. Try `dcmconv` to re-encode the file.
- Ensure you are not passing a non-DICOM file (e.g., a JPEG or PDF) to a tool expecting DICOM input.

---

## Import Reference

All exports are available from the root `'dcmtk'` import:

```typescript
// Core utilities
import { findDcmtkPath, ok, err, assertUnreachable } from 'dcmtk';
import type { Result } from 'dcmtk';

// Branded types and validation
import { createAETitle, createPort, createDicomTag, createDicomTagPath } from 'dcmtk';
import { parseAETitle, parsePort, parseDicomTag } from 'dcmtk';
import type { AETitle, Port, DicomTag, DicomTagPath } from 'dcmtk';

// Tool wrappers
import {
    dcm2json,
    dcmdump,
    dcmconv,
    dcmodify,
    dcmftest,
    img2dcm,
    dcmj2pnm,
    pdf2dcm,
    echoscu,
    storescu,
    findscu,
    movescu,
    getscu,
    dsrdump,
    dsr2xml,
} from 'dcmtk';

// Transfer syntax and query model constants
import { TransferSyntax, QueryModel } from 'dcmtk';

// DICOM data layer
import { DicomDataset, ChangeSet, DicomFile } from 'dcmtk';

// Server classes
import { Dcmrecv, StoreSCP, DcmprsCP, Dcmpsrcv } from 'dcmtk';

// DICOM dictionary and VR utilities
import { lookupTag, lookupTagByKeyword, VR, sopClassNameFromUID } from 'dcmtk';
```

---

## Next Steps

- **Full tool reference:** See the tool reference tables in [README.md](../README.md) for all 48 tool wrappers and 6 server classes.
- **API reference for AI tools:** See [AI_README.md](../AI_README.md) for a condensed API reference suitable for LLM context.
- **DCMTK documentation:** https://dicom.offis.de/dcmtk.php.en -- the upstream C++ toolkit documentation.
- **DICOM standard:** https://www.dicomstandard.org/ -- the official DICOM specification.
