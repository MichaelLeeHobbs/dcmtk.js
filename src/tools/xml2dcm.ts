/**
 * Convert an XML file to DICOM format using the xml2dcm binary.
 *
 * @module xml2dcm
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link xml2dcm}. */
interface Xml2dcmOptions extends ToolBaseOptions {
    /** Generate new Study/Series/SOP Instance UIDs. Defaults to false. */
    readonly generateNewUIDs?: boolean | undefined;
    /** Validate the XML document. Defaults to false. */
    readonly validateDocument?: boolean | undefined;
}

/** Result of a successful xml2dcm conversion. */
interface Xml2dcmResult {
    /** Path to the generated DICOM output file. */
    readonly outputPath: string;
}

const Xml2dcmOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        generateNewUIDs: z.boolean().optional(),
        validateDocument: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds xml2dcm command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: Xml2dcmOptions): string[] {
    const args: string[] = [];

    if (options?.generateNewUIDs === true) {
        args.push('+Ug');
    }

    if (options?.validateDocument === true) {
        args.push('+Vd');
    }

    args.push(inputPath, outputPath);

    return args;
}

/**
 * Converts an XML file to DICOM format using the xml2dcm binary.
 *
 * @param inputPath - Path to the XML input file
 * @param outputPath - Path for the DICOM output file
 * @param options - Conversion options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await xml2dcm('/path/to/input.xml', '/path/to/output.dcm', {
 *     generateNewUIDs: true,
 * });
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function xml2dcm(inputPath: string, outputPath: string, options?: Xml2dcmOptions): Promise<Result<Xml2dcmResult>> {
    const validation = Xml2dcmOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`xml2dcm: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('xml2dcm');
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
        return err(createToolError('xml2dcm', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { xml2dcm };
export type { Xml2dcmOptions, Xml2dcmResult };
