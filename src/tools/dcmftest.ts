/**
 * Test if a file is a valid DICOM Part 10 file using the dcmftest binary.
 *
 * @module dcmftest
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmftest}. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- base options only
interface DcmftestOptions extends ToolBaseOptions {}

/** Result of a successful dcmftest check. */
interface DcmftestResult {
    /** Whether the tested file is a valid DICOM Part 10 file. */
    readonly isDicom: boolean;
}

const DcmftestOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .optional();

/**
 * Tests whether a file is a valid DICOM Part 10 file using the dcmftest binary.
 *
 * The dcmftest binary always returns exit code 0 regardless of result.
 * The determination is made by parsing stdout for "yes:" (DICOM) or "no:" (not DICOM).
 *
 * @param inputPath - Path to the file to test
 * @param options - Test options
 * @returns A Result containing the isDicom flag or an error
 *
 * @example
 * ```ts
 * const result = await dcmftest('/path/to/file.dcm');
 * if (result.ok) {
 *     console.log(result.value.isDicom ? 'Valid DICOM' : 'Not DICOM');
 * }
 * ```
 */
async function dcmftest(inputPath: string, options?: DcmftestOptions): Promise<Result<DcmftestResult>> {
    const validation = DcmftestOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmftest: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmftest');
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
        return err(createToolError('dcmftest', args, result.value.exitCode, result.value.stderr));
    }

    const isDicom = result.value.stdout.includes('yes:');
    return ok({ isDicom });
}

export { dcmftest };
export type { DcmftestOptions, DcmftestResult };
