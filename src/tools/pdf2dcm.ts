/**
 * Encapsulate a PDF file into a DICOM object using the pdf2dcm binary.
 *
 * @module pdf2dcm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link pdf2dcm}. */
type Pdf2dcmOptions = ToolBaseOptions;

/** Result of a successful pdf2dcm operation. */
interface Pdf2dcmResult {
    /** Path to the output DICOM file. */
    readonly outputPath: string;
}

const Pdf2dcmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Encapsulate a PDF file into a DICOM object using the pdf2dcm binary.
 *
 * @param inputPath - Path to the PDF input file
 * @param outputPath - Path for the output DICOM file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 */
async function pdf2dcm(inputPath: string, outputPath: string, options?: Pdf2dcmOptions): Promise<Result<Pdf2dcmResult>> {
    const validation = Pdf2dcmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`pdf2dcm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('pdf2dcm');
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
        return err(createToolError('pdf2dcm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { pdf2dcm };
export type { Pdf2dcmOptions, Pdf2dcmResult };
