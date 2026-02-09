# ADR-005: Hybrid Test Layout

## Status

Accepted

## Context

Two common test layout approaches exist:

1. **Separate test directory**: All tests in `test/` or `tests/` mirroring the `src/` structure.
2. **Colocated tests**: Test files next to their source files (e.g., `src/types.test.ts` alongside `src/types.ts`).

Neither approach alone fits all test categories:

- Unit tests map 1:1 to source files and benefit from colocation.
- Fuzz tests, integration tests, and type-level tests span multiple modules and don't map to a single source file.

## Decision

Use a hybrid layout:

- **Colocated unit tests** (`src/**/*.test.ts`): Each source file's unit test lives beside it.
- **Separate fuzz/integration/type tests** (`test/`): Tests that span modules or require special infrastructure live in top-level directories.

Build exclusion is handled at multiple levels:

- `tsconfig.json` excludes `**/*.test.ts` from compilation
- `tsup` bundles from `src/index.ts` via tree-shaking, never touching test files
- `package.json` `files` field ships only `dist/`

## Consequences

- **Positive:** Zero navigation friction for unit tests; test is always adjacent to source.
- **Positive:** Moving/renaming a file keeps its test with it.
- **Positive:** Missing tests are immediately visible (no corresponding `.test.ts` file).
- **Positive:** Fuzz and integration tests get their own structure without cluttering source.
- **Negative:** `src/` directory contains non-shipping files (test files), which may be unexpected.
