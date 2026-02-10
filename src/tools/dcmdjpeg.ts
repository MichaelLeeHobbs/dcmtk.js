/**
 * Decompress a JPEG-compressed DICOM file using the dcmdjpeg binary.
 *
 * @module dcmdjpeg
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
 * Color conversion modes for dcmdjpeg.
 */
const ColorConversion = {
    /** Use photometric interpretation from the dataset. */
    PHOTOMETRIC: 'photometric',
    /** Always convert to RGB. */
    ALWAYS: 'always',
    /** Never convert color space. */
    NEVER: 'never',
} as const;

type ColorConversionValue = (typeof ColorConversion)[keyof typeof ColorConversion];

/** Maps color conversion values to dcmdjpeg command-line flags. */
const COLOR_CONVERSION_FLAGS: Record<ColorConversionValue, string> = {
    photometric: '+cp',
    always: '+ca',
    never: '+cn',
};

/** Options for {@link dcmdjpeg}. */
interface DcmdjpegOptions extends ToolBaseOptions {
    /** Color conversion mode. Maps to +cp, +ca, or +cn. */
    readonly colorConversion?: ColorConversionValue | undefined;
}

/** Result of a successful dcmdjpeg operation. */
interface DcmdjpegResult {
    /** Path to the decompressed output DICOM file. */
    readonly outputPath: string;
}

const DcmdjpegOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        colorConversion: z.enum(['photometric', 'always', 'never']).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmdjpeg command-line arguments from validated options.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the decompressed output file
 * @param options - Validated options
 * @returns Argument array
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmdjpegOptions): string[] {
    const args: string[] = [];

    if (options?.colorConversion !== undefined) {
        args.push(COLOR_CONVERSION_FLAGS[options.colorConversion]);
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Decompress a JPEG-compressed DICOM file using the dcmdjpeg binary.
 *
 * @param inputPath - Path to the JPEG-compressed DICOM input file
 * @param outputPath - Path for the decompressed output DICOM file
 * @param options - Optional decompression options
 * @returns A Result containing the output path or an error
 */
async function dcmdjpeg(inputPath: string, outputPath: string, options?: DcmdjpegOptions): Promise<Result<DcmdjpegResult>> {
    const validation = DcmdjpegOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmdjpeg: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmdjpeg');
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
        return err(createToolError('dcmdjpeg', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmdjpeg, ColorConversion };
export type { DcmdjpegOptions, DcmdjpegResult, ColorConversionValue };
