/**
 * Convert DICOM file encoding/transfer syntax using the dcmconv binary.
 *
 * @module dcmconv
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
 * Transfer syntax presets for dcmconv.
 */
const TransferSyntax = {
    /** Implicit VR Little Endian. */
    IMPLICIT_LITTLE: '+ti',
    /** Explicit VR Little Endian. */
    EXPLICIT_LITTLE: '+te',
    /** Explicit VR Big Endian (deprecated in DICOM). */
    EXPLICIT_BIG: '+tb',
    /** JPEG Lossless. */
    JPEG_LOSSLESS: '+tl',
    /** JPEG 2000 Lossless. */
    JPEG2K_LOSSLESS: '+t2',
    /** RLE Lossless. */
    RLE: '+tr',
    /** Deflated Explicit VR Little Endian. */
    DEFLATED: '+td',
} as const;

type TransferSyntaxValue = (typeof TransferSyntax)[keyof typeof TransferSyntax];

const VALID_TRANSFER_SYNTAXES = ['+ti', '+te', '+tb', '+tl', '+t2', '+tr', '+td'] as const;

/** Options for {@link dcmconv}. */
interface DcmconvOptions extends ToolBaseOptions {
    /** Target transfer syntax. Required. */
    readonly transferSyntax: TransferSyntaxValue;
}

/** Result of a successful dcmconv conversion. */
interface DcmconvResult {
    /** Path to the converted output file. */
    readonly outputPath: string;
}

const DcmconvOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        transferSyntax: z.enum(VALID_TRANSFER_SYNTAXES),
    })
    .strict();

/**
 * Converts a DICOM file's transfer syntax using the dcmconv binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the converted output file
 * @param options - Conversion options (transfer syntax required)
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmconv('/path/to/input.dcm', '/path/to/output.dcm', {
 *     transferSyntax: '+te', // Explicit VR Little Endian
 * });
 * if (result.ok) {
 *     console.log(`Converted: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmconv(inputPath: string, outputPath: string, options: DcmconvOptions): Promise<Result<DcmconvResult>> {
    const validation = DcmconvOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmconv: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmconv');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = [options.transferSyntax, inputPath, outputPath];
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmconv', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmconv, TransferSyntax };
export type { DcmconvOptions, DcmconvResult, TransferSyntaxValue };
