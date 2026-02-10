/**
 * Convert a dump file to DICOM format using the dump2dcm binary.
 *
 * @module dump2dcm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dump2dcm}. */
interface Dump2dcmOptions extends ToolBaseOptions {
    /** Generate new Study/Series/SOP Instance UIDs. Defaults to false. */
    readonly generateNewUIDs?: boolean | undefined;
    /** Write output as DICOM file format (with preamble + meta header). Defaults to false. */
    readonly writeFileFormat?: boolean | undefined;
}

/** Result of a successful dump2dcm conversion. */
interface Dump2dcmResult {
    /** Path to the generated DICOM output file. */
    readonly outputPath: string;
}

const Dump2dcmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        generateNewUIDs: z.boolean().optional(),
        writeFileFormat: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dump2dcm command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: Dump2dcmOptions): string[] {
    const args: string[] = [];

    if (options?.generateNewUIDs === true) {
        args.push('+Ug');
    }

    if (options?.writeFileFormat === true) {
        args.push('-F');
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Converts a dump file to DICOM format using the dump2dcm binary.
 *
 * @param inputPath - Path to the dump input file
 * @param outputPath - Path for the DICOM output file
 * @param options - Conversion options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dump2dcm('/path/to/input.dump', '/path/to/output.dcm', {
 *     generateNewUIDs: true,
 * });
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dump2dcm(inputPath: string, outputPath: string, options?: Dump2dcmOptions): Promise<Result<Dump2dcmResult>> {
    const validation = Dump2dcmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dump2dcm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dump2dcm');
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
        return err(createToolError('dump2dcm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dump2dcm };
export type { Dump2dcmOptions, Dump2dcmResult };
