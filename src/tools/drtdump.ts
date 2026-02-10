/**
 * Dump a DICOM RT file as text using the drtdump binary.
 *
 * @module drtdump
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link drtdump}. */
interface DrtdumpOptions extends ToolBaseOptions {
    /** Print filename for each document. Maps to +Pf. Defaults to false. */
    readonly printFilename?: boolean | undefined;
}

/** Result of a successful drtdump operation. */
interface DrtdumpResult {
    /** The text output from drtdump. */
    readonly text: string;
}

const DrtdumpOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        printFilename: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds drtdump command-line arguments from validated options.
 */
function buildArgs(inputPath: string, options?: DrtdumpOptions): string[] {
    const args: string[] = [];

    if (options?.printFilename === true) {
        args.push('+Pf');
    }

    args.push(inputPath);

    return args;
}

/**
 * Dumps a DICOM RT file as text using the drtdump binary.
 *
 * @param inputPath - Path to the DICOM RT input file
 * @param options - Dump options
 * @returns A Result containing the text dump or an error
 *
 * @example
 * ```ts
 * const result = await drtdump('/path/to/rtplan.dcm');
 * if (result.ok) {
 *     console.log(result.value.text);
 * }
 * ```
 */
async function drtdump(inputPath: string, options?: DrtdumpOptions): Promise<Result<DrtdumpResult>> {
    const validation = DrtdumpOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`drtdump: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('drtdump');
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
        return err(createToolError('drtdump', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ text: result.value.stdout });
}

export { drtdump };
export type { DrtdumpOptions, DrtdumpResult };
