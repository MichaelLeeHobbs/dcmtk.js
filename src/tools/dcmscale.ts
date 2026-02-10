/**
 * Scale a DICOM image using the dcmscale binary.
 *
 * @module dcmscale
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmscale}. */
interface DcmscaleOptions extends ToolBaseOptions {
    /** Horizontal scaling factor. */
    readonly xFactor?: number | undefined;
    /** Vertical scaling factor. */
    readonly yFactor?: number | undefined;
    /** Target width in pixels. */
    readonly xSize?: number | undefined;
    /** Target height in pixels. */
    readonly ySize?: number | undefined;
}

/** Result of a successful dcmscale operation. */
interface DcmscaleResult {
    /** Path to the scaled output file. */
    readonly outputPath: string;
}

const DcmscaleOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        xFactor: z.number().positive().optional(),
        yFactor: z.number().positive().optional(),
        xSize: z.number().int().positive().optional(),
        ySize: z.number().int().positive().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmscale command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmscaleOptions): string[] {
    const args: string[] = [];

    if (options?.xFactor !== undefined) {
        args.push('+Sxf', String(options.xFactor));
    }

    if (options?.yFactor !== undefined) {
        args.push('+Syf', String(options.yFactor));
    }

    if (options?.xSize !== undefined) {
        args.push('+Sxv', String(options.xSize));
    }

    if (options?.ySize !== undefined) {
        args.push('+Syv', String(options.ySize));
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Scale a DICOM image using the dcmscale binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the scaled output file
 * @param options - Optional scaling options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', {
 *     xFactor: 0.5,
 *     yFactor: 0.5,
 * });
 * if (result.ok) {
 *     console.log(`Scaled: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmscale(inputPath: string, outputPath: string, options?: DcmscaleOptions): Promise<Result<DcmscaleResult>> {
    const validation = DcmscaleOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmscale: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmscale');
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
        return err(createToolError('dcmscale', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmscale };
export type { DcmscaleOptions, DcmscaleResult };
