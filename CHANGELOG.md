# Changelog

## [0.1.0] - Unreleased

### Added

- Core infrastructure: `Result<T, E>` pattern, branded types (`DicomTag`, `AETitle`, `Port`, etc.), Zod validation schemas
- Platform-aware DCMTK binary discovery via `DCMTK_PATH` env var or known install locations
- Process execution layer: `execCommand()` for short-lived tools, `spawnCommand()` for injection-safe modifications
- 48 short-lived tool wrappers covering all DCMTK command-line binaries:
    - Data & Metadata: `dcm2xml`, `dcm2json`, `dcmdump`, `dcmconv`, `dcmodify`, `dcmftest`, `dcmgpdir`, `dcmmkdir`
    - File Conversion: `xml2dcm`, `json2dcm`, `dump2dcm`, `img2dcm`, `pdf2dcm`, `dcm2pdf`, `cda2dcm`, `dcm2cda`, `stl2dcm`
    - Compression: `dcmcrle`, `dcmdrle`, `dcmencap`, `dcmdecap`, `dcmcjpeg`, `dcmdjpeg`
    - Image Processing: `dcmj2pnm`, `dcm2pnm`, `dcmscale`, `dcmquant`, `dcmdspfn`, `dcod2lum`, `dconvlum`
    - Network: `echoscu`, `dcmsend`, `storescu`, `findscu`, `movescu`, `getscu`, `termscu`
    - Structured Reports: `dsrdump`, `dsr2xml`, `xml2dsr`, `drtdump`
    - Presentation State & Print: `dcmpsmk`, `dcmpschk`, `dcmprscu`, `dcmpsprt`, `dcmp2pgm`, `dcmmkcrv`, `dcmmklut`
- 4 long-lived server classes with typed EventEmitter APIs:
    - `Dcmrecv` — DICOM receiver (C-STORE SCP)
    - `StoreSCP` — Storage SCP with advanced options
    - `DcmprsCP` — Print Management SCP
    - `Dcmpsrcv` — Viewer network receiver
- Event system with typed patterns for server output parsing (41 event patterns total)
- DICOM data layer:
    - `DicomDataset` — immutable dataset with typed accessors, path traversal, wildcard search
    - `ChangeSet` — immutable builder for tag modifications and erasures
    - `DicomFile` — file I/O facade (open, apply changes, write copies)
- DICOM metadata infrastructure:
    - 34 standard Value Representations with category metadata
    - 4,902-entry tag dictionary generated from DCMTK sources
    - SOP Class UID mappings
    - Tag path parsing and traversal utilities
- Full TypeScript with strict configuration, dual CJS/ESM build, complete `.d.ts` declarations
- AbortSignal support for cancellation across all async operations
- 1056 tests across 77 files with 99.42% statement coverage
