/**
 * Terminate a DICOM association using the termscu binary.
 *
 * Sends an A-ABORT or A-RELEASE request to terminate an existing
 * DICOM association with a remote SCP.
 *
 * @module termscu
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link termscu}. */
interface TermscuOptions extends ToolBaseOptions {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number. */
    readonly port: number;
    /** Calling AE Title. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title. */
    readonly calledAETitle?: string | undefined;
}

/** Result of a successful termscu operation. */
interface TermscuResult {
    /** Whether the termination succeeded (exit code 0). */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const TermscuOptionsSchema = z
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
 * Builds termscu command-line arguments from validated options.
 */
function buildArgs(options: TermscuOptions): string[] {
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
 * Terminates a DICOM association with a remote SCP using the termscu binary.
 *
 * @param options - Termination options (host and port required)
 * @returns A Result containing the termination result or an error
 *
 * @example
 * ```ts
 * const result = await termscu({ host: '192.168.1.100', port: 104 });
 * if (result.ok) {
 *     console.log(result.value.success ? 'Terminated' : 'Failed');
 * }
 * ```
 */
async function termscu(options: TermscuOptions): Promise<Result<TermscuResult>> {
    const validation = TermscuOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`termscu: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('termscu');
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
        return err(createToolError('termscu', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { termscu };
export type { TermscuOptions, TermscuResult };
