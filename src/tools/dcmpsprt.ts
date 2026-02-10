/**
 * Read a DICOM print job and render to printer using the dcmpsprt binary.
 *
 * @module dcmpsprt
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmpsprt}. */
interface DcmpsprtOptions extends ToolBaseOptions {
    /** Path to a configuration file. Maps to -c flag. */
    readonly configFile?: string | undefined;
}

/** Result of a successful dcmpsprt operation. */
interface DcmpsprtResult {
    /** The text output from dcmpsprt. */
    readonly text: string;
}

const DcmpsprtOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        configFile: z.string().min(1).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmpsprt command-line arguments from validated options.
 */
function buildArgs(inputPath: string, options?: DcmpsprtOptions): string[] {
    const args: string[] = [];

    if (options?.configFile !== undefined) {
        args.push('-c', options.configFile);
    }

    args.push(inputPath);

    return args;
}

/**
 * Reads a DICOM print job and renders to printer using the dcmpsprt binary.
 *
 * @param inputPath - Path to the DICOM print job file
 * @param options - Optional print options
 * @returns A Result containing the text output or an error
 *
 * @example
 * ```ts
 * const result = await dcmpsprt('/path/to/printjob.dcm', {
 *     configFile: '/path/to/config.cfg',
 * });
 * if (result.ok) {
 *     console.log(result.value.text);
 * }
 * ```
 */
async function dcmpsprt(inputPath: string, options?: DcmpsprtOptions): Promise<Result<DcmpsprtResult>> {
    const validation = DcmpsprtOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmpsprt: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmpsprt');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(inputPath, options);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmpsprt', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ text: result.value.stdout });
}

export { dcmpsprt };
export type { DcmpsprtOptions, DcmpsprtResult };
