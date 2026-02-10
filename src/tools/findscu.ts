/**
 * Query a remote DICOM SCP using C-FIND via the findscu binary.
 *
 * Performs DICOM C-FIND queries against a remote SCP for worklist,
 * patient, or study-level information.
 *
 * @module findscu
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Supported C-FIND query models. */
const QueryModel = {
    WORKLIST: 'worklist',
    PATIENT: 'patient',
    STUDY: 'study',
} as const;

/** Union of valid query model values. */
type QueryModelValue = (typeof QueryModel)[keyof typeof QueryModel];

/** Maps query model values to their CLI flags. */
const QUERY_MODEL_FLAGS: Record<QueryModelValue, string> = {
    worklist: '-W',
    patient: '-P',
    study: '-S',
};

/** Options for {@link findscu}. */
interface FindscuOptions extends ToolBaseOptions {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number. */
    readonly port: number;
    /** Calling AE Title. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title. */
    readonly calledAETitle?: string | undefined;
    /** Query model to use. */
    readonly queryModel?: QueryModelValue | undefined;
    /** DICOM attribute keys for the query (each becomes -k). */
    readonly keys?: readonly string[] | undefined;
}

/** Result of a successful C-FIND query. */
interface FindscuResult {
    /** Whether the query completed successfully. */
    readonly success: boolean;
    /** Raw stderr output for diagnostic info. */
    readonly stderr: string;
}

const FindscuOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
        queryModel: z.enum(['worklist', 'patient', 'study']).optional(),
        keys: z.array(z.string().min(1)).optional(),
    })
    .strict();

/**
 * Builds findscu command-line arguments from validated options.
 */
function buildArgs(options: FindscuOptions): string[] {
    const args: string[] = [];

    if (options.callingAETitle !== undefined) {
        args.push('-aet', options.callingAETitle);
    }

    if (options.calledAETitle !== undefined) {
        args.push('-aec', options.calledAETitle);
    }

    if (options.queryModel !== undefined) {
        args.push(QUERY_MODEL_FLAGS[options.queryModel]);
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
 * Query a remote DICOM SCP using C-FIND via the findscu binary.
 *
 * @param options - Find options (host and port required)
 * @returns A Result containing the find result or an error
 *
 * @example
 * ```ts
 * const result = await findscu({
 *     host: '192.168.1.100',
 *     port: 104,
 *     queryModel: 'study',
 *     keys: ['0008,0050=', '0010,0020=PATIENT1'],
 * });
 * if (result.ok) {
 *     console.log('Query succeeded');
 * }
 * ```
 */
async function findscu(options: FindscuOptions): Promise<Result<FindscuResult>> {
    const validation = FindscuOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`findscu: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('findscu');
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
        return err(createToolError('findscu', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ success: true, stderr: result.value.stderr });
}

export { findscu, QueryModel };
export type { FindscuOptions, FindscuResult, QueryModelValue };
