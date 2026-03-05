# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-03-05

### Added

- **`handleSocket(socket)`** on `DicomReceiver` — route external `net.Socket` connections directly to idle workers, enabling protocol routers and custom TCP listeners
- **`port: 0` mode** — skip the built-in TCP proxy entirely when using `handleSocket()` exclusively
- **Event bubbling** — 4 new events on `DicomReceiver`, bubbled from Dcmrecv workers:
    - `ASSOCIATION_RECEIVED` — `{ associationId, callingAE, calledAE, source }`
    - `C_STORE_REQUEST` — `{ associationId, raw }` (per-file progress tracking)
    - `ECHO_REQUEST` — `{ associationId }` (monitoring)
    - `REFUSING_ASSOCIATION` — `{ reason }`
- **Passthrough options** on `DicomReceiver`: `acseTimeout`, `dimseTimeout`, `maxPdu` — forwarded to all Dcmrecv workers
- **Output capture** — `ASSOCIATION_COMPLETE` events now include `output: readonly string[]` with captured worker stdout/stderr lines (bounded at 500 per association)
- Convenience methods: `onAssociationReceived()`, `onCStoreRequest()`, `onEchoRequest()`, `onRefusingAssociation()`
- 4 new exported types: `PoolAssociationReceivedData`, `PoolCStoreRequestData`, `PoolEchoRequestData`, `PoolRefusingAssociationData`
- 31 new unit tests for DicomReceiver (1813 total across 100 test files)

### Changed

- `DicomReceiverOptions.port` now accepts `0` (previously required `>= 1`)
- Extracted `createDcmrecv()` helper to keep `spawnWorker()` within 40-line limit

## [0.4.0] - 2026-03-02

### Added

- **Verbosity control** on all 51 tool wrappers — `verbosity?: 'verbose' | 'debug'` maps to `-v`/`-d` flags for diagnostic output
- **Network resilience flags** on all 7 network tools (echoscu, storescu, findscu, movescu, getscu, termscu, dcmsend):
    - `maxPduReceive` / `maxPduSend` — PDU size control (`--max-pdu`, `--max-send-pdu`)
    - `associationTimeout` / `acseTimeout` / `dimseTimeout` — granular timeout control (`-to`, `-ta`, `-td`)
    - `noHostnameLookup` — DNS bypass for containerized environments (`-nh`)
- `storescu`: `noUidChecks` flag (`--no-uid-checks`) for files with non-standard UIDs
- `dcmcjpeg`: `progressive` flag (`+p`) for progressive JPEG compression
- `dcm2pnm`: feature parity with dcmj2pnm — `png16` format (`+on2`), `windowCenter`/`windowWidth` (`+Wl`), `dcm2img` binary fallback
- `dcmj2pnm`: 16-bit PNG format (`+on2`), `windowCenter`/`windowWidth` (`+Wl`), `dcm2img` binary fallback
- `dcmsend`: `acseTimeout`, `dimseTimeout`, stdout capture in result
- `dsrdump` / `dsr2xml`: `charsetAssume` option (`+Ca`) for SR files without Specific Character Set
- `typesVersions` in package.json for classic `moduleResolution: "Node"` compatibility
- 46 new tool wrapper test files (581 new tests, 1793 total across 100 test files)

### Changed

- `dcmsend`: migrated `verbose?: boolean` to `verbosity?: 'verbose' | 'debug'` (breaking for dcmsend users who passed `verbose: true`)
- Extracted `pushNetworkArgs` helpers in network tools and `pushDisplayArgs`/`pushLutArgs` in data tools to keep function complexity within ESLint limits

## [0.3.0] - 2026-03-01

### Added

- `DicomSender` — high-throughput DICOM sender with queuing, backpressure, and three sending modes:
    - `single` — one association at a time, FIFO queue
    - `multiple` — up to N concurrent `storescu` associations
    - `bucket` — accumulates files into buckets, flushed on timeout or max size
- Adaptive backpressure: HEALTHY → DEGRADED → DOWN state machine based on consecutive failures/successes, dynamically adjusts effective concurrency
- Automatic retry with exponential backoff on send failures
- Typed events: `SEND_COMPLETE`, `SEND_FAILED`, `HEALTH_CHANGED`, `BUCKET_FLUSHED`, `ERROR`
- `docs/senders.md` — full DicomSender documentation with usage examples, configuration reference, and backpressure explanation
- Example 08 (`examples/08-receive-modify-send/`) — receive, modify, and forward DICOM files via modality-based routing using DicomReceiver + DicomInstance + DicomSender

### Fixed

- AE Title validation now accepts all printable ASCII characters except backslash, per DICOM PS3.5 default character repertoire (previously only allowed letters, digits, spaces, and hyphens — rejected valid characters like underscore, dot, and special punctuation)

### Changed

- Updated CLAUDE.md with DicomSender architecture and API reference sections
- Updated README.md with DicomSender in server reference table and senders documentation link
- Updated examples/README.md with example 08 entry

## [0.2.0] - 2026-03-01

### Added

- `PoolStatus` named interface exported from DicomReceiver with TSDoc
- ADR-004 documenting DicomFile to DicomInstance rename decision
- Docker image reference in Getting Started and README (`michaelleehobbs/nodejs-dcmtk`)

### Changed

- Updated all dev dependencies to latest majors: ESLint 10, Vitest 4, @types/node 25, lint-staged 16, globals 17
- Fixed EventEmitter emit pattern across all 6 server classes for @types/node 25 compatibility
- Adjusted coverage thresholds for Vitest 4 v8 provider counting changes
- Rewrote CHANGELOG with accurate version history
- Updated README: added DicomReceiver to server table, complete feature list
- Updated GETTING_STARTED: fixed package names, added Docker section, accurate imports
- Fixed CODE_REVIEW_2 stale tool/server counts
- Updated CLAUDE.md with poolStatus documentation

## [0.1.5] - 2026-03-01

### Added

- `DicomReceiver` — pooled DICOM receiver managing multiple `Dcmrecv` workers behind a TCP proxy with auto-scaling between configurable `minPoolSize` and `maxPoolSize`
- `AssociationTracker` built into `Dcmrecv` and `StoreSCP` — automatically correlates received files to associations via `FILE_RECEIVED` and `ASSOCIATION_COMPLETE` events
- `DicomInstance` on `FILE_RECEIVED` events — received files are now wrapped as `DicomInstance` objects for immediate fluent access
- Transfer stats on `ASSOCIATION_COMPLETE` events — duration, file count, and byte totals

### Changed

- Removed `unwrap()` helper — all code now uses explicit `if (!result.ok)` narrowing for Result types
- Standardized validation errors across all 51 tools and 7 servers using `createValidationError()`
- Aligned `DicomReceiver` API with other server classes (`stop()` returns `Promise<void>`, typed `onEvent()` method)
- Updated TSDoc across public APIs

## [0.1.4] - 2026-02-28

### Changed

- Renamed `DicomFile` to `DicomInstance` — unified DICOM object with fluent API for reading, modifying, and writing
- Refactored `DicomInstance` internals: renamed private fields for clarity, improved import structure using barrel imports
- Updated all examples (01-06) to use `DicomInstance` fluent API and `AssociationTracker`

### Fixed

- `StoreSCP` file tracking now correctly correlates files to associations
- Fixed examples 02-06: corrected SR XML format, AE titles, config references, and sample file paths
- Fixed `ChangeSet` example: unwrap `createDicomTagPath` Result before use

## [0.1.3] - 2026-02-25

### Added

- `PacsClient` — high-level PACS client with `echo()`, `findStudies()`, `findSeries()`, `findImages()`, `findWorklist()`, `find()`, `retrieveStudy()`, `retrieveSeries()`, and `store()` methods
- 3 additional tool wrappers (48 to 51): `dcmqridx`, `dcmcjpls`, `dcmdjpls`
- `DicomInstance` integration tests
- 6 runnable example projects demonstrating common DCMTK workflows

### Changed

- Documentation overhaul: tiered docs structure with 12 new child documents
- Integrated `stderr-lib` for error normalization (Phase 8.3)
- Consolidated CI into a single Docker job running `test:all` (unit + integration + coverage)
- Replaced PacsClient mock tests with real integration tests against DcmQRSCP/StoreSCP

### Fixed

- All 67 code review findings resolved (62 fixed, 5 accepted)
- All integration test failures for DCMTK 3.7.0 compatibility
- C-MOVE retrieval no longer passes `outputDirectory` to `movescu`
- `dcmodify` now ignores missing tags on erase operations

## [0.1.2] - 2026-02-15

### Added

- `.gitattributes` to enforce LF line endings

### Changed

- Used Node.js 24 in publish workflow for npm Trusted Publishers (OIDC)

### Fixed

- Coverage thresholds adjusted for expanded test suite

## [0.1.1] - 2026-02-11

### Added

- Alpha preview warning to README

### Changed

- Prepared alpha release infrastructure for `@ubercode/dcmtk` on npm

## [0.1.0] - 2026-02-10

### Added

- Core infrastructure: `Result<T, E>` pattern with `ok()`, `err()`, `mapResult()` helpers — never throw for expected failures
- Branded types: `DicomTag`, `AETitle`, `Port`, `DicomTagPath`, `SOPClassUID`, `TransferSyntaxUID`, `DicomFilePath` with factory functions and Zod validation schemas
- Platform-aware DCMTK binary discovery via `DCMTK_PATH` env var or known install locations
- Process execution layer: `execCommand()` for short-lived tools, `spawnCommand()` for injection-safe modifications
- `DcmtkProcess` base class for long-lived processes (typed EventEmitter, Disposable pattern)
- 48 short-lived tool wrappers covering DCMTK command-line binaries:
    - Data & Metadata: `dcm2xml`, `dcm2json`, `dcmdump`, `dcmconv`, `dcmodify`, `dcmftest`, `dcmgpdir`, `dcmmkdir`
    - File Conversion: `xml2dcm`, `json2dcm`, `dump2dcm`, `img2dcm`, `pdf2dcm`, `dcm2pdf`, `cda2dcm`, `dcm2cda`, `stl2dcm`
    - Compression: `dcmcrle`, `dcmdrle`, `dcmencap`, `dcmdecap`, `dcmcjpeg`, `dcmdjpeg`
    - Image Processing: `dcmj2pnm`, `dcm2pnm`, `dcmscale`, `dcmquant`, `dcmdspfn`, `dcod2lum`, `dconvlum`
    - Network: `echoscu`, `dcmsend`, `storescu`, `findscu`, `movescu`, `getscu`, `termscu`
    - Structured Reports: `dsrdump`, `dsr2xml`, `xml2dsr`, `drtdump`
    - Presentation State & Print: `dcmpsmk`, `dcmpschk`, `dcmprscu`, `dcmpsprt`, `dcmp2pgm`, `dcmmkcrv`, `dcmmklut`
- 6 long-lived server classes with typed EventEmitter APIs:
    - `Dcmrecv` — DICOM receiver (C-STORE SCP)
    - `StoreSCP` — Storage SCP with advanced options
    - `DcmQRSCP` — Query/Retrieve SCP (C-FIND/C-MOVE/C-GET)
    - `Wlmscpfs` — Worklist Management SCP
    - `DcmprsCP` — Print Management SCP
    - `Dcmpsrcv` — Viewer network receiver
- Event system with typed patterns for server output parsing (41 event patterns across 4 server types)
- DICOM data layer:
    - `DicomDataset` — immutable dataset with typed accessors, path traversal, wildcard search, convenience getters
    - `ChangeSet` — immutable builder for tag modifications and erasures
    - `DicomInstance` — unified DICOM object with fluent API (open, modify, write, metadata)
- DICOM metadata infrastructure:
    - 34 standard Value Representations with category metadata
    - 4,902-entry tag dictionary generated from DCMTK sources
    - SOP Class UID to name mappings
    - Tag path parsing and traversal utilities
    - XML-to-JSON conversion for DCMTK output
- Utility functions: `batch()` for parallel processing with concurrency control, `retry()` with exponential backoff
- Full TypeScript with maximum strict configuration, dual CJS/ESM build, complete `.d.ts` declarations
- AbortSignal support for cancellation across all async operations
- Configurable timeouts on all async operations
- 1071 tests across 49 unit/fuzz/edge-case test files with 99%+ statement coverage
- 44 integration test files covering real DCMTK binary interactions
- CI/CD pipeline with lint, typecheck, test, build, and audit stages
- npm publishing via Trusted Publishers (OIDC) under `@ubercode/dcmtk`
