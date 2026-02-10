/**
 * Check a DICOM presentation state for consistency using the dcmpschk binary.
 *
 * Validates a Grayscale Softcopy Presentation State (GSPS) object
 * and reports any inconsistencies or errors found.
 *
 * @module dcmpschk
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmpschk}. */
type DcmpschkOptions = ToolBaseOptions;

/** Result of a successful dcmpschk operation. */
interface DcmpschkResult {
    /** The text output from dcmpschk. */
    readonly text: string;
}

const DcmpschkOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Checks a DICOM presentation state for consistency using the dcmpschk binary.
 *
 * @param inputPath - Path to the presentation state DICOM file
 * @param options - Optional execution options
 * @returns A Result containing the validation text output or an error
 *
 * @example
 * ```ts
 * const result = await dcmpschk('/path/to/pstate.dcm');
 * if (result.ok) {
 *     console.log(result.value.text);
 * }
 * ```
 */
async function dcmpschk(inputPath: string, options?: DcmpschkOptions): Promise<Result<DcmpschkResult>> {
    const validation = DcmpschkOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmpschk: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmpschk');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = [inputPath];
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmpschk', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ text: result.value.stdout });
}

export { dcmpschk };
export type { DcmpschkOptions, DcmpschkResult };
