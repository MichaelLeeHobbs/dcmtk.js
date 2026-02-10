/**
 * Convert VeriLUM calibration data to DCMTK display format using the dconvlum binary.
 *
 * Reads VeriLUM luminance calibration data and converts it into
 * a format suitable for use with DCMTK display function tools.
 *
 * @module dconvlum
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dconvlum}. */
interface DconvlumOptions extends ToolBaseOptions {
    /** Ambient light value in cd/m2. Maps to `+Ca`. */
    readonly ambientLight?: number | undefined;
}

/** Result of a successful dconvlum operation. */
interface DconvlumResult {
    /** Path to the converted output file. */
    readonly outputPath: string;
}

const DconvlumOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        ambientLight: z.number().positive().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dconvlum command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: DconvlumOptions): string[] {
    const args: string[] = [];

    if (options?.ambientLight !== undefined) {
        args.push('+Ca', String(options.ambientLight));
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Converts VeriLUM calibration data to DCMTK display format using the dconvlum binary.
 *
 * @param inputPath - Path to the VeriLUM input file
 * @param outputPath - Path for the converted output file
 * @param options - Optional conversion options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dconvlum('/path/to/verilum.dat', '/path/to/display.dat', {
 *     ambientLight: 10,
 * });
 * if (result.ok) {
 *     console.log(`Converted: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dconvlum(inputPath: string, outputPath: string, options?: DconvlumOptions): Promise<Result<DconvlumResult>> {
    const validation = DconvlumOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dconvlum: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dconvlum');
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
        return err(createToolError('dconvlum', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dconvlum };
export type { DconvlumOptions, DconvlumResult };
