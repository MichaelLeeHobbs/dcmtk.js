/**
 * Extract an encapsulated CDA document from a DICOM file using the dcm2cda binary.
 *
 * @module dcm2cda
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcm2cda}. */
type Dcm2cdaOptions = ToolBaseOptions;

/** Result of a successful dcm2cda operation. */
interface Dcm2cdaResult {
    /** Path to the extracted CDA file. */
    readonly outputPath: string;
}

const Dcm2cdaOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Extract an encapsulated CDA document from a DICOM file using the dcm2cda binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the extracted CDA output file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 */
async function dcm2cda(inputPath: string, outputPath: string, options?: Dcm2cdaOptions): Promise<Result<Dcm2cdaResult>> {
    const validation = Dcm2cdaOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcm2cda: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcm2cda');
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
        return err(createToolError('dcm2cda', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcm2cda };
export type { Dcm2cdaOptions, Dcm2cdaResult };
