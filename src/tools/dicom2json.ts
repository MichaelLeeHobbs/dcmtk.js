/**
 * Pure-JS DICOM to JSON conversion — no DCMTK binaries required.
 *
 * Parses DICOM Part-10 files directly in-process (via `dicom-parser`) and
 * produces the same DICOM JSON Model shape as {@link dcm2json}, orders of
 * magnitude faster: no process spawn, no XML intermediate, and bulk pixel
 * data is never loaded.
 *
 * Differences from the dcm2json/dcm2xml output, by design:
 * - File meta group 0002 elements are included, so
 *   `DicomDataset.transferSyntaxUID` returns the actual transfer syntax.
 * - Group length elements (gggg,0000) are always omitted.
 *
 * Set `dcmtkFallback: true` to retry with the deprecated {@link dcm2json}
 * binary path when the JS parser fails (e.g. exotic files DCMTK tolerates).
 *
 * @module dicom2json
 */

import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { createValidationError } from './_toolError';
import { parseDicomBuffer } from './_p10ToJson';
import { dcm2json } from './dcm2json';
import type { DicomJsonModel } from './_xmlToJson';
import type { ToolBaseOptions } from './_toolTypes';

/** Indicates which engine produced the result. 'js' is the pure-JS parser; 'xml' and 'direct' come from the DCMTK fallback. */
type Dicom2jsonSource = 'js' | 'xml' | 'direct';

/** Options for {@link dicom2json}. */
interface Dicom2jsonOptions extends ToolBaseOptions {
    /** Assume the specified character set when SpecificCharacterSet (0008,0005) is absent. Accepts DICOM defined terms ('ISO_IR 100') or DCMTK-style aliases ('latin-1'). */
    readonly charsetAssume?: string | undefined;
    /** Charset to decode with when the file's specified character set is unsupported. `'latin-1'` recommended — maps every byte to a valid character. */
    readonly charsetFallback?: string | undefined;
    /** Retry with the deprecated dcm2json binary path when the JS parser fails. Defaults to false. */
    readonly dcmtkFallback?: boolean | undefined;
}

/** Options for {@link dicom2jsonFromBuffer} (charset handling only). */
type Dicom2jsonBufferOptions = Pick<Dicom2jsonOptions, 'charsetAssume' | 'charsetFallback'>;

/** Result of a successful dicom2json conversion. */
interface Dicom2jsonResult {
    /** The DICOM JSON Model object. */
    readonly data: DicomJsonModel;
    /** Non-fatal parser warnings (empty for DCMTK fallback results). */
    readonly warnings: readonly string[];
    /** Which engine produced this result. */
    readonly source: Dicom2jsonSource;
}

const Dicom2jsonOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        charsetAssume: z.string().min(1).optional(),
        charsetFallback: z.string().min(1).optional(),
        dcmtkFallback: z.boolean().optional(),
    })
    .strict()
    .optional();

const Dicom2jsonBufferOptionsSchema = z
    .object({
        charsetAssume: z.string().min(1).optional(),
        charsetFallback: z.string().min(1).optional(),
    })
    .strict()
    .optional();

/** Reads a file with a timeout and optional external abort signal. */
async function readFileBounded(inputPath: string, timeoutMs: number, signal?: AbortSignal): Promise<Result<Buffer>> {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combined = signal !== undefined ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    try {
        return ok(await readFile(inputPath, { signal: combined }));
    } catch (error: unknown) {
        if (timeoutSignal.aborted) {
            return err(new Error(`dicom2json: reading '${inputPath}' timed out after ${String(timeoutMs)}ms`));
        }
        if (signal?.aborted === true) {
            return err(new Error(`dicom2json: aborted while reading '${inputPath}'`));
        }
        const message = error instanceof Error ? error.message : String(error);
        return err(new Error(`dicom2json: failed to read '${inputPath}': ${message}`));
    }
}

/** Runs the DCMTK fallback with the remaining time budget, aggregating both errors on double failure. */
async function runDcmtkFallback(inputPath: string, jsError: Error, remainingMs: number, options?: Dicom2jsonOptions): Promise<Result<Dicom2jsonResult>> {
    if (remainingMs <= 0) {
        return err(new Error(`dicom2json: JS parse failed and timeout budget exhausted (skipping DCMTK fallback) | js: ${jsError.message}`));
    }
    const fallback = await dcm2json(inputPath, {
        timeoutMs: remainingMs,
        signal: options?.signal,
        charsetAssume: options?.charsetAssume,
        charsetFallback: options?.charsetFallback,
    });
    if (!fallback.ok) {
        return err(new Error(`dicom2json: both engines failed | js: ${jsError.message} | dcmtk: ${fallback.error.message}`));
    }
    return ok({ data: fallback.value.data, warnings: [], source: fallback.value.source });
}

/**
 * Converts a DICOM file to the DICOM JSON Model using the pure-JS parser.
 *
 * @param inputPath - Path to the DICOM input file
 * @param options - Conversion options
 * @returns A Result containing the DICOM JSON Model with source discriminant
 *
 * @example
 * ```ts
 * const result = await dicom2json('/path/to/study.dcm');
 * if (result.ok) {
 *     console.log(result.value.source); // 'js'
 *     console.log(result.value.data['00100010']); // Patient Name
 * }
 * ```
 */
async function dicom2json(inputPath: string, options?: Dicom2jsonOptions): Promise<Result<Dicom2jsonResult>> {
    const validation = Dicom2jsonOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(createValidationError('dicom2json', validation.error));
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();
    const parsed = await parseFromFile(inputPath, timeoutMs, options);
    if (parsed.ok) {
        return parsed;
    }
    if (options?.dcmtkFallback === true) {
        return runDcmtkFallback(inputPath, parsed.error, timeoutMs - (Date.now() - startTime), options);
    }
    return err(parsed.error);
}

/** Reads and parses a file with the JS engine. */
async function parseFromFile(inputPath: string, timeoutMs: number, options?: Dicom2jsonOptions): Promise<Result<Dicom2jsonResult>> {
    const fileResult = await readFileBounded(inputPath, timeoutMs, options?.signal);
    if (!fileResult.ok) {
        return err(fileResult.error);
    }
    const parsed = parseDicomBuffer(fileResult.value, { charsetAssume: options?.charsetAssume, charsetFallback: options?.charsetFallback });
    if (!parsed.ok) {
        return err(parsed.error);
    }
    return ok({ data: parsed.value.data, warnings: parsed.value.warnings, source: 'js' });
}

/**
 * Converts an in-memory DICOM Part-10 buffer to the DICOM JSON Model.
 *
 * Synchronous — no file I/O, no timeout, no DCMTK fallback.
 *
 * @param buffer - The DICOM file bytes
 * @param options - Charset handling options
 * @returns A Result containing the DICOM JSON Model
 */
function dicom2jsonFromBuffer(buffer: Uint8Array, options?: Dicom2jsonBufferOptions): Result<Dicom2jsonResult> {
    const validation = Dicom2jsonBufferOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(createValidationError('dicom2jsonFromBuffer', validation.error));
    }
    const parsed = parseDicomBuffer(buffer, options);
    if (!parsed.ok) {
        return err(parsed.error);
    }
    return ok({ data: parsed.value.data, warnings: parsed.value.warnings, source: 'js' });
}

export { dicom2json, dicom2jsonFromBuffer };
export type { Dicom2jsonOptions, Dicom2jsonBufferOptions, Dicom2jsonResult, Dicom2jsonSource };
