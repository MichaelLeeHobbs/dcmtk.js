/**
 * Convert a DICOM structured report to XML using the dsr2xml binary.
 *
 * @module dsr2xml
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dsr2xml}. */
interface Dsr2xmlOptions extends ToolBaseOptions {
    /** Use XML namespace. Maps to +Xn. Defaults to false. */
    readonly useNamespace?: boolean | undefined;
    /** Add XML Schema reference. Maps to +Xs. Defaults to false. */
    readonly addSchemaRef?: boolean | undefined;
}

/** Result of a successful dsr2xml conversion. */
interface Dsr2xmlResult {
    /** The XML text output from dsr2xml. */
    readonly text: string;
}

const Dsr2xmlOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        useNamespace: z.boolean().optional(),
        addSchemaRef: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dsr2xml command-line arguments from validated options.
 */
function buildArgs(inputPath: string, options?: Dsr2xmlOptions): string[] {
    const args: string[] = [];

    if (options?.useNamespace === true) {
        args.push('+Xn');
    }

    if (options?.addSchemaRef === true) {
        args.push('+Xs');
    }

    args.push(inputPath);

    return args;
}

/**
 * Converts a DICOM structured report to XML using the dsr2xml binary.
 *
 * @param inputPath - Path to the DICOM SR input file
 * @param options - Conversion options
 * @returns A Result containing the XML text or an error
 *
 * @example
 * ```ts
 * const result = await dsr2xml('/path/to/report.dcm', { useNamespace: true });
 * if (result.ok) {
 *     console.log(result.value.text);
 * }
 * ```
 */
async function dsr2xml(inputPath: string, options?: Dsr2xmlOptions): Promise<Result<Dsr2xmlResult>> {
    const validation = Dsr2xmlOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dsr2xml: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dsr2xml');
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
        return err(createToolError('dsr2xml', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ text: result.value.stdout });
}

export { dsr2xml };
export type { Dsr2xmlOptions, Dsr2xmlResult };
