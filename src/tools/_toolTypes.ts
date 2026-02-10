/**
 * Shared option types for all DCMTK tool wrappers.
 *
 * @module _toolTypes
 * @internal
 */

/**
 * Base options shared by all tool wrapper functions.
 * Provides configurable timeout and abort support per Rule 4.2.
 */
interface ToolBaseOptions {
    /** Timeout in milliseconds. Defaults to DEFAULT_TIMEOUT_MS. */
    readonly timeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

export type { ToolBaseOptions };
