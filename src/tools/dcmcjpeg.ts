/**
 * Compress a DICOM file with JPEG encoding using the dcmcjpeg binary.
 *
 * @module dcmcjpeg
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmcjpeg}. */
interface DcmcjpegOptions extends ToolBaseOptions {
    /** JPEG quality factor (1-100). Maps to +q. */
    readonly quality?: number | undefined;
    /** Use lossless JPEG compression (SV1). Maps to +e1. */
    readonly lossless?: boolean | undefined;
}

/** Result of a successful dcmcjpeg operation. */
interface DcmcjpegResult {
    /** Path to the compressed output DICOM file. */
    readonly outputPath: string;
}

const DcmcjpegOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        quality: z.number().int().min(1).max(100).optional(),
        lossless: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmcjpeg command-line arguments from validated options.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the compressed output file
 * @param options - Validated options
 * @returns Argument array
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmcjpegOptions): string[] {
    const args: string[] = [];

    if (options?.lossless === true) {
        args.push('+e1');
    }

    if (options?.quality !== undefined) {
        args.push('+q', String(options.quality));
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Compress a DICOM file with JPEG encoding using the dcmcjpeg binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the compressed output DICOM file
 * @param options - Optional compression options
 * @returns A Result containing the output path or an error
 */
async function dcmcjpeg(inputPath: string, outputPath: string, options?: DcmcjpegOptions): Promise<Result<DcmcjpegResult>> {
    const validation = DcmcjpegOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmcjpeg: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmcjpeg');
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
        return err(createToolError('dcmcjpeg', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmcjpeg };
export type { DcmcjpegOptions, DcmcjpegResult };
