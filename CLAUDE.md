# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dcmtk.js is a Node.js wrapper around DCMTK (DICOM Toolkit) C++ command-line utilities. It spawns DCMTK binaries as child processes and provides a JavaScript API for DICOM file conversion, network operations, and data manipulation. **Requires DCMTK installed on the system** (detected via `DCMTK_PATH` env var or known install locations).

This project is a WIP that was started in 2021 and is incomplete. Key areas still in development include `DicomObject`, `DicomElement`, and `DicomDictionary` classes in `src/dcmdata/`.

## Commands

```bash
yarn test                    # Run all tests with coverage
npx jest path/to/test.js     # Run a single test file
npx jest --testPathPattern="DCM2JSON"  # Run tests matching a pattern
npx eslint src/              # Lint source files
```

## Code Style

- No semicolons
- Single quotes
- 2-space indentation
- Max line length: 160 characters
- camelCase naming
- 1TBS brace style
- No spaces inside object braces: `{foo}` not `{ foo }`
- JavaScript private class fields (`#field`) used extensively for encapsulation
- ESLint enforces max function depth of 3 and max 30 statements per function

## Architecture

### Core Pattern: DCMProcess → Child Process Spawning

`DCMProcess` (extends `EventEmitter`) is the base class. It manages spawning DCMTK binaries via `child_process.spawn()` / `exec()` and uses `tree-kill` for cleanup. All DCMTK wrapper classes inherit from it:

```
DCMProcess
├── EchoSCU      (C-ECHO client)
├── StoreSCP     (Storage server)
├── StoreSCU     (Storage client)
├── DCMSend      (DICOM sender)
├── DCMRecv      (DICOM receiver)
└── DCM2XML      (DICOM→XML conversion)
```

Some wrappers (`dcm2json.js`, `dcm2xml.js`, `dcmconv.js`, `dcmdump.js`, `dcmodify.js`) are standalone functions rather than classes.

### Stream Parsing Pipeline

DCMTK binaries produce verbose stdout/stderr output. The parsing system processes this into structured events:

1. **DCMTKParser** (`src/parsers/DCMTKParser.js`) — buffers raw output, splits by newline, matches against event patterns
2. **DCMTKEvent** (`src/parsers/DCMTKEvent.js`) — defines a single parseable pattern (regex + processor function), supports both single-line and multi-line block parsing (with header/footer markers and 1s timeout)
3. **Event definitions** (`src/events/index.js`) — 90+ predefined regex patterns for DCMTK output (association events, DIMSE messages, status updates, etc.)

Parsed results are emitted as events on the DCMProcess instance.

### DICOM Data Layer (WIP)

- **DicomObject** (`src/dcmdata/DicomObject.js`) — wraps parsed DICOM data, tracks modifications/inserts, supports nested tag path access like `(0040,0275).(0008,1110).(0008,1155)[0]`
- **DicomElement** (`src/dcmdata/DicomElement.js`) — represents individual DICOM elements with VR-aware handling
- **DicomDictionary** (`src/dcmdata/DicomDictionary.js`) — tag lookup from `src/configs/dicom.dic.json`
- **VR_DEFINITIONS** (`src/dcmdata/VR_DEFINITIONS.js`) — DICOM Value Representation type definitions (27+ types with validators)

### Platform Detection

`src/findDCMTK.js` locates DCMTK binaries cross-platform. On Windows, appends `.exe`. Sets `process.env.DCMTK_*` for each discovered binary (60+ tools).

## Test Structure

- `tests/dcmdata/` — conversion tests (DCM2JSON, DCM2XML, DicomObject)
- `tests/dcmnet/` — network operation integration tests (require DCMTK binaries)
- `tests/parsers/` — unit tests for output parsers
- `tests/manual/` — exploratory/manual tests (not run by `yarn test`)
- `dicomSamples/` — sample `.dcm` files used by tests
- Test output written to `output/tests/`
