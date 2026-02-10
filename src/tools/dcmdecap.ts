/**
 * Extract an encapsulated document from a DICOM file using the dcmdecap binary.
 *
 * @module dcmdecap
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmdecap}. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- base options only
interface DcmdecapOptions extends ToolBaseOptions {}

/** Result of a successful dcmdecap operation. */
interface DcmdecapResult {
    /** Path to the extracted output file. */
    readonly outputPath: string;
}

const DcmdecapOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Extract an encapsulated document from a DICOM file using the dcmdecap binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the extracted output file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 */
async function dcmdecap(inputPath: string, outputPath: string, options?: DcmdecapOptions): Promise<Result<DcmdecapResult>> {
    const validation = DcmdecapOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmdecap: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmdecap');
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
        return err(createToolError('dcmdecap', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmdecap };
export type { DcmdecapOptions, DcmdecapResult };
