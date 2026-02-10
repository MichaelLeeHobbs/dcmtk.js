/**
 * Create a DICOM presentation state from an image using the dcmpsmk binary.
 *
 * Generates a Grayscale Softcopy Presentation State (GSPS)
 * object from a DICOM image file.
 *
 * @module dcmpsmk
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmpsmk}. */
type DcmpsmkOptions = ToolBaseOptions;

/** Result of a successful dcmpsmk operation. */
interface DcmpsmkResult {
    /** Path to the created presentation state file. */
    readonly outputPath: string;
}

const DcmpsmkOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Creates a DICOM presentation state from an image using the dcmpsmk binary.
 *
 * @param inputPath - Path to the DICOM image input file
 * @param outputPath - Path for the created presentation state output file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm');
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmpsmk(inputPath: string, outputPath: string, options?: DcmpsmkOptions): Promise<Result<DcmpsmkResult>> {
    const validation = DcmpsmkOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmpsmk: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmpsmk');
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
        return err(createToolError('dcmpsmk', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmpsmk };
export type { DcmpsmkOptions, DcmpsmkResult };
