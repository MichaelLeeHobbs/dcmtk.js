# ADR 006: Pure-JS DICOM parsing (`dicom2json`)

## Status

Accepted (2026-07-22)

## Context

`dcm2json()` converted DICOM files to the DICOM JSON Model by spawning DCMTK binaries with a
two-phase strategy: `dcm2xml` → XML → JSON (primary, for charset handling), falling back to the
`dcm2json` binary (historically buggy — hangs on compressed pixel data). This produced a
production incident ([#30](https://github.com/MichaelLeeHobbs/dcmtk.js/issues/30)): under CPU
throttling, dcm2xml consumed the entire timeout budget (a 591KB dose SR emits 3.2MB of XML), the
fallback ran with a hardcoded 1000ms floor, timed out, and its error masked the real cause.
Instances were dropped after the C-STORE had been ACKed.

Reordering the phases (dcm2json binary first) was rejected: the direct binary is the less
trustworthy of the two. Instead, this ADR moves parsing into the process.

## Decision

Add `dicom2json`, a pure-JS parser, and make it the default engine for `DicomInstance.open`,
`DicomReceiver` instance parsing, and `PacsClient` result parsing. Deprecate `dcm2json` but keep
it exported, and use it as an automatic fallback (`dcmtkFallback: true`) from the high-level APIs.

- **Tokenizer: `dicom-parser` 1.8.21** (Cornerstone/OHIF ecosystem; zero dependencies; proven in
  production healthcare use). Rejected alternatives: `dcmjs` (its own long bug history plus heavy
  naturalization we don't need), hand-rolled parser (largest effort and validation burden).
- **Two layers of our own on top:**
    - `_p10ToJson` — element walk → DICOM JSON Model (PS3.18 F.2), matching the shape the dcm2xml
      path produced (PN component groups, numeric VR coercion, bare `{vr}` for bulk binary).
      Sequence traversal is iterative (Rule 8.2). Implicit VR resolves through our 4,902-entry
      dictionary via dicom-parser's `vrCallback`. Deflated transfer syntax inflates via `node:zlib`.
    - `_charset` — SpecificCharacterSet decoding via Node's `TextDecoder`/`Buffer`: all single-byte
      ISO_IR sets, UTF-8, GB18030/GBK, Shift_JIS, and ISO 2022 escape switching for the common CJK
      cases (IR 13/87, IR 149, IR 58). Values are decoded before multi-value/PN splitting, which
      sidesteps delimiter-byte collisions inside multi-byte encodings.

## Verification

- Differential integration suite: tag-for-tag agreement with the dcm2xml path across all 198
  sample files (private tags and group 0002 excluded — see below). Performance gate: ≥5x faster
  (measured ~75x: 1.4ms vs 104ms per file).
- Charset fixtures validated against the DICOM PS3.5 Annex H/I/J examples.

## Consequences

- The #30 failure mode is structurally eliminated for the default path: no subprocess, no shared
  CPU burn, no budget-splitting between phases. The legacy path's floor bug is fixed independently.
- Two deliberate output differences, both verified against `dcmdump` ground truth:
    - Group 0002 (file meta) is included → `DicomDataset.transferSyntaxUID` now works.
    - Private tags keep their real block numbers. dcm2xml **renumbers private blocks** (e.g.
      `(0019,1030)` → `(0019,0030)`), sometimes overwriting the private-creator slot — the old
      output was lossy for private data.
- Known limitation: explicit-VR `SV`/`UV`/`OV` files (rare) fail to tokenize in `dicom-parser`;
  the automatic DCMTK fallback covers them. Implicit VR is unaffected.
- `dicom-parser` is essentially finished software (slow release cadence). Acceptable: the format
  is stable, the dependency is zero-deps, and the fallback path remains.
