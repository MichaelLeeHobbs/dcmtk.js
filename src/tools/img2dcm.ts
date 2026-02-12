/**
 * Convert an image file to DICOM format using the img2dcm binary.
 *
 * @module img2dcm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/**
 * Supported input image formats for img2dcm.
 */
const Img2dcmInputFormat = {
    /** JPEG image. */
    JPEG: 'jpeg',
    /** BMP image. */
    BMP: 'bmp',
} as const;

type Img2dcmInputFormatValue = (typeof Img2dcmInputFormat)[keyof typeof Img2dcmInputFormat];

/** Options for {@link img2dcm}. */
interface Img2dcmOptions extends ToolBaseOptions {
    /** Input image format. Maps to `-i JPEG` or `-i BMP`. */
    readonly inputFormat?: Img2dcmInputFormatValue | undefined;
    /** Path to a DICOM dataset file to copy attributes from. Maps to `-df path`. */
    readonly datasetFrom?: string | undefined;
}

/** Result of a successful img2dcm conversion. */
interface Img2dcmResult {
    /** Path to the generated DICOM output file. */
    readonly outputPath: string;
}

const Img2dcmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        inputFormat: z.enum(['jpeg', 'bmp']).optional(),
        datasetFrom: z.string().min(1).optional(),
    })
    .strict()
    .optional();

/** Maps input format values to the CLI flag expected by dcmtk 3.7.0+. */
const FORMAT_FLAG_MAP: Record<Img2dcmInputFormatValue, string> = {
    jpeg: 'JPEG',
    bmp: 'BMP',
};

/**
 * Builds img2dcm command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: Img2dcmOptions): string[] {
    const args: string[] = [];

    if (options?.inputFormat !== undefined) {
        args.push('-i', FORMAT_FLAG_MAP[options.inputFormat]);
    }

    if (options?.datasetFrom !== undefined) {
        args.push('-df', options.datasetFrom);
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Converts an image file to DICOM format using the img2dcm binary.
 *
 * @param inputPath - Path to the image input file
 * @param outputPath - Path for the DICOM output file
 * @param options - Conversion options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await img2dcm('/path/to/photo.jpg', '/path/to/output.dcm', {
 *     inputFormat: 'jpeg',
 * });
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function img2dcm(inputPath: string, outputPath: string, options?: Img2dcmOptions): Promise<Result<Img2dcmResult>> {
    const validation = Img2dcmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`img2dcm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('img2dcm');
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
        return err(createToolError('img2dcm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { img2dcm, Img2dcmInputFormat };
export type { Img2dcmOptions, Img2dcmResult, Img2dcmInputFormatValue };
