/**
 * Send a DICOM print job to a remote printer using the dcmprscu binary.
 *
 * @module dcmprscu
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmprscu}. */
interface DcmprscuOptions extends ToolBaseOptions {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number. */
    readonly port: number;
    /** Calling AE Title. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title. */
    readonly calledAETitle?: string | undefined;
    /** Path to a configuration file. Maps to -c flag. */
    readonly configFile?: string | undefined;
}

/** Result of a successful dcmprscu operation. */
interface DcmprscuResult {
    /** Whether the print job was sent successfully. */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const DcmprscuOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
        configFile: z.string().min(1).optional(),
    })
    .strict();

/**
 * Builds dcmprscu command-line arguments from validated options.
 */
function buildArgs(options: DcmprscuOptions): string[] {
    const args: string[] = [];

    if (options.callingAETitle !== undefined) {
        args.push('-aet', options.callingAETitle);
    }

    if (options.calledAETitle !== undefined) {
        args.push('-aec', options.calledAETitle);
    }

    if (options.configFile !== undefined) {
        args.push('-c', options.configFile);
    }

    args.push(options.host, String(options.port));

    return args;
}

/**
 * Sends a DICOM print job to a remote printer using the dcmprscu binary.
 *
 * @param options - Print options (host and port required)
 * @returns A Result containing the print result or an error
 *
 * @example
 * ```ts
 * const result = await dcmprscu({
 *     host: '192.168.1.100',
 *     port: 104,
 *     callingAETitle: 'MYSCU',
 *     calledAETitle: 'PRINTER',
 * });
 * if (result.ok) {
 *     console.log(result.value.success ? 'Print sent' : 'Print failed');
 * }
 * ```
 */
async function dcmprscu(options: DcmprscuOptions): Promise<Result<DcmprscuResult>> {
    const validation = DcmprscuOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmprscu: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmprscu');
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
        return err(createToolError('dcmprscu', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { dcmprscu };
export type { DcmprscuOptions, DcmprscuResult };
