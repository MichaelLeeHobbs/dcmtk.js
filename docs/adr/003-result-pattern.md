# ADR-003: Result Pattern for Error Handling

## Status

Accepted

## Context

The coding standard (Rules 6.1, 6.2) mandates:

- `throw` reserved for unrecoverable panics only
- Functions that can fail return `Result<T, E>` forcing explicit handling

In a DCMTK wrapper library, many operations can fail in expected ways:

- DCMTK binary not found on the system
- DICOM file is malformed or missing
- Network peer is unreachable
- Process exits with non-zero code

These are expected failures, not exceptional circumstances.

## Decision

Implement a `Result<T, E>` discriminated union as the foundation error handling pattern:

```typescript
type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

With helper constructors `ok(value)` and `err(error)`.

All public API functions that can fail return `Result<T, E>`. `throw` is used only for programmer errors (assertion failures, exhaustive check violations).

## Consequences

- **Positive:** Error paths are type-safe and visible in function signatures.
- **Positive:** Consumers are forced to handle errors explicitly (no silent failures).
- **Positive:** No try/catch needed for expected failures; cleaner control flow.
- **Negative:** Slightly more verbose than throwing; every call site must check `.ok`.
- **Negative:** Cannot use native `async/await` error propagation; must explicitly propagate errors.
