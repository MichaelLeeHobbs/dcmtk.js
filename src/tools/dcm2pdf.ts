/**
 * Extract an encapsulated PDF from a DICOM file using the dcm2pdf binary.
 *
 * @module dcm2pdf
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcm2pdf}. */
type Dcm2pdfOptions = ToolBaseOptions;

/** Result of a successful dcm2pdf operation. */
interface Dcm2pdfResult {
    /** Path to the extracted PDF file. */
    readonly outputPath: string;
}

const Dcm2pdfOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Extract an encapsulated PDF from a DICOM file using the dcm2pdf binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param outputPath - Path for the extracted PDF output file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 */
async function dcm2pdf(inputPath: string, outputPath: string, options?: Dcm2pdfOptions): Promise<Result<Dcm2pdfResult>> {
    const validation = Dcm2pdfOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcm2pdf: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcm2pdf');
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
        return err(createToolError('dcm2pdf', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcm2pdf };
export type { Dcm2pdfOptions, Dcm2pdfResult };
