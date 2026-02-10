/**
 * Create a DICOMDIR file from DICOM files using the dcmgpdir binary.
 *
 * @module dcmgpdir
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Default output filename when no outputFile is specified. */
const DEFAULT_DICOMDIR = 'DICOMDIR';

/** Options for {@link dcmgpdir}. */
interface DcmgpdirOptions extends ToolBaseOptions {
    /** One or more DICOM file paths to include in the DICOMDIR. */
    readonly inputFiles: readonly string[];
    /** Output DICOMDIR file path. Defaults to 'DICOMDIR'. Maps to +D flag. */
    readonly outputFile?: string | undefined;
    /** File-set ID to embed in the DICOMDIR. Maps to +F flag. */
    readonly filesetId?: string | undefined;
}

/** Result of a successful dcmgpdir operation. */
interface DcmgpdirResult {
    /** Path to the generated DICOMDIR file. */
    readonly outputPath: string;
}

const DcmgpdirOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        inputFiles: z.array(z.string().min(1)).min(1),
        outputFile: z.string().min(1).optional(),
        filesetId: z.string().min(1).optional(),
    })
    .strict();

/**
 * Builds dcmgpdir command-line arguments from validated options.
 */
function buildArgs(options: DcmgpdirOptions): string[] {
    const args: string[] = [];

    if (options.outputFile !== undefined) {
        args.push('+D', options.outputFile);
    }

    if (options.filesetId !== undefined) {
        args.push('+F', options.filesetId);
    }

    args.push(...options.inputFiles);

    return args;
}

/**
 * Creates a DICOMDIR file from DICOM files using the dcmgpdir binary.
 *
 * @param options - DICOMDIR creation options (inputFiles required)
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmgpdir({
 *     inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
 *     outputFile: '/path/to/DICOMDIR',
 *     filesetId: 'MY_FILESET',
 * });
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmgpdir(options: DcmgpdirOptions): Promise<Result<DcmgpdirResult>> {
    const validation = DcmgpdirOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmgpdir: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmgpdir');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(options);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmgpdir', args, result.value.exitCode, result.value.stderr));
    }

    const outputPath = options.outputFile ?? DEFAULT_DICOMDIR;
    return ok({ outputPath });
}

export { dcmgpdir };
export type { DcmgpdirOptions, DcmgpdirResult };
