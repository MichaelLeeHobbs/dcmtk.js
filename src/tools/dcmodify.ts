/**
 * Modify DICOM tags using the dcmodify binary.
 *
 * Uses spawnCommand instead of execCommand because user-supplied DICOM values
 * could contain shell metacharacters. Spawn passes args as an array with no
 * shell interpolation (Rule 7.4).
 *
 * @module dcmodify
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { spawnCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** A single tag modification. */
interface TagModification {
    /** DICOM tag to modify, e.g. "(0010,0010)". */
    readonly tag: string;
    /** New value for the tag. */
    readonly value: string;
}

/** Options for {@link dcmodify}. */
interface DcmodifyOptions extends ToolBaseOptions {
    /** Tag modifications to apply. */
    readonly modifications?: readonly TagModification[] | undefined;
    /** Tag paths to erase (passed as `-e path`). */
    readonly erasures?: readonly string[] | undefined;
    /** Erase all private tags (uses `-ep` flag). */
    readonly erasePrivateTags?: boolean | undefined;
    /** Do not create backup (.bak) file. Defaults to true. */
    readonly noBackup?: boolean | undefined;
    /** Insert tag if it doesn't exist (uses -i flag). Defaults to false. */
    readonly insertIfMissing?: boolean | undefined;
}

/** Result of a successful dcmodify operation. */
interface DcmodifyResult {
    /** Path to the modified DICOM file. */
    readonly filePath: string;
}

/** Matches a single tag or a dotted tag path: (XXXX,XXXX) or (XXXX,XXXX)[N].(XXXX,XXXX) */
const TAG_OR_PATH_PATTERN = /^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)(\[\d+\](\.\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)(\[\d+\])?)*)?$/;

const TagModificationSchema = z.object({
    tag: z.string().regex(TAG_OR_PATH_PATTERN),
    value: z.string(),
});

const DcmodifyOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        modifications: z.array(TagModificationSchema).optional().default([]),
        erasures: z.array(z.string()).optional(),
        erasePrivateTags: z.boolean().optional(),
        noBackup: z.boolean().optional(),
        insertIfMissing: z.boolean().optional(),
    })
    .strict()
    .refine(data => data.modifications.length > 0 || (data.erasures !== undefined && data.erasures.length > 0) || data.erasePrivateTags === true, {
        message: 'At least one of modifications, erasures, or erasePrivateTags is required',
    });

/**
 * Builds dcmodify command-line arguments from validated options.
 */
function buildArgs(inputPath: string, options: DcmodifyOptions): string[] {
    const args: string[] = [];

    if (options.noBackup !== false) {
        args.push('-nb');
    }

    const flag = options.insertIfMissing === true ? '-i' : '-m';
    const modifications = options.modifications ?? [];

    for (const mod of modifications) {
        args.push(flag, `${mod.tag}=${mod.value}`);
    }

    if (options.erasures !== undefined) {
        for (const erasure of options.erasures) {
            args.push('-e', erasure);
        }
    }

    if (options.erasePrivateTags === true) {
        args.push('-ep');
    }

    args.push(inputPath);

    return args;
}

/**
 * Modifies DICOM tags in a file using the dcmodify binary.
 *
 * Uses spawn (not exec) for safety with user-supplied values.
 *
 * @param inputPath - Path to the DICOM file to modify (modified in-place)
 * @param options - Modification options
 * @returns A Result containing the file path or an error
 *
 * @example
 * ```ts
 * const result = await dcmodify('/path/to/study.dcm', {
 *     modifications: [
 *         { tag: '(0010,0010)', value: 'Anonymous' },
 *         { tag: '(0010,0020)', value: 'ANON001' },
 *     ],
 * });
 * ```
 */
async function dcmodify(inputPath: string, options: DcmodifyOptions): Promise<Result<DcmodifyResult>> {
    const validation = DcmodifyOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmodify: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmodify');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(inputPath, options);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await spawnCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmodify', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ filePath: inputPath });
}

export { dcmodify };
export type { DcmodifyOptions, DcmodifyResult, TagModification };
