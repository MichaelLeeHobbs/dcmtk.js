/**
 * C-STORE send using the dcmsend binary.
 *
 * Sends one or more DICOM files to a remote DICOM SCP.
 *
 * @module dcmsend
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmsend}. */
interface DcmsendOptions extends ToolBaseOptions {
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
    /** Scan input directory recursively for DICOM files. Defaults to false. */
    readonly scanDirectory?: boolean | undefined;
}

/** Result of a successful C-STORE send. */
interface DcmsendResult {
    /** Whether the send completed successfully. */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const DcmsendOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        files: z.array(z.string().min(1)).min(1),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
        scanDirectory: z.boolean().optional(),
    })
    .strict();

/**
 * Builds dcmsend command-line arguments from validated options.
 */
function buildArgs(options: DcmsendOptions): string[] {
    const args: string[] = [];

    if (options.callingAETitle !== undefined) {
        args.push('-aet', options.callingAETitle);
    }

    if (options.calledAETitle !== undefined) {
        args.push('-aec', options.calledAETitle);
    }

    if (options.scanDirectory === true) {
        args.push('--scan-directories');
    }

    args.push(options.host, String(options.port));
    args.push(...options.files);

    return args;
}

/**
 * Sends DICOM files to a remote SCP using C-STORE via the dcmsend binary.
 *
 * @param options - Send options (host, port, files required)
 * @returns A Result containing the send result or an error
 *
 * @example
 * ```ts
 * const result = await dcmsend({
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
async function dcmsend(options: DcmsendOptions): Promise<Result<DcmsendResult>> {
    const validation = DcmsendOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmsend: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmsend');
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
        return err(createToolError('dcmsend', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { dcmsend };
export type { DcmsendOptions, DcmsendResult };
