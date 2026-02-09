# ADR-001: TypeScript Rewrite

## Status

Accepted

## Context

dcmtk.js was started in 2021 as a vanilla JavaScript project with Babel transpilation. The codebase was never completed and has accumulated technical debt:

- No type safety (vanilla JS with JSDoc comments)
- Babel toolchain adds complexity without benefit for a Node.js library
- Jest configuration with Babel transforms is fragile
- No compile-time guarantees for the DICOM data layer, which handles complex nested structures

The project wraps DCMTK for healthcare/DICOM workflows, where correctness is critical.

## Decision

Rewrite the library from scratch in TypeScript with maximum compiler strictness (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`). Delete all existing JS source files; git history serves as reference.

## Consequences

- **Positive:** Compile-time type safety, better IDE support, self-documenting APIs via type declarations, alignment with the mission-critical coding standard.
- **Positive:** Clean slate eliminates accumulated patterns that don't fit the target architecture (mutable DicomObject, class-based tool wrappers).
- **Negative:** All existing code is discarded. Any working functionality must be reimplemented.
- **Negative:** Contributors must know TypeScript.
