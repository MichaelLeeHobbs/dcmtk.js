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

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
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
    })
    .strict()
    .optional();

/**
 * Attempts XML-primary conversion: dcm2xml → xmlToJson.
 */
async function tryXmlPath(inputPath: string, timeoutMs: number, signal?: AbortSignal): Promise<Result<Dcm2jsonResult>> {
    const xmlBinary = resolveBinary('dcm2xml');
    if (!xmlBinary.ok) {
        return err(xmlBinary.error);
    }

    const xmlResult = await execCommand(xmlBinary.value, [inputPath], { timeoutMs, signal });
    if (!xmlResult.ok) {
        return err(xmlResult.error);
    }

    if (xmlResult.value.exitCode !== 0) {
        return err(createToolError('dcm2xml', [inputPath], xmlResult.value.exitCode, xmlResult.value.stderr));
    }

    const jsonResult = xmlToJson(xmlResult.value.stdout);
    if (!jsonResult.ok) {
        return err(jsonResult.error);
    }

    return ok({ data: jsonResult.value, source: 'xml' as const });
}

/**
 * Attempts direct conversion: dcm2json binary → repairJson → JSON.parse.
 */
async function tryDirectPath(inputPath: string, timeoutMs: number, signal?: AbortSignal): Promise<Result<Dcm2jsonResult>> {
    const jsonBinary = resolveBinary('dcm2json');
    if (!jsonBinary.ok) {
        return err(jsonBinary.error);
    }

    const result = await execCommand(jsonBinary.value, [inputPath], { timeoutMs, signal });
    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcm2json', [inputPath], result.value.exitCode, result.value.stderr));
    }

    try {
        const repaired = repairJson(result.value.stdout);
        const data = JSON.parse(repaired) as DicomJsonModel;
        return ok({ data, source: 'direct' as const });
    } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        return err(new Error(`dcm2json: failed to parse output: ${message}`));
    }
}

/**
 * Converts a DICOM file to the DICOM JSON Model.
 *
 * Uses a two-phase strategy:
 * 1. Primary: dcm2xml → XML-to-JSON conversion (more reliable)
 * 2. Fallback: direct dcm2json binary with JSON repair
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
        return err(new Error(`dcm2json: invalid options: ${validation.error.message}`));
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = options?.signal;

    // Direct-only mode: skip XML path
    if (options?.directOnly === true) {
        return tryDirectPath(inputPath, timeoutMs, signal);
    }

    // Try XML path first
    const xmlResult = await tryXmlPath(inputPath, timeoutMs, signal);
    if (xmlResult.ok) {
        return xmlResult;
    }

    // Fall back to direct path
    return tryDirectPath(inputPath, timeoutMs, signal);
}

export { dcm2json };
export type { Dcm2jsonOptions, Dcm2jsonResult, Dcm2jsonSource, DicomJsonModel };
