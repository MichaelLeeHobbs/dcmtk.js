/**
 * Decode an RLE-compressed DICOM file using the dcmdrle binary.
 *
 * @module dcmdrle
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmdrle}. */
interface DcmdrleOptions extends ToolBaseOptions {
    /** Always write new SOP Instance UID. Maps to +ua flag. */
    readonly uidAlways?: boolean | undefined;
}

/** Result of a successful dcmdrle decoding. */
interface DcmdrleResult {
    /** Path to the decoded output file. */
    readonly outputPath: string;
}

const DcmdrleOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        uidAlways: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmdrle command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmdrleOptions): string[] {
    const args: string[] = [];

    if (options?.uidAlways === true) {
        args.push('+ua');
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Decodes an RLE-compressed DICOM file using the dcmdrle binary.
 *
 * @param inputPath - Path to the RLE-compressed DICOM input file
 * @param outputPath - Path for the decoded output file
 * @param options - Decoding options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmdrle('/path/to/compressed.dcm', '/path/to/output.dcm', {
 *     uidAlways: true,
 * });
 * if (result.ok) {
 *     console.log(`Decoded: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmdrle(inputPath: string, outputPath: string, options?: DcmdrleOptions): Promise<Result<DcmdrleResult>> {
    const validation = DcmdrleOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmdrle: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmdrle');
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
        return err(createToolError('dcmdrle', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmdrle };
export type { DcmdrleOptions, DcmdrleResult };
