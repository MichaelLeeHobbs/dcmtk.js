/**
 * Encapsulate a non-DICOM document into a DICOM file using the dcmencap binary.
 *
 * @module dcmencap
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmencap}. */
interface DcmencapOptions extends ToolBaseOptions {
    /** Document title for the encapsulated document. Maps to --title. */
    readonly documentTitle?: string | undefined;
}

/** Result of a successful dcmencap operation. */
interface DcmencapResult {
    /** Path to the output DICOM file. */
    readonly outputPath: string;
}

const DcmencapOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        documentTitle: z.string().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmencap command-line arguments from validated options.
 *
 * @param inputPath - Path to the input document
 * @param outputPath - Path for the output DICOM file
 * @param options - Validated options
 * @returns Argument array
 */
function buildArgs(inputPath: string, outputPath: string, options?: DcmencapOptions): string[] {
    const args: string[] = [];

    if (options?.documentTitle !== undefined) {
        args.push('--title', options.documentTitle);
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Encapsulate a non-DICOM document into a DICOM file using the dcmencap binary.
 *
 * @param inputPath - Path to the input document
 * @param outputPath - Path for the output DICOM file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 */
async function dcmencap(inputPath: string, outputPath: string, options?: DcmencapOptions): Promise<Result<DcmencapResult>> {
    const validation = DcmencapOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmencap: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmencap');
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
        return err(createToolError('dcmencap', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmencap };
export type { DcmencapOptions, DcmencapResult };
