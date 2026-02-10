/**
 * Encode a DICOM file with RLE compression using the dcmcrle binary.
 *
 * @module dcmcrle
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmcrle}. */
interface DcmcrleOptions extends ToolBaseOptions {
    /** Always write new SOP Instance UID. Maps to +ua flag. */
    readonly uidAlways?: boolean | undefined;
}

/** Result of a successful dcmcrle encoding. */
interface DcmcrleResult {
    /** Path to the RLE-compressed output file. */
    readonly outputPath: string;
}

const DcmcrleOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        uidAlways: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmcrle command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmcrleOptions): string[] {
    const args: string[] = [];

    if (options?.uidAlways === true) {
        args.push('+ua');
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Encodes a DICOM file with RLE compression using the dcmcrle binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the RLE-compressed output file
 * @param options - Encoding options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmcrle('/path/to/input.dcm', '/path/to/output.dcm', {
 *     uidAlways: true,
 * });
 * if (result.ok) {
 *     console.log(`Encoded: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmcrle(inputPath: string, outputPath: string, options?: DcmcrleOptions): Promise<Result<DcmcrleResult>> {
    const validation = DcmcrleOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmcrle: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmcrle');
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
        return err(createToolError('dcmcrle', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmcrle };
export type { DcmcrleOptions, DcmcrleResult };
