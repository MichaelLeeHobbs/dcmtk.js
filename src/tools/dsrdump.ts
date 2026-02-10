/**
 * Dump a DICOM structured report as text using the dsrdump binary.
 *
 * @module dsrdump
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dsrdump}. */
interface DsrdumpOptions extends ToolBaseOptions {
    /** Print filename for each document. Maps to +Pf. Defaults to false. */
    readonly printFilename?: boolean | undefined;
    /** Print long format with enhanced details. Maps to +Pl. Defaults to false. */
    readonly printLong?: boolean | undefined;
    /** Print concept name codes. Maps to +Pc. Defaults to false. */
    readonly printCodes?: boolean | undefined;
}

/** Result of a successful dsrdump operation. */
interface DsrdumpResult {
    /** The text output from dsrdump. */
    readonly text: string;
}

const DsrdumpOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        printFilename: z.boolean().optional(),
        printLong: z.boolean().optional(),
        printCodes: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dsrdump command-line arguments from validated options.
 */
function buildArgs(inputPath: string, options?: DsrdumpOptions): string[] {
    const args: string[] = [];

    if (options?.printFilename === true) {
        args.push('+Pf');
    }

    if (options?.printLong === true) {
        args.push('+Pl');
    }

    if (options?.printCodes === true) {
        args.push('+Pc');
    }

    args.push(inputPath);

    return args;
}

/**
 * Dumps a DICOM structured report as text using the dsrdump binary.
 *
 * @param inputPath - Path to the DICOM SR input file
 * @param options - Dump options
 * @returns A Result containing the text dump or an error
 *
 * @example
 * ```ts
 * const result = await dsrdump('/path/to/report.dcm');
 * if (result.ok) {
 *     console.log(result.value.text);
 * }
 * ```
 */
async function dsrdump(inputPath: string, options?: DsrdumpOptions): Promise<Result<DsrdumpResult>> {
    const validation = DsrdumpOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dsrdump: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dsrdump');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(inputPath, options);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dsrdump', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ text: result.value.stdout });
}

export { dsrdump };
export type { DsrdumpOptions, DsrdumpResult };
