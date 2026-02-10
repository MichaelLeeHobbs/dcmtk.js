/**
 * Render a DICOM image with presentation state to a bitmap using the dcmp2pgm binary.
 *
 * @module dcmp2pgm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmp2pgm}. */
interface Dcmp2pgmOptions extends ToolBaseOptions {
    /** Path to a DICOM presentation state file. Maps to -p flag. */
    readonly presentationState?: string | undefined;
    /** Frame number to render (0-based). Maps to -f flag. */
    readonly frame?: number | undefined;
}

/** Result of a successful dcmp2pgm operation. */
interface Dcmp2pgmResult {
    /** Path to the rendered output file. */
    readonly outputPath: string;
}

const Dcmp2pgmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        presentationState: z.string().min(1).optional(),
        frame: z.number().int().min(0).optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmp2pgm command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: Dcmp2pgmOptions): string[] {
    const args: string[] = [];

    if (options?.presentationState !== undefined) {
        args.push('-p', options.presentationState);
    }

    if (options?.frame !== undefined) {
        args.push('-f', String(options.frame));
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Renders a DICOM image with presentation state to a bitmap using the dcmp2pgm binary.
 *
 * @param inputPath - Path to the DICOM input image file
 * @param outputPath - Path for the rendered output bitmap file
 * @param options - Optional rendering options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm', {
 *     presentationState: '/path/to/state.dcm',
 *     frame: 0,
 * });
 * if (result.ok) {
 *     console.log(`Rendered: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmp2pgm(inputPath: string, outputPath: string, options?: Dcmp2pgmOptions): Promise<Result<Dcmp2pgmResult>> {
    const validation = Dcmp2pgmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmp2pgm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmp2pgm');
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
        return err(createToolError('dcmp2pgm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { dcmp2pgm };
export type { Dcmp2pgmOptions, Dcmp2pgmResult };
