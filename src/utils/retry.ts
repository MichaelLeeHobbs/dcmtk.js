/**
 * Retry utility with exponential backoff for unreliable operations.
 *
 * @module utils/retry
 */

import type { Result } from '../types';

/** Default maximum number of attempts (including initial). */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Default initial delay in milliseconds before first retry. */
const DEFAULT_INITIAL_DELAY_MS = 1000;

/** Default maximum delay in milliseconds. */
const DEFAULT_MAX_DELAY_MS = 30_000;

/** Default backoff multiplier. */
const DEFAULT_BACKOFF_MULTIPLIER = 2;

/** Jitter range as a fraction of the delay (10%). */
const JITTER_FRACTION = 0.1;

/**
 * Options for retry behavior.
 */
interface RetryOptions {
    /** Maximum number of attempts (including initial). Defaults to 3. */
    readonly maxAttempts?: number | undefined;
    /** Initial delay in milliseconds before first retry. Defaults to 1000. */
    readonly initialDelayMs?: number | undefined;
    /** Maximum delay in milliseconds. Defaults to 30000. */
    readonly maxDelayMs?: number | undefined;
    /** Backoff multiplier. Defaults to 2. */
    readonly backoffMultiplier?: number | undefined;
    /** Optional predicate to determine if a failed result should be retried. */
    readonly shouldRetry?: ((error: Error, attempt: number) => boolean) | undefined;
    /** AbortSignal for cancelling retries. */
    readonly signal?: AbortSignal | undefined;
    /** Called before each retry attempt. */
    readonly onRetry?: ((error: Error, attempt: number, delayMs: number) => void) | undefined;
}

/** Resolved retry configuration with defaults applied. */
interface ResolvedRetryConfig {
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
    readonly backoffMultiplier: number;
    readonly shouldRetry: ((error: Error, attempt: number) => boolean) | undefined;
    readonly signal: AbortSignal | undefined;
    readonly onRetry: ((error: Error, attempt: number, delayMs: number) => void) | undefined;
}

/** Default configuration applied when no options provided. */
const DEFAULT_CONFIG: ResolvedRetryConfig = {
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    initialDelayMs: DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs: DEFAULT_MAX_DELAY_MS,
    backoffMultiplier: DEFAULT_BACKOFF_MULTIPLIER,
    shouldRetry: undefined,
    signal: undefined,
    onRetry: undefined,
};

/**
 * Resolves retry options with defaults applied.
 */
function resolveConfig(opts: RetryOptions | undefined): ResolvedRetryConfig {
    if (!opts) return DEFAULT_CONFIG;
    return {
        ...DEFAULT_CONFIG,
        ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)),
        maxAttempts: Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
    };
}

/**
 * Computes the delay for a given attempt with exponential backoff and jitter.
 *
 * @param attempt - The zero-based retry attempt number (0 = first retry)
 * @param config - The resolved retry configuration
 * @returns The delay in milliseconds, with jitter applied
 */
function computeDelay(attempt: number, config: ResolvedRetryConfig): number {
    const baseDelay = Math.min(config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt), config.maxDelayMs);
    const jitter = baseDelay * JITTER_FRACTION * (2 * Math.random() - 1);
    return Math.max(0, Math.round(baseDelay + jitter));
}

/**
 * Waits for the specified delay, but resolves early if the AbortSignal fires.
 *
 * @param delayMs - The delay in milliseconds
 * @param signal - Optional AbortSignal to cancel the wait
 * @returns True if the wait completed normally, false if aborted
 */
async function waitWithAbort(delayMs: number, signal: AbortSignal | undefined): Promise<boolean> {
    /* v8 ignore next 3 -- retry loop checks aborted before calling waitWithAbort */
    if (signal?.aborted) {
        return false;
    }
    return new Promise<boolean>(resolve => {
        const timer = setTimeout(() => {
            cleanup();
            resolve(true);
        }, delayMs);

        const onAbort = (): void => {
            clearTimeout(timer);
            cleanup();
            resolve(false);
        };

        const cleanup = (): void => {
            signal?.removeEventListener('abort', onAbort);
        };

        if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
}

/**
 * Determines whether the retry loop should break after a failed attempt.
 *
 * @returns True if the loop should break (stop retrying)
 */
function shouldBreakAfterFailure(attempt: number, lastError: Error, config: ResolvedRetryConfig): boolean {
    if (attempt === config.maxAttempts - 1) return true;
    if (config.shouldRetry && !config.shouldRetry(lastError, attempt + 1)) return true;
    if (config.signal?.aborted) return true;
    return false;
}

/**
 * Retries an operation with exponential backoff.
 *
 * The operation is called up to `maxAttempts` times. On failure, the delay
 * before the next retry grows exponentially (with jitter) up to `maxDelayMs`.
 * An AbortSignal can cancel the retry loop between attempts.
 *
 * @param operation - Async function returning Result<T>
 * @param options - Retry options
 * @returns The first successful result, or the last failure
 *
 * @example
 * ```ts
 * import { retry, echoscu } from 'dcmtk';
 *
 * const result = await retry(
 *     () => echoscu({ host: 'pacs.hospital.org', port: 104 }),
 *     { maxAttempts: 5, initialDelayMs: 2000 }
 * );
 * ```
 */
async function retry<T>(operation: () => Promise<Result<T>>, options?: RetryOptions): Promise<Result<T>> {
    const config = resolveConfig(options);
    let lastResult: Result<T> | undefined;

    for (let attempt = 0; attempt < config.maxAttempts; attempt += 1) {
        lastResult = await operation();
        if (lastResult.ok) return lastResult;
        if (shouldBreakAfterFailure(attempt, lastResult.error, config)) break;

        const delayMs = computeDelay(attempt, config);
        if (config.onRetry) config.onRetry(lastResult.error, attempt + 1, delayMs);

        const waitCompleted = await waitWithAbort(delayMs, config.signal);
        if (!waitCompleted) break;
    }

    return lastResult as Result<T>;
}

export { retry };
export type { RetryOptions };
