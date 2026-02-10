/**
 * DICOM to XML conversion using the dcm2xml binary.
 *
 * Converts a DICOM file to the DCMTK Native DICOM Model XML format.
 *
 * @module dcm2xml
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
 * Charset handling modes for dcm2xml.
 */
const Dcm2xmlCharset = {
    /** Use UTF-8 encoding (default). */
    UTF8: 'utf8',
    /** Use Latin-1 encoding. */
    LATIN1: 'latin1',
    /** Use ASCII encoding. */
    ASCII: 'ascii',
} as const;

type Dcm2xmlCharsetValue = (typeof Dcm2xmlCharset)[keyof typeof Dcm2xmlCharset];

/** Options for {@link dcm2xml}. */
interface Dcm2xmlOptions extends ToolBaseOptions {
    /** Include namespace declaration in XML output. Defaults to false. */
    readonly namespace?: boolean | undefined;
    /** Character set for XML output. Defaults to 'utf8'. */
    readonly charset?: Dcm2xmlCharsetValue | undefined;
    /** Write binary data to XML (base64 encoded). Defaults to false. */
    readonly writeBinaryData?: boolean | undefined;
    /** Encode binary data inline instead of referencing external files. Defaults to true when writeBinaryData is true. */
    readonly encodeBinaryBase64?: boolean | undefined;
}

/** Result of a successful dcm2xml conversion. */
interface Dcm2xmlResult {
    /** The XML output string in DCMTK Native DICOM Model format. */
    readonly xml: string;
}

const Dcm2xmlOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        namespace: z.boolean().optional(),
        charset: z.enum(['utf8', 'latin1', 'ascii']).optional(),
        writeBinaryData: z.boolean().optional(),
        encodeBinaryBase64: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcm2xml command-line arguments from validated options.
 *
 * @param inputPath - Path to the DICOM input file
 * @param options - Validated options
 * @returns Argument array
 */
function buildArgs(inputPath: string, options?: Dcm2xmlOptions): string[] {
    const args: string[] = [];

    if (options?.namespace === true) {
        args.push('+Xn');
    }

    if (options?.charset === 'latin1') {
        args.push('+Cl');
    } else if (options?.charset === 'ascii') {
        args.push('+Ca');
    }

    if (options?.writeBinaryData === true) {
        args.push('+Wb');
        if (options.encodeBinaryBase64 !== false) {
            args.push('+Eb');
        }
    }

    args.push(inputPath);

    return args;
}

/**
 * Converts a DICOM file to XML using the dcm2xml binary.
 *
 * @param inputPath - Path to the DICOM input file
 * @param options - Conversion options
 * @returns A Result containing the XML string or an error
 *
 * @example
 * ```ts
 * const result = await dcm2xml('/path/to/study.dcm');
 * if (result.ok) {
 *     console.log(result.value.xml);
 * }
 * ```
 */
async function dcm2xml(inputPath: string, options?: Dcm2xmlOptions): Promise<Result<Dcm2xmlResult>> {
    const validation = Dcm2xmlOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcm2xml: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcm2xml');
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
        return err(createToolError('dcm2xml', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ xml: result.value.stdout });
}

export { dcm2xml, Dcm2xmlCharset };
export type { Dcm2xmlOptions, Dcm2xmlResult, Dcm2xmlCharsetValue };
