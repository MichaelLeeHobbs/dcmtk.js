# dcmtk.js — Library Build Plan

## Vision

A modern, mission-critical TypeScript library wrapping all 60+ DCMTK (DICOM ToolKit) command-line binaries with type-safe APIs. Built to the standards defined in `docs/TypeScript Coding Standard for Mission-Critical Systems.md` — this is healthcare software and we treat it accordingly.

Modeled after the production-proven architectural patterns in d-dart, with the library packaging quality of stderr-lib.

**Package name:** `dcmtk` (npm)

**Governing document:** `docs/TypeScript Coding Standard for Mission-Critical Systems.md` — all code shall comply.

---

## Phase 1: Modern Library Scaffold

**Goal:** Replace the current vanilla JS + Babel setup with a modern TypeScript library foundation. No business logic — just a skeleton that builds, lints, tests, and publishes correctly. Every config enforces the coding standard from day one.

### 1.1 Initialize TypeScript Project

- [x] Remove `.babelrc` and all `@babel/` devDependencies
- [x] Create `tsconfig.json` with **maximum strictness** per Rule 3.1:

```jsonc
{
    "compilerOptions": {
        // Rule 3.1: Maximum strictness
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "strictBindCallApply": true,
        "strictPropertyInitialization": true,
        "noImplicitThis": true,
        "useUnknownInCatchVariables": true,
        "noUncheckedIndexedAccess": true,
        "exactOptionalPropertyTypes": true,
        "noFallthroughCasesInSwitch": true,
        "noImplicitReturns": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "allowUnusedLabels": false,
        "allowUnreachableCode": false,
        // Rule 3.5: No traditional enums
        "erasableSyntaxOnly": true,
        // Build output
        "target": "ESNext",
        "module": "ESNext",
        "lib": ["ESNext"],
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "moduleResolution": "node",
        "allowSyntheticDefaultImports": true,
        // Rule 3.1: skipLibCheck false for full checking
        "skipLibCheck": false,
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "coverage", "**/*.test.ts"],
}
```

- [x] Create `tsconfig.build.json` (extends base, `composite: false` for tsup)
- [x] Create `tsconfig.test.json` (includes `src/**/*` and `test/**/*`, relaxes `noUnusedLocals` for test files)

### 1.2 Configure tsup (Bundler)

- [x] Install tsup
- [x] Create `tsup.config.ts`:
    - Entry: `src/index.ts`
    - Dual format: ESM + CJS
    - `dts: true`, `sourcemap: true`, `clean: true`
    - `treeshake: true`, `splitting: false`, `minify: false`
    - Target: `es2020`
    - `shims: true`

### 1.3 Configure package.json

- [x] Rewrite `package.json`:
    - `name`: `dcmtk`
    - `main`: `dist/index.js` (CJS)
    - `module`: `dist/index.mjs` (ESM)
    - `types`: `dist/index.d.ts`
    - `sideEffects: false`
    - Conditional `exports` map (`types` → `import` → `require`)
    - `files`: `["dist", "README.md", "LICENSE"]`
    - `engines`: `{ "node": ">=20" }` (per Rule 3.0: Node.js 20+)
    - `publishConfig`: `{ "access": "public" }`
- [x] Scripts:
    - `build`, `build:watch` (tsup)
    - `test`, `test:coverage`, `test:watch` (vitest)
    - `lint`, `lint:fix` (eslint with `--max-warnings 0` per Rule 3.3)
    - `format`, `format:check` (prettier)
    - `typecheck` (tsc --noEmit)
    - `clean` (rimraf dist coverage)
    - `prepare` (husky)
    - `prepublishOnly` (clean → build → lint:fix → test:coverage)
    - `preversion`, `postversion`, `version:major/minor/patch`
    - `dry-run` (npm pack --dry-run)
- [x] `lint-staged` config
- [x] Switch from yarn to pnpm

### 1.4 Configure ESLint (Flat Config) — Per Rules 3.3, 3.2, 4.1

- [x] Remove old `.eslintrc`
- [x] Create `eslint.config.mjs` (ESLint 9+ flat config):
    - `@eslint/js` recommended
    - `typescript-eslint` recommended + type-checked rules
    - `eslint-plugin-prettier` + `eslint-config-prettier`
    - **Mission-critical rules:**
        ```
        @typescript-eslint/no-explicit-any: error          // Rule 3.2
        @typescript-eslint/no-floating-promises: error      // Rule 4.1
        @typescript-eslint/no-misused-promises: error       // Rule 4.1
        @typescript-eslint/explicit-function-return-type: error  // Explicitness
        @typescript-eslint/no-unused-vars: [error, { argsIgnorePattern: "^_" }]
        @typescript-eslint/no-unnecessary-type-assertion: error
        @typescript-eslint/prefer-ts-expect-error: error
        no-console: [warn, { allow: ["warn", "error"] }]
        max-lines-per-function: [warn, { max: 40, skipBlankLines: true, skipComments: true }]  // Rule 8.4
        complexity: [error, 10]                            // Rule 8.4
        max-len: [error, { code: 160 }]
        max-params: [warn, 4]                              // Rule 8.4
        ```
    - `parserOptions.project: ./tsconfig.json` (enables type-aware rules)

### 1.5 Configure Prettier

- [x] Create `.prettierrc`:
    ```json
    {
        "printWidth": 160,
        "singleQuote": true,
        "trailingComma": "es5",
        "semi": true,
        "arrowParens": "avoid",
        "bracketSpacing": true,
        "tabWidth": 4,
        "endOfLine": "lf"
    }
    ```
- [x] Create `.prettierignore`

### 1.6 Configure EditorConfig

- [x] Update `.editorconfig`:
    - LF line endings
    - 4-space indent for TS/JS
    - 2-space indent for JSON/YAML
    - UTF-8, final newline

### 1.7 Configure Vitest

- [x] Install `vitest`
- [x] Create `vitest.config.ts`:

    ```typescript
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
        test: {
            globals: true,
            environment: 'node',
            testTimeout: 60_000,
            coverage: {
                provider: 'v8',
                reporter: ['text', 'lcov', 'json-summary'],
                include: ['src/**/*.ts'],
                exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/index.ts'],
                thresholds: {
                    branches: 95, // Rule 9.1: ≥95% branch coverage
                    functions: 95,
                    lines: 95,
                    statements: 95,
                },
            },
            // Hybrid test layout: unit tests colocated in src/, fuzz + integration in test/
            include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        },
    });
    ```

- [x] Remove old `jest.config.js`

### 1.8 Configure Git Hooks — Per Rule 3.3, Appendix A

- [x] Install husky + lint-staged
- [x] `.husky/pre-commit`:
    ```bash
    npx lint-staged
    ```
- [x] `.husky/pre-push`:
    ```bash
    pnpm run typecheck
    pnpm run test
    ```
- [x] lint-staged config:
    ```json
    {
        "*.{ts,tsx,js,jsx}": ["eslint --fix --max-warnings 0", "prettier --write"],
        "*.{json,md,yml,yaml}": ["prettier --write"]
    }
    ```

### 1.9 Update .gitignore

- [x] Comprehensive `.gitignore` (dist, coverage, .idea, .DS_Store, .env, \*.tgz, node_modules, etc.)

### 1.10 Scaffold Core Files

- [x] Create `src/index.ts` — placeholder export
- [x] Create `src/types.ts` — `Result` type and `assertUnreachable` helper (the foundation for Rule 6.2):

    ```typescript
    export type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

    export function ok<T>(value: T): Result<T, never> {
        return { ok: true, value };
    }

    export function err<E>(error: E): Result<never, E> {
        return { ok: false, error };
    }

    export function assertUnreachable(x: never): never {
        throw new Error(`Exhaustive check failed: ${JSON.stringify(x)}`);
    }
    ```

- [x] Create first test: `src/types.test.ts` — validates Result helpers (colocated per hybrid layout)
- [x] Run full pipeline: `build → lint → test → typecheck` — all green before proceeding

### 1.11 Clean Up Old Files

- [x] Move old JS source to `_legacy/` branch or delete entirely (this is a clean rewrite)
- [x] Remove `src/dcmdata/dcm2xml.js.old`
- [x] Remove yarn.lock
- [x] Remove all Babel dependencies
- [x] Remove old `tests/` directory

### 1.12 Initialize docs/adr/ — Per Rule 10.2

- [x] Create `docs/adr/001-typescript-rewrite.md` — documents decision to rewrite from JS
- [x] Create `docs/adr/002-vitest-over-jest.md` — documents testing framework choice
- [x] Create `docs/adr/003-result-pattern.md` — documents error handling strategy
- [x] Create `docs/adr/005-hybrid-test-layout.md` — documents colocated unit tests + separate fuzz/integration/type tests

---

## Phase 2: Core Infrastructure

**Goal:** Build the foundational modules that everything else depends on. All code from this phase forward follows the coding standard strictly.

### 2.1 Branded Types & Domain Primitives — Per Rule 7.3

- [x] Create `src/brands.ts` — branded types that prevent primitive misuse:

    ```typescript
    declare const __brand: unique symbol;
    type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

    /** A validated DICOM tag string, e.g. "(0010,0010)" */
    export type DicomTag = Brand<string, 'DicomTag'>;

    /** A validated AE Title (1-16 alphanumeric + hyphen chars) */
    export type AETitle = Brand<string, 'AETitle'>;

    /** A validated DICOM tag path, e.g. "(0040,A730)[0]->(0010,0010)" */
    export type DicomTagPath = Brand<string, 'DicomTagPath'>;

    /** A validated SOP Class UID */
    export type SOPClassUID = Brand<string, 'SOPClassUID'>;

    /** A validated Transfer Syntax UID */
    export type TransferSyntaxUID = Brand<string, 'TransferSyntaxUID'>;

    /** A validated filesystem path to a DICOM file */
    export type DicomFilePath = Brand<string, 'DicomFilePath'>;

    /** A validated network port number (1-65535) */
    export type Port = Brand<number, 'Port'>;
    ```

- [x] Factory functions for each branded type return `Result<BrandedType>` with validation
- [x] Tests with valid/invalid inputs (40 tests in `src/brands.test.ts`)

### 2.2 Shared Types & Constants

- [x] Create `src/types.ts` (expand from Phase 1.10):
    - `Result<T, E>`, `ok()`, `err()`, `assertUnreachable()`
    - Process result types (readonly, immutable per Rule 7.1):
        ```typescript
        interface DcmtkProcessResult {
            readonly stdout: string;
            readonly stderr: string;
            readonly exitCode: number;
        }
        ```
    - Event data types using discriminated unions (Rule 8.3)
    - Common options interface (≤ 4 params, use options object per Rule 8.4)
- [x] Create `src/constants.ts`:
    - Default timeouts (as `as const` objects, never enums — Rule 3.5)
    - PDU sizes
    - Platform-specific known paths
    - Max bounds for loops/buffers (Rule 8.1)

### 2.3 Runtime Validation — Per Rule 7.2

- [x] Create `src/validation.ts` — Zod schemas for all boundary inputs:

    ```typescript
    import { z } from 'zod';

    export const AETitleSchema = z
        .string()
        .min(1)
        .max(16)
        .regex(/^[A-Za-z0-9\-]+$/);

    export const PortSchema = z
        .number()
        .int()
        .min(1)
        .max(65535);

    export const DicomTagSchema = z
        .string()
        .regex(/^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/);

    export const DicomTagPathSchema = z
        .string()
        .min(1);
        // Full regex validation in tagPath module

    // Each schema has a corresponding parse function returning Result<T>
    export function parseAETitle(input: unknown): Result<AETitle> { ... }
    export function parsePort(input: unknown): Result<Port> { ... }
    ```

- [x] All external inputs validated at module boundaries; internal code trusts branded types
- [x] Tests (24 tests in `src/validation.test.ts`)

### 2.4 findDcmtkPath

- [x] Create `src/findDcmtkPath.ts`
- [x] Platform-aware search (Windows: chocolatey, Program Files; Unix: /usr/local/bin, /usr/bin, /opt/local/bin)
- [x] Environment variable override: `DCMTK_PATH`
- [x] Validate required binaries exist (dcm2json, dcm2xml, dcmodify, dcmdump, dcmrecv, dcmsend, echoscu)
- [x] Cache result after first call (with `noCache` option)
- [x] Returns `Result<string>` — never throws for expected failures (Rule 6.1)
- [x] Throws only on truly unrecoverable scenarios (filesystem inaccessible)
- [x] TSDoc comments on all public functions (Rule 10.1)
- [x] Tests with mocked filesystem (7 tests in `src/findDcmtkPath.test.ts`)

### 2.5 Short-Lived Process Executor

- [x] Create `src/exec.ts`
- [x] Two functions:
    - `execCommand(binary, args, options): Promise<Result<DcmtkProcessResult>>` — uses `child_process.exec()`
    - `spawnCommand(binary, args, options): Promise<Result<DcmtkProcessResult>>` — uses `child_process.spawn()`, safer for user-supplied values
- [x] **Mandatory timeouts** on all operations (Rule 4.2):
    - Default: 30s, configurable via options
    - Uses `AbortController` for cancellation
    - `tree-kill` for cleanup on timeout/abort
- [x] `windowsHide: true` on all spawns
- [x] All results are `Result<T>` — process failures are expected, not exceptional
- [x] Explicit resource disposal: child process handles cleaned up via tree-kill (Rule 5.1)
- [x] Tests (11 tests in `src/exec.test.ts`)

### 2.6 Long-Lived Process Manager

- [x] Create `src/DcmtkProcess.ts` — base class for persistent DCMTK processes
- [x] Typed EventEmitter (type-safe event map, not loose strings):
    ```typescript
    interface DcmtkProcessEvents {
        started: [];
        stopped: [{ readonly reason: string }];
        error: [{ readonly error: Error; readonly fatal: boolean }];
        line: [{ readonly source: 'stdout' | 'stderr'; readonly text: string }];
    }
    ```
- [x] Responsibilities:
    - Spawn child process via `child_process.spawn()`
    - Buffer stdout/stderr line-by-line (handle partial lines at chunk boundaries)
    - Parse lines against registered `EventPattern` objects
    - Emit typed events
    - Lifecycle: `start(): Promise<Result<void>>`, `stop(): Promise<void>`, `readonly isRunning: boolean`
    - **Mandatory timeout** on start (Rule 4.2)
    - Graceful shutdown with configurable drain timeout (Rule 12.2)
    - `tree-kill`, force-kill on Windows
    - Single-use enforcement — returns `Result` error if `start()` called twice
    - Track pending async work count for graceful drain
- [x] Implements `Disposable` via `[Symbol.dispose]()` (Rule 5.1)
- [x] Bounded buffers — max stdout/stderr accumulation with configurable limit (Rule 8.1)
- [x] Tests for lifecycle, event emission, cleanup, disposal (14 tests in `src/DcmtkProcess.test.ts`)

### 2.7 Output Line Parser

- [x] Create `src/parsers/LineParser.ts`
- [x] Create `src/parsers/EventPattern.ts`:
    ```typescript
    interface EventPattern<T = unknown> {
        readonly event: string;
        readonly pattern: RegExp;
        readonly processor: (match: RegExpMatchArray) => T;
        readonly multiLine?: {
            readonly header: RegExp;
            readonly footer: RegExp;
            readonly maxLines: number; // Bounded — Rule 8.1
            readonly timeoutMs: number; // Default 1000 — Rule 4.2
        };
    }
    ```
- [x] **Iterative only** — no recursion in parsing (Rule 8.2). Multi-line block matching uses a stack/accumulator pattern.
- [x] Bounded line accumulation (Rule 8.1)
- [x] Tests with sample DCMTK output (12 tests in `src/parsers/LineParser.test.ts`)

---

## Phase 3: Short-Lived Tool Wrappers (dcmdata, dcmnet clients, dcmjpeg, dcmimage)

**Goal:** Wrap every short-lived DCMTK binary. Each wrapper is a pure async function returning `Result<T>`. Organized by DCMTK module.

### Design Principles (Applied to ALL tool wrappers)

- Each tool = one file: `src/tools/<toolname>.ts`
- Each exports a typed async function (not a class) — functions for stateless, classes for stateful
- Every function signature: `(options: XxxOptions) => Promise<Result<XxxResult>>`
- Options validated at boundary with Zod (Rule 7.2), then branded types trusted internally
- All async operations have timeouts (Rule 4.2)
- `spawn` used when arguments contain user-supplied DICOM values (Rule 7.4: injection prevention)
- `exec` used when arguments are fully controlled
- TSDoc on every public function (Rule 10.1)
- ≤ 40 lines per function body; extract helpers (Rule 8.4)
- All `switch` statements exhaustive with `assertUnreachable` default (Rule 8.3)
- Immutable result objects (Rule 7.1)
- `finally` blocks for temp file cleanup (Rule 5.1)

### 3.1 dcmdata Module (20 tools) — File I/O & Conversion

- [x] dcm2xml — DICOM → XML (exec)
- [x] dcm2json — DICOM → JSON via XML primary, direct fallback (exec)
- [x] dcmodify — Modify DICOM tags (spawn, injection safety)
- [x] dcmdump — Dump DICOM metadata as text (exec)
- [x] dcmconv — Convert DICOM encoding (exec)
- [x] xml2dcm — XML → DICOM (exec)
- [x] json2dcm — JSON → DICOM (exec)
- [x] img2dcm — Standard image → DICOM (exec)
- [x] pdf2dcm — PDF → DICOM encapsulation (exec)
- [x] dcm2pdf — Extract PDF from DICOM (exec)
- [x] cda2dcm — CDA → DICOM encapsulation (exec)
- [x] dcm2cda — Extract CDA from DICOM (exec)
- [x] dump2dcm — ASCII dump → DICOM (exec)
- [x] dcmftest — Test if file is DICOM Part 10 (exec)
- [x] dcmcrle — RLE encode (exec)
- [x] dcmdrle — RLE decode (exec)
- [x] dcmgpdir — Create DICOMDIR (exec)
- [x] stl2dcm — STL → DICOM (exec)
- [x] dcmencap — Encapsulate document (exec)
- [x] dcmdecap — Extract encapsulated file (exec)

**Shared utilities:**

- [x] `src/tools/_repairJson.ts` — fix malformed dcm2json output (unquoted numeric arrays in DS/IS VR)
- [x] `src/tools/_xmlToJson.ts` — convert dcm2xml XML output to DICOM JSON model
- [x] `src/tools/_resolveBinary.ts` — binary path resolution helper
- [x] `src/tools/_toolTypes.ts` — ToolBaseOptions interface
- [x] `src/tools/_toolError.ts` — standardized error factory

### 3.2 dcmnet Module — Client Tools (7 short-lived)

- [x] echoscu — DICOM C-ECHO verification (exec)
- [x] dcmsend — Simple DICOM C-STORE send (exec)
- [x] storescu — Full DICOM C-STORE client (exec)
- [x] findscu — DICOM C-FIND query (exec)
- [x] movescu — DICOM C-MOVE retrieve (exec)
- [x] getscu — DICOM C-GET retrieve (exec)
- [x] termscu — DICOM termination (exec)

### 3.3 dcmjpeg Module (4 tools)

- [x] dcmcjpeg — JPEG compress DICOM (exec)
- [x] dcmdjpeg — JPEG decompress DICOM (exec)
- [x] dcmj2pnm — DICOM → image (PNG/BMP/TIFF/JPEG) (exec)
- [x] dcmmkdir — Create DICOMDIR (exec)

### 3.4 dcmimage Module (3 tools)

- [x] dcm2pnm — DICOM → PGM/PPM/PNG/TIFF/BMP (exec)
- [x] dcmscale — Scale DICOM images (exec)
- [x] dcmquant — Color → palette color (exec)

### 3.5 dcmimgle Module (3 tools)

- [x] dcmdspfn — Export display curves (exec)
- [x] dcod2lum — Hardcopy → softcopy curve (exec)
- [x] dconvlum — VeriLUM → DCMTK display format (exec)

### 3.6 dcmpstat Module — Client Tools (7 short-lived)

- [x] dcmpsmk — Create presentation state (exec)
- [x] dcmpschk — Check presentation state (exec)
- [x] dcmp2pgm — Render presentation state to bitmap (exec)
- [x] dcmpsprt — Render print job (exec)
- [x] dcmprscu — Print spooler (exec)
- [x] dcmmkcrv — Add curve data to image (exec)
- [x] dcmmklut — Create look-up tables (exec)

### 3.7 dcmsr Module — Structured Reports (3 tools)

- [x] dsrdump — Dump SR as text (exec)
- [x] dsr2xml — SR → XML (exec)
- [x] xml2dsr — XML → SR (exec)

### 3.8 dcmrt Module (1 tool)

- [x] drtdump — Dump RT file (exec)

---

## Phase 4: Long-Lived Process Wrappers (Servers)

**Goal:** Wrap DCMTK binaries that run as persistent servers using the `DcmtkProcess` base from Phase 2.6.

### 4.1 Event Definitions

- [ ] Create `src/events/dcmrecv.ts` — event patterns + types:

    ```typescript
    const DcmrecvEvent = {
        LISTENING: 'LISTENING',
        ASSOCIATION_RECEIVED: 'ASSOCIATION_RECEIVED',
        ASSOCIATION_ACKNOWLEDGED: 'ASSOCIATION_ACKNOWLEDGED',
        C_STORE_REQUEST: 'C_STORE_REQUEST',
        STORED_FILE: 'STORED_FILE',
        ASSOCIATION_RELEASE: 'ASSOCIATION_RELEASE',
        DUL_NETWORK_CLOSED: 'DUL_NETWORK_CLOSED',
        CANNOT_START_LISTENER: 'CANNOT_START_LISTENER',
        STOPPED: 'STOPPED',
    } as const; // Rule 3.5: const assertion, not enum
    type DcmrecvEventValue = (typeof DcmrecvEvent)[keyof typeof DcmrecvEvent];

    const DCMRECV_FATAL_ERRORS: ReadonlyArray<DcmrecvEventValue> = [
        DcmrecvEvent.DUL_NETWORK_CLOSED,
        DcmrecvEvent.CANNOT_START_LISTENER,
        // ...
    ] as const;
    ```

- [ ] Create `src/events/storescp.ts` — superset of dcmrecv events
- [ ] Create `src/events/dcmprscp.ts` — print management server events
- [ ] Create `src/events/dcmpsrcv.ts` — viewer network receiver events
- [ ] Create `src/events/index.ts` — re-export all

### 4.2 Dcmrecv — Simple DICOM Receiver

- [ ] Create `src/servers/Dcmrecv.ts`
- [ ] Extends `DcmtkProcess`
- [ ] Options validated via Zod schema at construction (Rule 7.2)
- [ ] `start(): Promise<Result<void>>` — with mandatory startup timeout (Rule 4.2)
- [ ] `stop(): Promise<void>` — graceful drain, then kill (Rule 12.2)
- [ ] Implements `Disposable` (Rule 5.1)
- [ ] Single-use enforcement
- [ ] Async file processing: pending counter, bounded parallelism (Rule 4.3)
- [ ] Ship default `storescp.cfg` as package data
- [ ] Tests

### 4.3 StoreSCP — Full-Featured DICOM Storage Server

- [ ] Create `src/servers/StoreSCP.ts`
- [ ] Extends `DcmtkProcess`
- [ ] Additional configuration: transfer syntax preferences, file sorting, output encoding
- [ ] Tests

### 4.4 Additional Long-Lived Servers

- [ ] `src/servers/DcmprsCP.ts` — print management server (dcmprscp)
- [ ] `src/servers/Dcmpsrcv.ts` — viewer network receiver (dcmpsrcv)

---

## Phase 5: DICOM Data Layer

**Goal:** Type-safe, immutable-by-default DICOM data structures. Fresh design — not carrying forward the old DicomJson/DicomObject patterns.

### 5.1 Design Philosophy (What's Different from d-dart)

The d-dart `DicomJson` + `DicomObject` pattern was designed 10 years ago. This redesign applies modern TypeScript and the coding standard:

1. **Immutable core, explicit mutations.** `DicomDataset` is a readonly snapshot. Modifications produce a `ChangeSet` that can be applied via dcmodify. No mutable maps hiding state changes.

2. **Branded types everywhere.** `DicomTag`, `DicomTagPath`, `AETitle` — not raw strings. Compile-time prevention of tag/path mixups.

3. **Result pattern for all lookups.** `getTag()` returns `Result<T>` instead of `T | undefined`. Forces explicit handling of missing tags.

4. **No recursion.** Nested DICOM sequences (SQ) traversed iteratively using a stack (Rule 8.2).

5. **Zod validation at boundaries.** Raw JSON from dcm2json parsed through Zod schemas before becoming a `DicomDataset`. Internal code trusts the validated structure.

6. **Separation of concerns.** Data representation (DicomDataset) is completely separate from file I/O (DicomFile). No filesystem dependencies leak into the data layer.

### 5.2 Tag Path Utilities

- [x] Create `src/dicom/tagPath.ts`:
    - `tagPathToSegments(path: DicomTagPath): ReadonlyArray<TagSegment>` — iterative parser (no recursion)
    - `segmentsToModifyPath(segments: ReadonlyArray<TagSegment>): string` — dcmodify-compatible format
    - `segmentsToString(segments: ReadonlyArray<TagSegment>): string` — canonical display format
    ```typescript
    interface TagSegment {
        readonly tag: DicomTag;
        readonly index?: number; // Sequence item index
        readonly isWildcard?: boolean; // [*] for findValues
    }
    ```
- [x] Tests (21 tests: parse, serialize, round-trip, wildcards, edge cases; fuzz via fast-check deferred to Phase 8)

### 5.3 VR Definitions & DICOM Dictionary

- [x] Create `src/dicom/vr.ts` — Value Representation definitions using `as const`:

    ```typescript
    const VR = {
        AE: 'AE',
        AS: 'AS',
        AT: 'AT',
        CS: 'CS',
        DA: 'DA',
        DS: 'DS',
        DT: 'DT',
        FL: 'FL',
        FD: 'FD',
        IS: 'IS',
        LO: 'LO',
        LT: 'LT',
        OB: 'OB',
        OD: 'OD',
        OF: 'OF',
        OL: 'OL',
        OV: 'OV',
        OW: 'OW',
        PN: 'PN',
        SH: 'SH',
        SL: 'SL',
        SQ: 'SQ',
        SS: 'SS',
        ST: 'ST',
        SV: 'SV',
        TM: 'TM',
        UC: 'UC',
        UI: 'UI',
        UL: 'UL',
        UN: 'UN',
        UR: 'UR',
        US: 'US',
        UT: 'UT',
        UV: 'UV',
    } as const;
    type VRValue = (typeof VR)[keyof typeof VR];

    // Classification (no enum — Rule 3.5)
    const VR_CATEGORY = {
        STRING: ['AE', 'AS', 'CS', 'DA', 'DS', 'DT', 'IS', 'LO', 'LT', 'PN', 'SH', 'ST', 'TM', 'UC', 'UI', 'UR', 'UT'],
        NUMERIC: ['FL', 'FD', 'SL', 'SS', 'SV', 'UL', 'US', 'UV'],
        BINARY: ['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN'],
        SEQUENCE: ['SQ'],
        TAG: ['AT'],
    } as const;
    ```

- [x] VR metadata: max length, padding char, fixed-length flag, category (VR_META record)
- [x] Create `src/dicom/dictionary.ts` — tag lookup from shipped JSON (4,902 entries)
- [x] Tests (34 VR tests, 20 dictionary tests)

### 5.4 Generated Data Files & Scripts

- [x] Create `scripts/generateDictionary.ts` — reshapes `_configs/dicom.dic.json` → `src/data/dictionary.json`
- [x] Create `src/data/sopClasses.ts` — curated ~70 SOP class UIDs with reverse lookup
- [x] Ship generated files committed to repo (`src/data/dictionary.json`, 4,902 entries)
- [x] Add `generate` npm script, `tsx` devDependency
- [ ] Document regeneration process (on DCMTK version upgrade)

### 5.5 DicomDataset — Immutable Data Representation

- [x] Create `src/dicom/DicomDataset.ts`
- [x] Wraps validated DICOM JSON as a deeply readonly structure (Rule 7.1)
- [x] **Immutable** — no setters. Reads only:

    ```typescript
    class DicomDataset {
        /** Get a single tag value by path. Returns Result to force handling of missing tags. */
        getTag<T>(path: DicomTagPath): Result<T>;

        /** Get tag as string with fallback. Common convenience method. */
        getString(path: DicomTagPath, fallback?: string): string;

        /** Find all values matching a wildcard path, e.g. "(0040,A730)[*]->(0040,A160)" */
        findValues<T>(path: DicomTagPath): ReadonlyArray<T>;

        /** Get the raw DICOM element (VR, Value, InlineBinary, etc.) */
        getElement(path: DicomTagPath): Result<DicomElement>;

        /** Check if a tag exists */
        hasTag(path: DicomTagPath): boolean;

        /** Common DICOM identifiers */
        readonly accession: string;
        readonly patientName: string;
        readonly studyDate: string;
        readonly modality: string;
        readonly sopClassUID: SOPClassUID;
        readonly studyInstanceUID: string;
        readonly seriesInstanceUID: string;

        /** Factory: parse raw JSON (from dcm2json) into validated DicomDataset */
        static fromJson(json: unknown): Result<DicomDataset>;
    }
    ```

- [x] Nested sequence traversal is **iterative** using a stack (Rule 8.2)
- [x] Person Name (PN) handling: Alphabetic/Ideographic/Phonetic components
- [x] Binary data handling: InlineBinary (base64), BulkDataURI
- [ ] Tests with fuzz testing (deferred to Phase 8)

### 5.6 ChangeSet — Explicit Mutation Tracking

- [x] Create `src/dicom/ChangeSet.ts`
- [x] Records intended modifications separately from data:

    ```typescript
    class ChangeSet {
        /** Queue a tag modification */
        setTag(path: DicomTagPath, value: string): ChangeSet; // Returns new ChangeSet (immutable)

        /** Queue a tag deletion */
        eraseTag(path: DicomTagPath): ChangeSet;

        /** Queue deletion of all private tags */
        erasePrivateTags(): ChangeSet;

        /** Get all queued modifications (for dcmodify) */
        readonly modifications: ReadonlyMap<string, string>;

        /** Get all queued erasures */
        readonly erasures: ReadonlySet<string>;

        /** Is this changeset empty? */
        readonly isEmpty: boolean;

        /** Merge two changesets */
        merge(other: ChangeSet): ChangeSet;

        /** Create empty changeset */
        static empty(): ChangeSet;
    }
    ```

- [x] Sanitizes non-printable characters on setValue (but not for binary VRs)
- [x] Immutable — each method returns a new `ChangeSet` instance
- [x] Tests

### 5.7 DicomFile — File I/O Integration

- [x] Create `src/dicom/DicomFile.ts`
- [x] Combines DicomDataset + ChangeSet + filesystem path:

    ```typescript
    class DicomFile {
        readonly dataset: DicomDataset;
        readonly filePath: DicomFilePath;
        readonly changes: ChangeSet;

        /** Apply changes and write to a new file. Original is never modified. */
        writeAs(outputPath: string): Promise<Result<DicomFilePath>>;

        /** Apply changes in-place (uses dcmodify on original file) */
        applyChanges(): Promise<Result<void>>;

        /** Convert pixel data to PNG buffer */
        toPng(): Promise<Result<Buffer>>;

        /** Get file size in bytes */
        fileSize(): Promise<Result<number>>;

        /** Delete the underlying .dcm file */
        unlink(): Promise<Result<void>>;

        /** Create a new DicomFile with additional changes */
        withChanges(changes: ChangeSet): DicomFile;

        /** Create a new DicomFile pointing to a different file but same dataset */
        withFilePath(newPath: DicomFilePath): DicomFile;

        /** Factory: load from .dcm file (runs dcm2json internally) */
        static open(path: string): Promise<Result<DicomFile>>;
    }
    ```

- [x] `writeAs()` internally: copy file → apply dcmodify → return new path
- [x] All file operations have timeouts (Rule 4.2)
- [x] All file handles cleaned up in `finally` (Rule 5.1)
- [x] Tests

### 5.8 DICOM XML Parsing

- [x] Create `src/dicom/xmlToJson.ts` — convert dcm2xml XML output → DICOM JSON model
- [x] Iterative XML traversal (Rule 8.2)
- [x] Handles all VR types, nested sequences, binary data encoding
- [x] Tests

---

## Phase 6: Public API & Index Exports

**Goal:** Clean, well-organized public API surface. Barrel exports used sparingly (Rule 10.3).

### 6.1 Organize Exports

- [ ] `src/index.ts`:

    ```typescript
    // Core
    export { findDcmtkPath } from './findDcmtkPath';

    // Result pattern
    export type { Result } from './types';
    export { ok, err, assertUnreachable } from './types';

    // Branded types + factories
    export type { DicomTag, AETitle, DicomTagPath, SOPClassUID, Port, DicomFilePath } from './brands';

    // DICOM data layer
    export { DicomDataset } from './dicom/DicomDataset';
    export { ChangeSet } from './dicom/ChangeSet';
    export { DicomFile } from './dicom/DicomFile';

    // Short-lived tools (all 48+)
    export { dcm2xml } from './tools/dcm2xml';
    export { dcm2json } from './tools/dcm2json';
    export { dcmodify } from './tools/dcmodify';
    // ... every tool

    // Long-lived servers
    export { Dcmrecv } from './servers/Dcmrecv';
    export { StoreSCP } from './servers/StoreSCP';

    // Types (re-export all public interfaces)
    export type { ... } from './tools/...';
    export type { ... } from './servers/...';
    ```

### 6.2 Verify Package Quality

- [ ] `npm pack --dry-run` — only dist/ ships
- [ ] Tree-shaking verified: no side effects at module scope
- [ ] All exports statically analyzable
- [ ] Type-level tests (tsd/expect-type) verify public API types (Rule 9.4)

---

## Phase 7: Documentation & Publishing

### 7.1 README.md

- [ ] Project overview: what, why, prerequisites
- [ ] DCMTK installation instructions per platform
- [ ] Quick start examples:
    - Short-lived tool (dcm2json, dcmsend)
    - Long-lived server (Dcmrecv)
    - DICOM data manipulation (DicomFile + ChangeSet)
- [ ] Result pattern usage guide
- [ ] API reference (link to generated docs)
- [ ] License

### 7.2 Update CLAUDE.md

- [ ] Final architecture, commands, patterns, coding standard reference

### 7.3 AI_README.md

- [ ] Condensed API summary for AI assistant context

### 7.4 LICENSE

- [ ] MIT license file

### 7.5 CHANGELOG.md — Per Rule 13.3

- [ ] Initialized with v0.1.0 changes

### 7.6 First Publish

- [ ] `pnpm dry-run` — verify package contents
- [ ] `pnpm version:patch` — create v0.1.0
- [ ] `npm publish`
- [ ] Create GitHub release with tag

---

## Phase 8: Hardening & Operational Readiness

### 8.1 Fuzz Testing — Per Rule 9.2

- [x] `test/fuzz/tagPath.fuzz.test.ts` — property-based tests for tag path parsing
- [x] `test/fuzz/validation.fuzz.test.ts` — branded type factory functions
- [x] `test/fuzz/lineParser.fuzz.test.ts` — parser against random input
- [x] `test/fuzz/repairJson.fuzz.test.ts` — JSON repair against malformed inputs
- [x] Integrated into CI (run on every push)

### 8.2 Type-Level Tests — Per Rule 9.4

- [x] `test/types.test.ts` — Result narrowing, branded types, tool results, server events, DICOM data layer (implemented using vitest expectTypeOf instead of separate tsd directory)

### 8.3 Error Handling — Per Rule 6.1, 6.2

- [x] Consistent error shapes across all tools (Result pattern with descriptive messages)
- [x] Descriptive context in all errors (binary name, args, exit code, stderr excerpt)
- [ ] Use `stderr-lib` for normalizing caught `unknown` errors (deferred — current error handling is comprehensive)
- [ ] `tryCatch` from stderr-lib used at all `try/catch` boundaries (deferred)

### 8.4 Observability — Per Rule 9.3

- [ ] `debug` package for internal debug logging (deferred — would require touching all modules)
- [ ] Namespaces: `dcmtk:path`, `dcmtk:exec`, `dcmtk:spawn`, `dcmtk:dcmrecv`, `dcmtk:storescp`, etc.
- [ ] Structured logging ready (consumers can integrate with Winston/Pino)

### 8.5 CI/CD

- [x] GitHub Actions workflow:
    - `lint --max-warnings 0` → `typecheck` → `test --coverage` → `build`
    - Fail on any step
    - Matrix: Node 20, 22
- [ ] Nightly fuzz testing run (extended iterations)

### 8.6 Security — Per Rule 7.4

- [x] `pnpm audit --prod` in CI, fail on vulnerabilities
- [x] No dynamic imports — all static ESM (Rule 3.4)
- [x] All user-supplied values in dcmodify go through spawn (never exec/shell)
- [x] AE title sanitization prevents injection
- [x] No secrets in codebase

---

## Dependency Summary

### Production Dependencies

| Package           | Purpose                                     | Pinned         |
| ----------------- | ------------------------------------------- | -------------- |
| `tree-kill`       | Cross-platform process tree termination     | Yes (Rule 3.4) |
| `stderr-lib`      | Error normalization with Result pattern     | Yes            |
| `fast-xml-parser` | XML parsing (dcm2xml → JSON path)           | Yes            |
| `zod`             | Runtime validation at boundaries (Rule 7.2) | Yes            |
| `debug`           | Conditional debug logging                   | Yes            |

### Dev Dependencies

| Package                                             | Purpose                                |
| --------------------------------------------------- | -------------------------------------- |
| `typescript` (5.8+)                                 | Language with `erasableSyntaxOnly`     |
| `tsup`                                              | Bundler (CJS + ESM + DTS)              |
| `vitest` + `@vitest/coverage-v8`                    | Testing + coverage                     |
| `eslint` + `typescript-eslint`                      | Linting (type-aware)                   |
| `eslint-plugin-prettier` + `eslint-config-prettier` | Format integration                     |
| `prettier`                                          | Code formatting                        |
| `husky` + `lint-staged`                             | Git hooks                              |
| `rimraf`                                            | Clean script                           |
| `fast-check`                                        | Fuzz/property-based testing (Rule 9.2) |
| `tsd` or `expect-type`                              | Type-level testing (Rule 9.4)          |
| `@types/node`                                       | Node.js type definitions               |
| `globals`                                           | ESLint globals                         |

### Removed (from current project)

| Package                            | Reason                                |
| ---------------------------------- | ------------------------------------- |
| `@babel/*`                         | Replaced by TypeScript + tsup         |
| `xml2js`                           | Replaced by fast-xml-parser           |
| `json-stable-stringify`            | Not needed                            |
| `dcmjs-dimse`                      | Replaced by native DCMTK wrappers     |
| `jsdoc` / `jsdoc-to-markdown`      | TypeScript declarations serve as docs |
| `jest` / `ts-jest` / `@types/jest` | Replaced by vitest                    |

---

## Test Strategy: Hybrid Layout

Unit tests are **colocated** next to the source file they test (inside `src/`). Tests that don't map 1:1 to a source file — fuzz tests, integration tests, and type-level tests — live in separate top-level directories.

**Why colocated unit tests:**

- Zero navigation friction — test is always one tab away from its source
- Moving/renaming a file keeps its test with it
- Visible reminder when a source file has no test
- tsup bundles from `src/index.ts` via tree-shaking — `.test.ts` files never enter the bundle
- `tsconfig.json` excludes `**/*.test.ts` from compilation
- `package.json` `files` field ships only `dist/` — no tests in the npm package

**Why separate fuzz/integration/type tests:**

- Fuzz tests exercise multiple modules at once (not 1:1 with source)
- Integration tests require real DCMTK binaries and span modules
- Type-level tests (tsd) need their own tsconfig
- Test fixtures (sample .dcm/.json/.xml) belong in a shared location

## File Structure (Target)

```
dcmtk.js/
├── src/
│   ├── index.ts                        # Public API exports
│   ├── types.ts                        # Result<T,E>, ok(), err(), assertUnreachable()
│   ├── types.test.ts                   # ← colocated unit test
│   ├── brands.ts                       # Branded types: DicomTag, AETitle, Port, etc.
│   ├── brands.test.ts
│   ├── validation.ts                   # Zod schemas + parse functions
│   ├── validation.test.ts
│   ├── constants.ts                    # Defaults, timeouts, PDU sizes (as const)
│   ├── findDcmtkPath.ts               # Binary discovery
│   ├── findDcmtkPath.test.ts
│   ├── exec.ts                         # Short-lived process execution
│   ├── exec.test.ts
│   ├── DcmtkProcess.ts                 # Long-lived process base class
│   ├── DcmtkProcess.test.ts
│   ├── tools/                          # Short-lived tool wrappers (48+ files)
│   │   ├── dcm2xml.ts
│   │   ├── dcm2xml.test.ts            # ← each tool has colocated test
│   │   ├── dcm2json.ts
│   │   ├── dcm2json.test.ts
│   │   ├── dcmodify.ts
│   │   ├── dcmodify.test.ts
│   │   ├── dcmdump.ts
│   │   ├── dcmdump.test.ts
│   │   ├── dcmconv.ts
│   │   ├── dcmsend.ts
│   │   ├── dcmsend.test.ts
│   │   ├── echoscu.ts
│   │   ├── echoscu.test.ts
│   │   ├── storescu.ts
│   │   ├── findscu.ts
│   │   ├── movescu.ts
│   │   ├── getscu.ts
│   │   ├── xml2dcm.ts
│   │   ├── json2dcm.ts
│   │   ├── img2dcm.ts
│   │   ├── pdf2dcm.ts
│   │   ├── dcm2pdf.ts
│   │   ├── dcmcjpeg.ts
│   │   ├── dcmdjpeg.ts
│   │   ├── dcmj2pnm.ts
│   │   ├── dsrdump.ts
│   │   ├── dsr2xml.ts
│   │   ├── xml2dsr.ts
│   │   ├── ... (all remaining tools + their .test.ts)
│   │   ├── _repairJson.ts              # Internal: JSON repair utility
│   │   ├── _repairJson.test.ts
│   │   ├── _xmlToJson.ts              # Internal: XML→JSON conversion
│   │   └── _xmlToJson.test.ts
│   ├── servers/                        # Long-lived server wrappers
│   │   ├── Dcmrecv.ts
│   │   ├── Dcmrecv.test.ts
│   │   ├── StoreSCP.ts
│   │   ├── StoreSCP.test.ts
│   │   ├── DcmprsCP.ts
│   │   └── Dcmpsrcv.ts
│   ├── parsers/                        # Output parsing
│   │   ├── LineParser.ts
│   │   ├── LineParser.test.ts
│   │   ├── EventPattern.ts
│   │   └── EventPattern.test.ts
│   ├── events/                         # Event definitions (as const objects)
│   │   ├── index.ts
│   │   ├── dcmrecv.ts
│   │   ├── storescp.ts
│   │   ├── dcmprscp.ts
│   │   └── dcmpsrcv.ts
│   ├── dicom/                          # DICOM data layer
│   │   ├── DicomDataset.ts             # Immutable data representation
│   │   ├── DicomDataset.test.ts
│   │   ├── ChangeSet.ts               # Explicit mutation tracking
│   │   ├── ChangeSet.test.ts
│   │   ├── DicomFile.ts               # File I/O integration
│   │   ├── DicomFile.test.ts
│   │   ├── tagPath.ts                 # Tag path parsing
│   │   ├── tagPath.test.ts
│   │   ├── vr.ts                      # Value Representation definitions
│   │   ├── vr.test.ts
│   │   ├── dictionary.ts             # Tag dictionary lookup
│   │   ├── dictionary.test.ts
│   │   ├── xmlToJson.ts              # XML → DICOM JSON
│   │   └── xmlToJson.test.ts
│   ├── data/                           # Shipped data files
│   │   ├── dicom.dic.json
│   │   ├── sopClasses.ts
│   │   └── storescp.cfg
│   └── utils/                          # Internal utilities
│       ├── sanitizeAeTitle.ts
│       ├── sanitizeAeTitle.test.ts
│       ├── tempFile.ts
│       └── tempFile.test.ts
├── test/                               # Tests that don't map 1:1 to source files
│   ├── fuzz/                           # Property-based tests (Rule 9.2)
│   │   ├── tagPath.fuzz.test.ts
│   │   ├── validation.fuzz.test.ts
│   │   ├── lineParser.fuzz.test.ts
│   │   └── repairJson.fuzz.test.ts
│   ├── integration/                    # Tests requiring real DCMTK binaries
│   │   ├── dcmrecv.integration.test.ts
│   │   ├── dicomFile.integration.test.ts
│   │   └── sendReceive.integration.test.ts
│   └── fixtures/                       # Shared test data
│       ├── sample.dcm
│       ├── sampleDicom.json
│       └── sampleDicom.xml
├── test-types/                         # Type-level tests (Rule 9.4)
│   ├── tsconfig.json
│   ├── result.test-d.ts
│   ├── brands.test-d.ts
│   ├── dataset.test-d.ts
│   └── events.test-d.ts
├── scripts/
│   ├── generateDictionary.ts
│   └── generateSopClasses.ts
├── docs/
│   ├── TypeScript Coding Standard for Mission-Critical Systems.md
│   └── adr/
│       ├── 001-typescript-rewrite.md
│       ├── 002-vitest-over-jest.md
│       ├── 003-result-pattern.md
│       ├── 004-immutable-dataset.md
│       └── 005-hybrid-test-layout.md
├── dicomSamples/                       # Sample DICOM files (not in npm package)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsconfig.test.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.mjs
├── .prettierrc
├── .editorconfig
├── .gitignore
├── .husky/
│   ├── pre-commit
│   └── pre-push
├── CLAUDE.md
├── CHANGELOG.md
├── README.md
├── LICENSE
└── PLAN.md
```

---

## Implementation Order

| Step | Phase                                                         | Scope                                      | Depends On |
| ---- | ------------------------------------------------------------- | ------------------------------------------ | ---------- |
| 1    | Phase 1 — Library Scaffold                                    | Config files, toolchain, Result type, ADRs | None       |
| 2    | Phase 2.1–2.3 — Branded types, types, validation, Zod schemas | Core type foundation                       | Step 1     |
| 3    | Phase 2.4 — findDcmtkPath                                     | Binary discovery                           | Step 2     |
| 4    | Phase 2.5 — Short-lived executor (exec/spawn)                 | Process execution                          | Step 3     |
| 5    | Phase 3.1 P0 — dcm2xml, dcm2json, dcmodify, dcmdump, dcmconv  | Core data tools                            | Step 4     |
| 6    | Phase 3.2 P0 — echoscu, dcmsend                               | Core network clients                       | Step 4     |
| 7    | Phase 5.2–5.4 — VR definitions, dictionary, generated data    | DICOM metadata                             | Step 2     |
| 8    | Phase 5.2, 5.5–5.6 — Tag paths, DicomDataset, ChangeSet       | Data layer core                            | Steps 5, 7 |
| 9    | Phase 5.7–5.8 — DicomFile, XML parsing                        | Data layer I/O                             | Steps 5, 8 |
| 10   | Phase 2.6–2.7 — Long-lived process manager, line parser       | Server infrastructure                      | Step 2     |
| 11   | Phase 4.1–4.3 — Events, Dcmrecv, StoreSCP                     | Servers                                    | Step 10    |
| 12   | Phase 3.x P1 — All P1 tools                                   | Expanded tool coverage                     | Step 4     |
| 13   | Phase 3.x P2 — All P2 tools                                   | Full DCMTK coverage                        | Step 4     |
| 14   | Phase 4.4 — Additional servers                                | Full server coverage                       | Step 10    |
| 15   | Phase 6 — Public API, type-level tests                        | Package API                                | Steps 1–14 |
| 16   | Phase 7 — Docs, CHANGELOG, first publish                      | Documentation                              | Step 15    |
| 17   | Phase 8 — Fuzz tests, CI/CD, security hardening               | Production readiness                       | Step 16    |

---

## Key Design Decisions

1. **Result pattern universally.** All functions that can fail return `Result<T, E>`. `throw` reserved for true panics (OOM, assertion failure). This is Rule 6.1/6.2 and the single most important architectural decision.

2. **Branded types for domain primitives.** `DicomTag`, `AETitle`, `Port`, `DicomTagPath`, `SOPClassUID` — not raw strings/numbers. Compile-time prevention of argument mixups. Rule 7.3.

3. **Immutable DicomDataset + explicit ChangeSet.** Data representation is frozen. Mutations are tracked separately and applied explicitly via dcmodify. This eliminates hidden state changes and makes the modification pipeline transparent. Rule 7.1.

4. **Vitest over Jest.** Native TypeScript support without ts-jest transform overhead. ESM-first. Faster execution. Compatible with the same test patterns.

5. **Functions for tools, classes for servers.** Short-lived DCMTK binaries have no state to manage — a function is the right abstraction. Long-lived servers have lifecycle state (running, stopping, pending work) — a class with Disposable interface is appropriate.

6. **`spawn` for dcmodify, `exec` for most others.** dcmodify accepts user-supplied DICOM values that may contain shell-special characters. `spawn` avoids shell injection. Rule 7.4.

7. **Two-phase dcm2json.** Direct dcm2json output has known malformation issues. dcm2xml → parse XML is more reliable, with direct dcm2json as fallback.

8. **No traditional enums.** `as const` objects + derived union types throughout. Rule 3.5, enforced by `erasableSyntaxOnly: true`.

9. **No recursion.** All tree/sequence traversal is iterative with bounded loops. Rules 8.1, 8.2.

10. **Mandatory timeouts on all async ops.** AbortController-based cancellation. No operation can hang indefinitely. Rule 4.2.

11. **Zod at boundaries, branded types internally.** External input (user options, raw JSON from dcm2json, file paths) validated via Zod at module boundaries. Internal code trusts branded types — no re-validation. Rule 7.2.

12. **95% coverage from day one.** Not "raise later" — the vitest config enforces 95% branch/function/line/statement coverage immediately. Rule 9.1.

13. **All 60+ DCMTK tools.** Every binary gets a wrapper. Prioritized P0/P1/P2 but all are planned. No tool left behind.

14. **stderr-lib for error normalization.** Consistent with the broader ecosystem (d-dart uses it). Provides cause chains, metadata, and safe serialization at every catch boundary.

15. **Node.js ≥ 20.** Per the coding standard's requirement for Node.js 20+. Enables native AbortController, Disposable patterns, and modern V8 features.
