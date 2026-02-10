/**
 * Convert an XML document to a DICOM structured report using the xml2dsr binary.
 *
 * @module xml2dsr
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link xml2dsr}. */
interface Xml2dsrOptions extends ToolBaseOptions {
    /** Generate new Study/Series/SOP Instance UIDs. Maps to +Ug. Defaults to false. */
    readonly generateNewUIDs?: boolean | undefined;
    /** Validate the SR document. Maps to +Vd. Defaults to false. */
    readonly validateDocument?: boolean | undefined;
}

/** Result of a successful xml2dsr conversion. */
interface Xml2dsrResult {
    /** Path to the generated DICOM SR output file. */
    readonly outputPath: string;
}

const Xml2dsrOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        generateNewUIDs: z.boolean().optional(),
        validateDocument: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds xml2dsr command-line arguments from validated options.
 */
function buildArgs(inputPath: string, outputPath: string, options?: Xml2dsrOptions): string[] {
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
 * Converts an XML document to a DICOM structured report using the xml2dsr binary.
 *
 * @param inputPath - Path to the XML input file
 * @param outputPath - Path for the DICOM SR output file
 * @param options - Conversion options
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await xml2dsr('/path/to/report.xml', '/path/to/output.dcm', {
 *     generateNewUIDs: true,
 * });
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function xml2dsr(inputPath: string, outputPath: string, options?: Xml2dsrOptions): Promise<Result<Xml2dsrResult>> {
    const validation = Xml2dsrOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`xml2dsr: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('xml2dsr');
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
        return err(createToolError('xml2dsr', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ outputPath });
}

export { xml2dsr };
export type { Xml2dsrOptions, Xml2dsrResult };
