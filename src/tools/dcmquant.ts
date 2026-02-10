/**
 * Quantize a color DICOM image to palette color using the dcmquant binary.
 *
 * @module dcmquant
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmquant}. */
interface DcmquantOptions extends ToolBaseOptions {
    /** Number of colors in the palette (2-65536). */
    readonly colors?: number | undefined;
    /** Frame number to extract (0-based). */
    readonly frame?: number | undefined;
}

/** Result of a successful dcmquant operation. */
interface DcmquantResult {
    /** Path to the quantized output file. */
    readonly outputPath: string;
}

const DcmquantOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        colors: z.number().int().min(2).max(65536).optional(),
        frame: z.number().int().min(0).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmquant command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmquantOptions): string[] {
    const args: string[] = [];

    if (options?.colors !== undefined) {
        args.push('+pc', String(options.colors));
    }

    if (options?.frame !== undefined) {
        args.push('+F', String(options.frame));
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Quantize a color DICOM image to palette color using the dcmquant binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the quantized output file
 * @param options - Optional quantization options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', {
 *     colors: 256,
 * });
 * if (result.ok) {
 *     console.log(`Quantized: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmquant(inputPath: string, outputPath: string, options?: DcmquantOptions): Promise<Result<DcmquantResult>> {
    const validation = DcmquantOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmquant: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmquant');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(inputPath, outputPath, options);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmquant', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmquant };
export type { DcmquantOptions, DcmquantResult };
