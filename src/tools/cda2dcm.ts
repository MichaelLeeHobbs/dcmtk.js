/**
 * Encapsulate a CDA document into a DICOM object using the cda2dcm binary.
 *
 * @module cda2dcm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link cda2dcm}. */
type Cda2dcmOptions = ToolBaseOptions;

/** Result of a successful cda2dcm operation. */
interface Cda2dcmResult {
    /** Path to the output DICOM file. */
    readonly outputPath: string;
}

const Cda2dcmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Encapsulate a CDA document into a DICOM object using the cda2dcm binary.
 *
 * @param inputPath - Path to the CDA input file
 * @param outputPath - Path for the output DICOM file
 * @param options - Optional execution options
 * @returns A Result containing the output path or an error
 */
async function cda2dcm(inputPath: string, outputPath: string, options?: Cda2dcmOptions): Promise<Result<Cda2dcmResult>> {
    const validation = Cda2dcmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`cda2dcm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('cda2dcm');
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
        return err(createToolError('cda2dcm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { cda2dcm };
export type { Cda2dcmOptions, Cda2dcmResult };
