/**
 * Convert hardcopy OD values to softcopy P-values using the dcod2lum binary.
 *
 * Converts Optical Density (OD) calibration data from a hardcopy device
 * into luminance (P-value) data suitable for softcopy display.
 *
 * @module dcod2lum
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcod2lum}. */
type Dcod2lumOptions = ToolBaseOptions;

/** Result of a successful dcod2lum operation. */
interface Dcod2lumResult {
    /** Path to the converted output file. */
    readonly outputPath: string;
}

const Dcod2lumOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Converts hardcopy OD values to softcopy P-values using the dcod2lum binary.
 *
 * @param inputPath - Path to the OD input file
 * @param outputPath - Path for the converted luminance output file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcod2lum('/path/to/od.dat', '/path/to/lum.dat');
 * if (result.ok) {
 *     console.log(`Converted: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcod2lum(inputPath: string, outputPath: string, options?: Dcod2lumOptions): Promise<Result<Dcod2lumResult>> {
    const validation = Dcod2lumOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcod2lum: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcod2lum');
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
        return err(createToolError('dcod2lum', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcod2lum };
export type { Dcod2lumOptions, Dcod2lumResult };
