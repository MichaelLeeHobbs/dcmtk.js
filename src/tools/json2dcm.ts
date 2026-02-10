/**
 * Convert a JSON file to DICOM format using the json2dcm binary.
 *
 * @module json2dcm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link json2dcm}. */
type Json2dcmOptions = ToolBaseOptions;

/** Result of a successful json2dcm conversion. */
interface Json2dcmResult {
    /** Path to the generated DICOM output file. */
    readonly outputPath: string;
}

const Json2dcmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Converts a JSON file to DICOM format using the json2dcm binary.
 *
 * @param inputPath - Path to the JSON input file
 * @param outputPath - Path for the DICOM output file
 * @param options - Conversion options (timeout, signal)
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await json2dcm('/path/to/input.json', '/path/to/output.dcm');
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function json2dcm(inputPath: string, outputPath: string, options?: Json2dcmOptions): Promise<Result<Json2dcmResult>> {
    const validation = Json2dcmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`json2dcm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('json2dcm');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = [inputPath, outputPath];
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('json2dcm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { json2dcm };
export type { Json2dcmOptions, Json2dcmResult };
