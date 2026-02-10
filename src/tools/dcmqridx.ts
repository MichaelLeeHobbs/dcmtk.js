/**
 * Register DICOM files in a dcmqrscp index database using the dcmqridx binary.
 *
 * @module dcmqridx
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmqridx}. */
interface DcmqridxOptions extends ToolBaseOptions {
    /** Storage area / index directory path (required). */
    readonly indexDirectory: string;
    /** DICOM files to register. Omit for print-only mode. */
    readonly inputFiles?: readonly string[] | undefined;
    /** List database contents (-p flag). */
    readonly print?: boolean | undefined;
    /** Mark status as "not new" (-n flag). */
    readonly notNew?: boolean | undefined;
}

/** Result of a successful dcmqridx operation. */
type DcmqridxResult = { readonly mode: 'register' } | { readonly mode: 'print'; readonly output: string };

const DcmqridxOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        indexDirectory: z.string().min(1),
        inputFiles: z.array(z.string().min(1)).min(1).optional(),
        print: z.boolean().optional(),
        notNew: z.boolean().optional(),
    })
    .strict()
    .refine(data => (data.inputFiles !== undefined && data.inputFiles.length > 0) || data.print === true, {
        message: 'Either inputFiles (non-empty) or print must be specified',
    });

/**
 * Builds dcmqridx command-line arguments from validated options.
 */
function buildArgs(options: DcmqridxOptions): string[] {
    const args: string[] = [];

    if (options.print === true) {
        args.push('-p');
    }

    if (options.notNew === true) {
        args.push('-n');
    }

    args.push(options.indexDirectory);

    if (options.inputFiles !== undefined) {
        args.push(...options.inputFiles);
    }

    return args;
}

/**
 * Register DICOM files in a dcmqrscp index database or print database contents.
 *
 * @param options - Index operation options (indexDirectory required)
 * @returns A Result containing the operation result or an error
 */
async function dcmqridx(options: DcmqridxOptions): Promise<Result<DcmqridxResult>> {
    const validation = DcmqridxOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmqridx: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmqridx');
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
        return err(createToolError('dcmqridx', args, result.value.exitCode, result.value.stderr));
    }

    if (options.print === true) {
        return ok({ mode: 'print' as const, output: result.value.stdout });
    }

    return ok({ mode: 'register' as const });
}

export { dcmqridx };
export type { DcmqridxOptions, DcmqridxResult };
