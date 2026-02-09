# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dcmtk is a modern TypeScript library wrapping all 60+ DCMTK (DICOM Toolkit) C++ command-line binaries with type-safe APIs. Built to the standards defined in `docs/TypeScript Coding Standard for Mission-Critical Systems.md`. **Requires DCMTK installed on the system** (detected via `DCMTK_PATH` env var or known install locations).

The full build plan is in `PLAN.md`. This project is being rewritten from the ground up in TypeScript (Phases 1-2 complete).

## Commands

```bash
pnpm run test                # Run all tests
pnpm run test:coverage       # Run tests with coverage (95% threshold enforced)
pnpm run test:watch          # Run tests in watch mode
pnpm run lint                # Lint with --max-warnings 0
pnpm run lint:fix            # Lint and auto-fix
pnpm run format              # Format with Prettier
pnpm run format:check        # Check formatting
pnpm run typecheck           # TypeScript type checking (tsc --noEmit)
pnpm run build               # Build with tsup (CJS + ESM + DTS)
pnpm run clean               # Remove dist/ and coverage/
pnpm run dry-run             # npm pack --dry-run to verify package contents
```

## Code Style

- Semicolons required
- Single quotes
- 4-space indentation
- Max line length: 160 characters
- Trailing commas (es5)
- LF line endings
- Arrow parens: avoid for single params
- Prettier formats all code; ESLint enforces mission-critical rules

## Governing Standards

All code **shall** comply with `docs/TypeScript Coding Standard for Mission-Critical Systems.md`. Key rules:

- **No `any`** (Rule 3.2) — use `unknown` + type guards
- **No traditional enums** (Rule 3.5) — use `as const` objects + union types
- **No recursion** (Rule 8.2) — use iterative algorithms with bounded loops
- **Result pattern** (Rule 6.2) — functions that can fail return `Result<T, E>`, never throw for expected failures
- **Branded types** (Rule 7.3) — domain primitives like `DicomTag`, `AETitle`, not raw strings
- **Immutability** (Rule 7.1) — `readonly` by default, explicit mutations via ChangeSet
- **Mandatory timeouts** (Rule 4.2) — all async operations have configurable timeouts
- **95% coverage** (Rule 9.1) — enforced by vitest config
- **Exhaustive switches** (Rule 8.3) — `default: assertUnreachable(x)` in all switch statements
- **Functions <= 40 lines** (Rule 8.4) — warn, with skip for blank lines and comments
- **TSDoc on all public APIs** (Rule 10.1)

## Architecture

### Current State (Phase 2 — Core Infrastructure Complete)

- `src/types.ts` — `Result<T, E>`, `ok()`, `err()`, `assertUnreachable()`, `DcmtkProcessResult`, `ExecOptions`, `SpawnOptions`, `ProcessLine`
- `src/brands.ts` — Branded types: `DicomTag`, `AETitle`, `DicomTagPath`, `SOPClassUID`, `TransferSyntaxUID`, `DicomFilePath`, `Port` + factory functions
- `src/constants.ts` — Timeouts, PDU sizes, platform paths, required binaries, buffer limits
- `src/validation.ts` — Zod schemas + parse functions bridging to branded types
- `src/findDcmtkPath.ts` — Platform-aware DCMTK binary discovery with caching
- `src/exec.ts` — `execCommand()` + `spawnCommand()` for short-lived processes
- `src/DcmtkProcess.ts` — Base class for long-lived processes (typed EventEmitter, Disposable)
- `src/parsers/EventPattern.ts` — Pattern interface definitions
- `src/parsers/LineParser.ts` — Line-by-line output parser with multi-line block support
- `src/index.ts` — barrel export for all Phase 2 modules

### Target Architecture (see PLAN.md)

- **Short-lived tools**: Pure async functions returning `Result<T>` (one per DCMTK binary)
- **Long-lived servers**: Classes extending `DcmtkProcess` with typed EventEmitter, Disposable
- **DICOM data layer**: Immutable `DicomDataset` + explicit `ChangeSet` + `DicomFile` I/O
- **Branded types**: `DicomTag`, `AETitle`, `Port`, `DicomTagPath`, `SOPClassUID`, `DicomFilePath`

### Toolchain

- **TypeScript** 5.8+ with `erasableSyntaxOnly`, maximum strictness (`tsconfig.json`)
- **tsup** for dual CJS+ESM build with DTS generation (`tsup.config.ts`, uses `tsconfig.build.json`)
- **Vitest** for testing with v8 coverage (`vitest.config.ts`)
- **ESLint 9** flat config with typescript-eslint type-checked rules (`eslint.config.mjs`)
- **Prettier** for formatting (`.prettierrc`)
- **Husky** + **lint-staged** for pre-commit hooks
- **pnpm** as package manager

## Test Layout (Hybrid)

- **Colocated unit tests** in `src/` (e.g., `src/types.test.ts` next to `src/types.ts`)
- **Fuzz/integration/type tests** in `test/` (planned, not yet created)
- Test files excluded from build via `tsconfig.build.json`
- Only `dist/` ships in the npm package

## Key Files

| File                                                              | Purpose                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PLAN.md`                                                         | Full multi-phase build plan                                                                   |
| `docs/TypeScript Coding Standard for Mission-Critical Systems.md` | Governing coding standard                                                                     |
| `docs/adr/`                                                       | Architecture Decision Records                                                                 |
| `_configs/`                                                       | DCMTK config files preserved from old project (to be incorporated as `src/data/` in Phase 3+) |
| `dicomSamples/`                                                   | Sample .dcm files for future integration tests                                                |
