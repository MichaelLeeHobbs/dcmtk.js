/**
 * Send DICOM files using C-STORE via the storescu binary.
 *
 * Sends one or more DICOM files to a remote DICOM SCP
 * (Service Class Provider) using the DICOM C-STORE protocol.
 *
 * @module storescu
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link storescu}. */
interface StorescuOptions extends ToolBaseOptions {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number. */
    readonly port: number;
    /** One or more DICOM file paths to send. */
    readonly files: readonly string[];
    /** Calling AE Title. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title. */
    readonly calledAETitle?: string | undefined;
    /** Scan directories for DICOM files. */
    readonly scanDirectories?: boolean | undefined;
    /** Recurse into subdirectories (requires scanDirectories). */
    readonly recurse?: boolean | undefined;
}

/** Result of a successful C-STORE send. */
interface StorescuResult {
    /** Whether the store completed successfully. */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const StorescuOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        files: z.array(z.string().min(1)).min(1),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
        scanDirectories: z.boolean().optional(),
        recurse: z.boolean().optional(),
    })
    .strict();

/**
 * Builds storescu command-line arguments from validated options.
 */
function buildArgs(options: StorescuOptions): string[] {
    const args: string[] = [];

    if (options.callingAETitle !== undefined) {
        args.push('-aet', options.callingAETitle);
    }

    if (options.calledAETitle !== undefined) {
        args.push('-aec', options.calledAETitle);
    }

    if (options.scanDirectories === true) {
        args.push('+sd');
    }

    if (options.recurse === true) {
        args.push('+r');
    }

    args.push(options.host, String(options.port));
    args.push(...options.files);

    return args;
}

/**
 * Send DICOM files using C-STORE via the storescu binary.
 *
 * @param options - Store options (host, port, files required)
 * @returns A Result containing the store result or an error
 *
 * @example
 * ```ts
 * const result = await storescu({
 *     host: '192.168.1.100',
 *     port: 104,
 *     files: ['/path/to/study.dcm'],
 *     calledAETitle: 'PACS',
 * });
 * if (result.ok && result.value.success) {
 *     console.log('Files sent successfully');
 * }
 * ```
 */
async function storescu(options: StorescuOptions): Promise<Result<StorescuResult>> {
    const validation = StorescuOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`storescu: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('storescu');
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
        return err(createToolError('storescu', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { storescu };
export type { StorescuOptions, StorescuResult };
