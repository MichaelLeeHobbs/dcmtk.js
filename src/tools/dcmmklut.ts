/**
 * Create DICOM look-up tables using the dcmmklut binary.
 *
 * @module dcmmklut
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
 * LUT type presets for dcmmklut.
 */
const LutType = {
    /** Modality LUT. */
    MODALITY: 'modality',
    /** Presentation LUT. */
    PRESENTATION: 'presentation',
    /** VOI LUT. */
    VOI: 'voi',
} as const;

type LutTypeValue = (typeof LutType)[keyof typeof LutType];

const LUT_TYPE_FLAGS: Record<LutTypeValue, string> = {
    modality: '+Tm',
    presentation: '+Tp',
    voi: '+Tv',
};

/** Options for {@link dcmmklut}. */
interface DcmmklutOptions extends ToolBaseOptions {
    /** Type of LUT to create. Maps to +Tm, +Tp, or +Tv flags. */
    readonly lutType?: LutTypeValue | undefined;
    /** Gamma value for the LUT curve. Maps to +Cg flag. */
    readonly gamma?: number | undefined;
    /** Number of entries in the LUT. Maps to -e flag. */
    readonly entries?: number | undefined;
    /** Number of bits per LUT entry (8-16). Maps to -b flag. */
    readonly bits?: number | undefined;
}

/** Result of a successful dcmmklut operation. */
interface DcmmklutResult {
    /** Path to the created LUT output file. */
    readonly outputPath: string;
}

const DcmmklutOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        lutType: z.enum(['modality', 'presentation', 'voi']).optional(),
        gamma: z.number().positive().optional(),
        entries: z.number().int().positive().optional(),
        bits: z.number().int().min(8).max(16).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmmklut command-line arguments from validated options.
 */
function buildArgs(outputPath: string, options?: DcmmklutOptions): string[] {
    const args: string[] = [];

    if (options?.lutType !== undefined) {
        args.push(LUT_TYPE_FLAGS[options.lutType]);
    }

    if (options?.gamma !== undefined) {
        args.push('+Cg', String(options.gamma));
    }

    if (options?.entries !== undefined) {
        args.push('-e', String(options.entries));
    }

    if (options?.bits !== undefined) {
        args.push('-b', String(options.bits));
    }

    args.push(outputPath);

    return args;
}

/**
 * Creates DICOM look-up tables using the dcmmklut binary.
 *
 * @param outputPath - Path for the LUT output file
 * @param options - Optional LUT creation options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmmklut('/path/to/output.dcm', {
 *     lutType: 'voi',
 *     gamma: 2.2,
 *     entries: 256,
 *     bits: 12,
 * });
 * if (result.ok) {
 *     console.log(`LUT created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmmklut(outputPath: string, options?: DcmmklutOptions): Promise<Result<DcmmklutResult>> {
    const validation = DcmmklutOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmmklut: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmmklut');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(outputPath, options);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmmklut', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmmklut, LutType };
export type { DcmmklutOptions, DcmmklutResult, LutTypeValue };
