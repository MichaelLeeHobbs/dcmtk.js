/**
 * Create a DICOMDIR file from DICOM files using the dcmmkdir binary.
 *
 * @module dcmmkdir
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

/** Options for {@link dcmmkdir}. */
interface DcmmkdirOptions extends ToolBaseOptions {
    /** One or more DICOM file paths to include in the DICOMDIR. */
    readonly inputFiles: readonly string[];
    /** Output DICOMDIR file path. Defaults to 'DICOMDIR'. Maps to +D flag. */
    readonly outputFile?: string | undefined;
    /** File-set ID to embed in the DICOMDIR. Maps to +F flag. */
    readonly filesetId?: string | undefined;
    /** Append to existing DICOMDIR. Maps to +A flag. Defaults to false. */
    readonly append?: boolean | undefined;
}

/** Result of a successful dcmmkdir operation. */
interface DcmmkdirResult {
    /** Path to the generated DICOMDIR file. */
    readonly outputPath: string;
}

const DcmmkdirOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        inputFiles: z.array(z.string().min(1)).min(1),
        outputFile: z.string().min(1).optional(),
        filesetId: z.string().min(1).optional(),
        append: z.boolean().optional(),
    })
    .strict();

/**
 * Builds dcmmkdir command-line arguments from validated options.
 */
function buildArgs(options: DcmmkdirOptions): string[] {
    const args: string[] = [];

    if (options.outputFile !== undefined) {
        args.push('+D', options.outputFile);
    }

    if (options.filesetId !== undefined) {
        args.push('+F', options.filesetId);
    }

    if (options.append === true) {
        args.push('+A');
    }

    args.push(...options.inputFiles);

    return args;
}

/**
 * Creates a DICOMDIR file from DICOM files using the dcmmkdir binary.
 *
 * @param options - DICOMDIR creation options (inputFiles required)
 * @returns A Result containing the output path or an error
 *
 * @example
 * ```ts
 * const result = await dcmmkdir({
 *     inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
 *     outputFile: '/path/to/DICOMDIR',
 *     filesetId: 'MY_FILESET',
 * });
 * if (result.ok) {
 *     console.log(`Created: ${result.value.outputPath}`);
 * }
 * ```
 */
async function dcmmkdir(options: DcmmkdirOptions): Promise<Result<DcmmkdirResult>> {
    const validation = DcmmkdirOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmmkdir: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmmkdir');
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
        return err(createToolError('dcmmkdir', args, result.value.exitCode, result.value.stderr));
    }

    const outputPath = options.outputFile ?? DEFAULT_DICOMDIR;
    return ok({ outputPath });
}

export { dcmmkdir };
export type { DcmmkdirOptions, DcmmkdirResult };
