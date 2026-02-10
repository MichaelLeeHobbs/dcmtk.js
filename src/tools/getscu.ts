/**
 * Retrieve DICOM objects using C-GET via the getscu binary.
 *
 * Sends a C-GET request to a remote DICOM SCP to retrieve
 * DICOM objects directly over the same association.
 *
 * @module getscu
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Supported C-GET query models. */
const GetQueryModel = {
    PATIENT: 'patient',
    STUDY: 'study',
} as const;

/** Union of valid get query model values. */
type GetQueryModelValue = (typeof GetQueryModel)[keyof typeof GetQueryModel];

/** Maps query model values to their CLI flags. */
const GET_QUERY_MODEL_FLAGS: Record<GetQueryModelValue, string> = {
    patient: '-P',
    study: '-S',
};

/** Options for {@link getscu}. */
interface GetscuOptions extends ToolBaseOptions {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number. */
    readonly port: number;
    /** Calling AE Title. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title. */
    readonly calledAETitle?: string | undefined;
    /** Query model to use. */
    readonly queryModel?: GetQueryModelValue | undefined;
    /** DICOM attribute keys for the query (each becomes -k). */
    readonly keys?: readonly string[] | undefined;
    /** Output directory for retrieved files (maps to -od). */
    readonly outputDirectory?: string | undefined;
}

/** Result of a successful C-GET retrieval. */
interface GetscuResult {
    /** Whether the get completed successfully. */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const GetscuOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
        queryModel: z.enum(['patient', 'study']).optional(),
        keys: z.array(z.string().min(1)).optional(),
        outputDirectory: z.string().min(1).optional(),
    })
    .strict();

/**
 * Builds getscu command-line arguments from validated options.
 */
function buildArgs(options: GetscuOptions): string[] {
    const args: string[] = [];

    if (options.callingAETitle !== undefined) {
        args.push('-aet', options.callingAETitle);
    }

    if (options.calledAETitle !== undefined) {
        args.push('-aec', options.calledAETitle);
    }

    if (options.queryModel !== undefined) {
        args.push(GET_QUERY_MODEL_FLAGS[options.queryModel]);
    }

    if (options.outputDirectory !== undefined) {
        args.push('-od', options.outputDirectory);
    }

    if (options.keys !== undefined) {
        for (const key of options.keys) {
            args.push('-k', key);
        }
    }

    args.push(options.host, String(options.port));

    return args;
}

/**
 * Retrieve DICOM objects using C-GET via the getscu binary.
 *
 * @param options - Get options (host and port required)
 * @returns A Result containing the get result or an error
 *
 * @example
 * ```ts
 * const result = await getscu({
 *     host: '192.168.1.100',
 *     port: 104,
 *     queryModel: 'study',
 *     outputDirectory: '/tmp/dicom',
 *     keys: ['0020,000D=1.2.3.4'],
 * });
 * if (result.ok) {
 *     console.log('Get succeeded');
 * }
 * ```
 */
async function getscu(options: GetscuOptions): Promise<Result<GetscuResult>> {
    const validation = GetscuOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`getscu: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('getscu');
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
        return err(createToolError('getscu', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { getscu, GetQueryModel };
export type { GetscuOptions, GetscuResult, GetQueryModelValue };
