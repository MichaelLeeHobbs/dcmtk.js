/**
 * Add curve data to a DICOM image using the dcmmkcrv binary.
 *
 * @module dcmmkcrv
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmmkcrv}. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- base options only
interface DcmmkcrvOptions extends ToolBaseOptions {}

/** Result of a successful dcmmkcrv operation. */
interface DcmmkcrvResult {
    /** Path to the output file with curve data added. */
    readonly outputPath: string;
}

const DcmmkcrvOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Adds curve data to a DICOM image using the dcmmkcrv binary.
 *
 * @param inputPath - Path to the input curve data file
 * @param outputPath - Path for the DICOM output file with curve data
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');
 * if (result.ok) {
 *     console.log(`Curve data added: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmmkcrv(inputPath: string, outputPath: string, options?: DcmmkcrvOptions): Promise<Result<DcmmkcrvResult>> {
    const validation = DcmmkcrvOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmmkcrv: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmmkcrv');
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
        return err(createToolError('dcmmkcrv', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmmkcrv };
export type { DcmmkcrvOptions, DcmmkcrvResult };
