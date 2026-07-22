/**
 * DICOM to JSON conversion using a two-phase strategy.
 *
 * Primary: dcm2xml → xmlToJson (more reliable output)
 * Fallback: dcm2json binary → repairJson → JSON.parse
 *
 * The result includes a `source` discriminant indicating which strategy succeeded.
 *
 * @module dcm2json
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stderr } from 'stderr-lib';
import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError, createValidationError } from './_toolError';
import { xmlToJson } from './_xmlToJson';
import { repairJson } from './_repairJson';
import type { DicomJsonModel } from './_xmlToJson';
import type { ToolBaseOptions } from './_toolTypes';

/** Indicates which conversion strategy produced the result. */
type Dcm2jsonSource = 'xml' | 'direct';

/** Options for {@link dcm2json}. */
interface Dcm2jsonOptions extends ToolBaseOptions {
    /** Skip the XML primary path and use direct dcm2json only. Defaults to false. */
    readonly directOnly?: boolean | undefined;
    /** Assume the specified character set when SpecificCharacterSet (0008,0005) is absent. Passed to dcm2xml as `+Ca`. Only effective on the XML path (dcm2json binary does not support this flag). */
    readonly charsetAssume?: string | undefined;
    /** Fallback charset to retry with when UTF-8 conversion fails. On charset error, the XML path retries with `+Ca <fallback>`. `'Latin1'` recommended — maps every byte to a valid character. */
    readonly charsetFallback?: string | undefined;
    /** Verbosity level for diagnostic output. `'verbose'` maps to `-v`, `'debug'` maps to `-d`. */
    readonly verbosity?: 'verbose' | 'debug' | undefined;
}

/** Result of a successful dcm2json conversion. */
interface Dcm2jsonResult {
    /** The DICOM JSON Model object. */
    readonly data: DicomJsonModel;
    /** Which conversion strategy produced this result. */
    readonly source: Dcm2jsonSource;
}

const Dcm2jsonOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        directOnly: z.boolean().optional(),
        charsetAssume: z.string().min(1).optional(),
        charsetFallback: z.string().min(1).optional(),
        verbosity: z.enum(['verbose', 'debug']).optional(),
    })
    .strict()
    .optional();

/** Options forwarded to the XML conversion path. */
type XmlPathOpts = { readonly verbosity?: 'verbose' | 'debug'; readonly charsetAssume?: string; readonly charsetFallback?: string };

/** Maps verbosity level to command-line flag. */
const VERBOSITY_FLAGS: Record<'verbose' | 'debug', string> = { verbose: '-v', debug: '-d' };

/**
 * Builds verbosity args for internal calls.
 */
function buildVerbosityArgs(verbosity?: 'verbose' | 'debug'): string[] {
    if (verbosity !== undefined) {
        return [VERBOSITY_FLAGS[verbosity]];
    }
    return [];
}

/** Builds XML-path options, omitting undefined values for exactOptionalPropertyTypes. */
function buildXmlOpts(options?: Dcm2jsonOptions): XmlPathOpts {
    const result: Record<string, string> = {};
    if (options?.verbosity !== undefined) result['verbosity'] = options.verbosity;
    if (options?.charsetAssume !== undefined) result['charsetAssume'] = options.charsetAssume;
    if (options?.charsetFallback !== undefined) result['charsetFallback'] = options.charsetFallback;
    return result;
}

/** Returns true if dcm2xml failed due to a charset conversion error. */
function isCharsetError(stderrOutput: string): boolean {
    return stderrOutput.includes('convert character encoding') || stderrOutput.includes('Illegal byte sequence');
}

/** Runs dcm2xml with given args, parses output to DICOM JSON. */
async function runXmlAndParse(binary: string, args: string[], execOpts: { timeoutMs: number; signal?: AbortSignal }): Promise<Result<Dcm2jsonResult>> {
    const xmlResult = await execCommand(binary, args, execOpts);
    if (!xmlResult.ok) return err(xmlResult.error);
    if (xmlResult.value.exitCode !== 0) {
        return err(createToolError('dcm2xml', args, xmlResult.value.exitCode, xmlResult.value.stderr));
    }
    const jsonResult = xmlToJson(xmlResult.value.stdout);
    if (!jsonResult.ok) return err(jsonResult.error);
    return ok({ data: jsonResult.value, source: 'xml' as const });
}

/**
 * Attempts XML-primary conversion: dcm2xml → xmlToJson.
 * If charset conversion fails and a fallback charset is configured, retries with `+Ca <fallback>`.
 */
async function tryXmlPath(inputPath: string, timeoutMs: number, signal?: AbortSignal, opts?: XmlPathOpts): Promise<Result<Dcm2jsonResult>> {
    const xmlBinary = resolveBinary('dcm2xml');
    if (!xmlBinary.ok) return err(xmlBinary.error);

    const charsetArgs = opts?.charsetAssume !== undefined ? ['+Ca', opts.charsetAssume] : [];
    const xmlArgs = [...buildVerbosityArgs(opts?.verbosity), ...charsetArgs, '-nat', inputPath];
    const execOpts = signal !== undefined ? { timeoutMs, signal } : { timeoutMs };

    const result = await runXmlAndParse(xmlBinary.value, xmlArgs, execOpts);

    // On charset conversion failure, retry with the fallback charset
    if (!result.ok && opts?.charsetFallback !== undefined && isCharsetError(result.error.message)) {
        const fallbackArgs = [...buildVerbosityArgs(opts.verbosity), '+Ca', opts.charsetFallback, '-nat', inputPath];
        return runXmlAndParse(xmlBinary.value, fallbackArgs, execOpts);
    }

    return result;
}

/**
 * Attempts direct conversion: dcm2json binary → repairJson → JSON.parse.
 *
 * Uses `+b +bd <tmpdir>` to redirect bulk pixel data to a temp directory
 * (discarded after parsing) so compressed pixel data does not cause failures.
 */
async function tryDirectPath(inputPath: string, timeoutMs: number, signal?: AbortSignal, verbosity?: 'verbose' | 'debug'): Promise<Result<Dcm2jsonResult>> {
    const jsonBinary = resolveBinary('dcm2json');
    if (!jsonBinary.ok) {
        return err(jsonBinary.error);
    }

    const bulkDir = await createBulkTempDir();
    const directArgs = [...buildVerbosityArgs(verbosity), '+b', '+bd', bulkDir, inputPath];

    try {
        const execOpts = signal !== undefined ? { timeoutMs, signal } : { timeoutMs };
        return await execAndParse(jsonBinary.value, directArgs, inputPath, execOpts);
    } finally {
        rm(bulkDir, { recursive: true, force: true }).catch(() => {});
    }
}

/** Creates a temporary directory for dcm2json bulk data output. */
async function createBulkTempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'dcm2json-bulk-'));
}

/** Runs dcm2json and parses the output. */
async function execAndParse(
    binary: string,
    args: string[],
    inputPath: string,
    execOpts: { timeoutMs: number; signal?: AbortSignal }
): Promise<Result<Dcm2jsonResult>> {
    const result = await execCommand(binary, args, execOpts);
    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcm2json', args, result.value.exitCode, result.value.stderr));
    }

    try {
        const repaired = repairJson(result.value.stdout);
        const data = JSON.parse(repaired) as DicomJsonModel;
        return ok({ data, source: 'direct' as const });
    } catch (parseError: unknown) {
        return err(createToolError('dcm2json', [inputPath], 1, `Parse error: ${stderr(parseError).message}`));
    }
}

/**
 * Converts a DICOM file to the DICOM JSON Model using DCMTK binaries.
 *
 * Uses a two-phase strategy:
 * 1. Primary: dcm2xml → XML-to-JSON conversion (more reliable)
 * 2. Fallback: direct dcm2json binary with JSON repair
 *
 * The fallback only runs when time budget remains; when both paths fail,
 * the returned error includes both failures.
 *
 * @deprecated Use {@link dicom2json} — the pure-JS parser is ~75x faster,
 * needs no DCMTK binaries, and preserves private tags correctly (this
 * binary path renumbers private blocks in its XML output). This function
 * remains available as an escape hatch (see `dcmtkFallback` on dicom2json).
 *
 * @param inputPath - Path to the DICOM input file
 * @param options - Conversion options
 * @returns A Result containing the DICOM JSON Model with source discriminant
 *
 * @example
 * ```ts
 * const result = await dcm2json('/path/to/study.dcm');
 * if (result.ok) {
 *     console.log(result.value.source); // 'xml' or 'direct'
 *     console.log(result.value.data['00100010']); // Patient Name
 * }
 * ```
 */
async function dcm2json(inputPath: string, options?: Dcm2jsonOptions): Promise<Result<Dcm2jsonResult>> {
    const validation = Dcm2jsonOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(createValidationError('dcm2json', validation.error));
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = options?.signal;
    const startTime = Date.now();
    const remaining = (): number => Math.max(0, timeoutMs - (Date.now() - startTime));

    const verbosity = options?.verbosity;

    // Direct-only mode: skip XML path
    if (options?.directOnly === true) {
        return tryDirectPath(inputPath, timeoutMs, signal, verbosity);
    }

    // Try XML path first
    const xmlResult = await tryXmlPath(inputPath, timeoutMs, signal, buildXmlOpts(options));
    if (xmlResult.ok) {
        return xmlResult;
    }

    return fallbackToDirect(inputPath, xmlResult.error, { budget: remaining(), timeoutMs, signal, verbosity });
}

/** Context for the direct-path fallback after an XML path failure. */
interface FallbackContext {
    readonly budget: number;
    readonly timeoutMs: number;
    readonly signal?: AbortSignal | undefined;
    readonly verbosity?: 'verbose' | 'debug' | undefined;
}

/**
 * Runs the direct-path fallback only if time budget remains — a doomed
 * fallback would time out immediately and mask the XML path's error.
 * When both paths fail, the returned error includes both failures.
 */
async function fallbackToDirect(inputPath: string, xmlError: Error, context: FallbackContext): Promise<Result<Dcm2jsonResult>> {
    if (context.budget === 0) {
        return err(
            new Error(
                `dcm2json: XML path failed and timeout budget (${String(context.timeoutMs)}ms) is exhausted (skipping direct fallback) | xml: ${xmlError.message}`
            )
        );
    }
    const directResult = await tryDirectPath(inputPath, context.budget, context.signal, context.verbosity);
    if (directResult.ok) {
        return directResult;
    }
    return err(new Error(`dcm2json: both paths failed | xml: ${xmlError.message} | direct: ${directResult.error.message}`));
}

export { dcm2json };
export type { Dcm2jsonOptions, Dcm2jsonResult, Dcm2jsonSource, DicomJsonModel };
