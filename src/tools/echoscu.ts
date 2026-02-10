/**
 * C-ECHO verification using the echoscu binary.
 *
 * Tests DICOM network connectivity by sending a C-ECHO request
 * to a remote DICOM SCP (Service Class Provider).
 *
 * @module echoscu
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link echoscu}. */
interface EchoscuOptions extends ToolBaseOptions {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number. */
    readonly port: number;
    /** Calling AE Title. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title. */
    readonly calledAETitle?: string | undefined;
}

/** Result of a successful C-ECHO. */
interface EchoscuResult {
    /** Whether the echo succeeded (exit code 0). */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const EchoscuOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
    })
    .strict();

/**
 * Builds echoscu command-line arguments from validated options.
 */
function buildArgs(options: EchoscuOptions): string[] {
    const args: string[] = [];

    if (options.callingAETitle !== undefined) {
        args.push('-aet', options.callingAETitle);
    }

    if (options.calledAETitle !== undefined) {
        args.push('-aec', options.calledAETitle);
    }

    args.push(options.host, String(options.port));

    return args;
}

/**
 * Sends a C-ECHO request to a remote DICOM SCP to verify connectivity.
 *
 * @param options - Echo options (host and port required)
 * @returns A Result containing the echo result or an error
 *
 * @example
 * ```ts
 * const result = await echoscu({ host: '192.168.1.100', port: 104 });
 * if (result.ok) {
 *     console.log(result.value.success ? 'Echo succeeded' : 'Echo failed');
 * }
 * ```
 */
async function echoscu(options: EchoscuOptions): Promise<Result<EchoscuResult>> {
    const validation = EchoscuOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`echoscu: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('echoscu');
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
        return err(createToolError('echoscu', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { echoscu };
export type { EchoscuOptions, EchoscuResult };
