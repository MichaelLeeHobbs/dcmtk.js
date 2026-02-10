# Integration Test Plan for dcmtk.js

## Overview

All existing tests are unit tests with mocked `exec`/`spawn` — they never call real DCMTK binaries. Integration tests execute real DCMTK binaries against real DICOM files to catch flag mismatches, output format changes, and version-specific behavior.

## Running

```bash
pnpm run test:integration   # Requires DCMTK installed
pnpm run test               # Unit tests (always pass, no DCMTK needed)
```

## Structure

```
test/integration/
  helpers/        — Shared test infrastructure
  tools/          — Phase 1-2: read-only + transformation tools
  dicom/          — Phase 3: DicomDataset, DicomFile, ChangeSet
  servers/        — Phase 4: server lifecycle
  network/        — Phase 5-6: send/receive + query/retrieve
  workflows/      — Phase 7: end-to-end multi-tool workflows
```

## Design Decisions

- **`describe.skipIf(!dcmtkAvailable)`** — CI without DCMTK skips gracefully
- **Serial execution** — `singleFork: true` prevents port conflicts
- **120s test timeout** — generous for slow DICOM operations
- **No coverage thresholds** — integration tests don't count toward unit coverage
- **Temp directory per suite** — `beforeAll` creates, `afterAll` removes
- **No mocking** — all imports are real, calls hit real binaries
