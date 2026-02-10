/**
 * Compress a DICOM file with JPEG-LS encoding using the dcmcjpls binary.
 *
 * @module dcmcjpls
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmcjpls}. */
interface DcmcjplsOptions extends ToolBaseOptions {
    /** Use lossless JPEG-LS compression (default). Maps to +el. */
    readonly lossless?: boolean | undefined;
    /** Maximum pixel deviation for near-lossless mode. Maps to +md. */
    readonly maxDeviation?: number | undefined;
}

/** Result of a successful dcmcjpls operation. */
interface DcmcjplsResult {
    /** Path to the compressed output DICOM file. */
    readonly outputPath: string;
}

const DcmcjplsOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        lossless: z.boolean().optional(),
        maxDeviation: z.number().int().min(0).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmcjpls command-line arguments from validated options.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the compressed output file
 * @param options - Validated options
 * @returns Argument array
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmcjplsOptions): string[] {
    const args: string[] = [];

    if (options?.lossless === false) {
        args.push('+en');
    } else if (options?.lossless === true) {
        args.push('+el');
    }

    if (options?.maxDeviation !== undefined) {
        args.push('+md', String(options.maxDeviation));
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Compress a DICOM file with JPEG-LS encoding using the dcmcjpls binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the compressed output DICOM file
 * @param options - Optional compression options
 * @returns A Result containing the output path or an error
 */
async function dcmcjpls(inputPath: string, outputPath: string, options?: DcmcjplsOptions): Promise<Result<DcmcjplsResult>> {
    const validation = DcmcjplsOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmcjpls: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmcjpls');
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
        return err(createToolError('dcmcjpls', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmcjpls };
export type { DcmcjplsOptions, DcmcjplsResult };
