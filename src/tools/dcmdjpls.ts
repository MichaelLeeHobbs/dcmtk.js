/**
 * Decompress a JPEG-LS-compressed DICOM file using the dcmdjpls binary.
 *
 * @module dcmdjpls
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
 * Color conversion modes for dcmdjpls.
 */
const JplsColorConversion = {
    /** Use photometric interpretation from the dataset. */
    PHOTOMETRIC: 'photometric',
    /** Always convert to RGB. */
    ALWAYS: 'always',
    /** Never convert color space. */
    NEVER: 'never',
} as const;

type JplsColorConversionValue = (typeof JplsColorConversion)[keyof typeof JplsColorConversion];

/** Maps color conversion values to dcmdjpls command-line flags. */
const JPLS_COLOR_CONVERSION_FLAGS: Record<JplsColorConversionValue, string> = {
    photometric: '+cp',
    always: '+ca',
    never: '+cn',
};

/** Options for {@link dcmdjpls}. */
interface DcmdjplsOptions extends ToolBaseOptions {
    /** Color conversion mode. Maps to +cp, +ca, or +cn. */
    readonly colorConversion?: JplsColorConversionValue | undefined;
}

/** Result of a successful dcmdjpls operation. */
interface DcmdjplsResult {
    /** Path to the decompressed output DICOM file. */
    readonly outputPath: string;
}

const DcmdjplsOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        colorConversion: z.enum(['photometric', 'always', 'never']).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmdjpls command-line arguments from validated options.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the decompressed output file
 * @param options - Validated options
 * @returns Argument array
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmdjplsOptions): string[] {
    const args: string[] = [];

    if (options?.colorConversion !== undefined) {
        args.push(JPLS_COLOR_CONVERSION_FLAGS[options.colorConversion]);
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Decompress a JPEG-LS-compressed DICOM file using the dcmdjpls binary.
 *
 * @param inputPath - Path to the JPEG-LS-compressed DICOM input file
 * @param outputPath - Path for the decompressed output DICOM file
 * @param options - Optional decompression options
 * @returns A Result containing the output path or an error
 */
async function dcmdjpls(inputPath: string, outputPath: string, options?: DcmdjplsOptions): Promise<Result<DcmdjplsResult>> {
    const validation = DcmdjplsOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmdjpls: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmdjpls');
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
        return err(createToolError('dcmdjpls', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmdjpls, JplsColorConversion };
export type { DcmdjplsOptions, DcmdjplsResult, JplsColorConversionValue };
