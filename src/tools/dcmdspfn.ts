/**
 * Export display function curves using the dcmdspfn binary.
 *
 * Generates GSDF (Grayscale Standard Display Function) lookup tables
 * for monitor, camera, or printer calibration.
 *
 * @module dcmdspfn
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { execCommand } from '../exec';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import { resolveBinary } from './_resolveBinary';
import { createToolError } from './_toolError';
import type { ToolBaseOptions } from './_toolTypes';

/** Options for {@link dcmdspfn}. */
interface DcmdspfnOptions extends ToolBaseOptions {
    /** Path to monitor characteristics file. Maps to `+Im`. */
    readonly monitorFile?: string | undefined;
    /** Path to camera characteristics file. Maps to `+Ic`. */
    readonly cameraFile?: string | undefined;
    /** Path to printer characteristics file. Maps to `+Ip`. */
    readonly printerFile?: string | undefined;
    /** Ambient light value in cd/m2. Maps to `+Ca`. */
    readonly ambientLight?: number | undefined;
}

/** Result of a successful dcmdspfn operation. */
interface DcmdspfnResult {
    /** The text output from dcmdspfn. */
    readonly text: string;
}

const DcmdspfnOptionsSchema = z
    .object({
        timeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
        monitorFile: z.string().min(1).optional(),
        cameraFile: z.string().min(1).optional(),
        printerFile: z.string().min(1).optional(),
        ambientLight: z.number().positive().optional(),
    })
    .strict()
    .optional();

/**
 * Builds dcmdspfn command-line arguments from validated options.
 */
function buildArgs(options?: DcmdspfnOptions): string[] {
    const args: string[] = [];

    if (options?.monitorFile !== undefined) {
        args.push('+Im', options.monitorFile);
    }

    if (options?.cameraFile !== undefined) {
        args.push('+Ic', options.cameraFile);
    }

    if (options?.printerFile !== undefined) {
        args.push('+Ip', options.printerFile);
    }

    if (options?.ambientLight !== undefined) {
        args.push('+Ca', String(options.ambientLight));
    }

    return args;
}

/**
 * Exports display function curves using the dcmdspfn binary.
 *
 * @param options - Optional display function options
 * @returns A Result containing the text output or an error
 *
 * @example
 * ```ts
 * const result = await dcmdspfn({ monitorFile: '/path/to/monitor.lut' });
 * if (result.ok) {
 *     console.log(result.value.text);
 * }
 * ```
 */
async function dcmdspfn(options?: DcmdspfnOptions): Promise<Result<DcmdspfnResult>> {
    const validation = DcmdspfnOptionsSchema.safeParse(options);
    if (!validation.success) {
        return err(new Error(`dcmdspfn: invalid options: ${validation.error.message}`));
    }

    const binaryResult = resolveBinary('dcmdspfn');
    if (!binaryResult.ok) {
        return err(binaryResult.error);
    }

    const args = buildArgs(options);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const result = await execCommand(binaryResult.value, args, {
        timeoutMs,
        signal: options?.signal,
    });

    if (!result.ok) {
        return err(result.error);
    }

    if (result.value.exitCode !== 0) {
        return err(createToolError('dcmdspfn', args, result.value.exitCode, result.value.stderr));
    }

    return ok({ text: result.value.stdout });
}

export { dcmdspfn };
export type { DcmdspfnOptions, DcmdspfnResult };
