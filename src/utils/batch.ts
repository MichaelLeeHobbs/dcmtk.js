/**
 * Batch processing utility for running DCMTK operations on multiple files.
 * Provides concurrency control and progress tracking.
 *
 * Note: Streaming APIs are not provided because DCMTK binaries operate on
 * complete files, not streams. For large file processing, use {@link batch}
 * to process files in parallel with concurrency control.
 *
 * @module utils/batch
 */

import type { Result } from '../types';
import { err } from '../types';

/** Minimum allowed concurrency. */
const MIN_CONCURRENCY = 1;

/** Maximum allowed concurrency. */
const MAX_CONCURRENCY = 64;

/** Default concurrency when not specified. */
const DEFAULT_CONCURRENCY = 4;

/**
 * Options for batch processing.
 */
interface BatchOptions<T> {
    /** Maximum number of concurrent operations. Defaults to 4. Min 1, max 64. */
    readonly concurrency?: number | undefined;
    /** Called after each item completes (success or failure). */
    readonly onProgress?: ((completed: number, total: number, result: Result<T>) => void) | undefined;
    /** AbortSignal for cancelling all remaining work. */
    readonly signal?: AbortSignal | undefined;
}

/**
 * Aggregated results from a batch operation.
 */
interface BatchResult<T> {
    /** Results in the same order as the input items. */
    readonly results: ReadonlyArray<Result<T>>;
    /** Number of successful operations. */
    readonly succeeded: number;
    /** Number of failed operations. */
    readonly failed: number;
}

/** Mutable state for tracking batch progress. */
interface BatchState<TResult> {
    readonly results: Array<Result<TResult> | undefined>;
    succeeded: number;
    failed: number;
    completed: number;
}

/**
 * Clamps the concurrency value to the valid range [1, 64].
 */
function clampConcurrency(value: number | undefined): number {
    if (value === undefined) return DEFAULT_CONCURRENCY;
    return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, Math.floor(value)));
}

/**
 * Creates a fresh batch state for tracking results.
 */
function createBatchState<TResult>(total: number): BatchState<TResult> {
    const results: Array<Result<TResult> | undefined> = [];
    for (let i = 0; i < total; i += 1) {
        results.push(undefined);
    }
    return { results, succeeded: 0, failed: 0, completed: 0 };
}

/**
 * Processes a single item and records the result in the batch state.
 */
async function processItem<TItem, TResult>(
    item: TItem,
    index: number,
    operation: (item: TItem) => Promise<Result<TResult>>,
    state: BatchState<TResult>
): Promise<void> {
    let result: Result<TResult>;
    try {
        result = await operation(item);
    } catch (thrown: unknown) {
        const error = thrown instanceof Error ? thrown : new Error(String(thrown));
        result = err(error);
    }
    state.results[index] = result;
    state.completed += 1;
    if (result.ok) {
        state.succeeded += 1;
    } else {
        state.failed += 1;
    }
}

/**
 * Processes items in parallel with concurrency control.
 *
 * Items are launched in order but may complete out of order. Results are
 * always returned in the same order as the input items. When the AbortSignal
 * fires, no new items are launched, but in-flight operations are allowed to
 * complete.
 *
 * @param items - Array of input items to process
 * @param operation - Async function to apply to each item, returning Result<T>
 * @param options - Batch processing options
 * @returns Aggregated results with success/failure counts
 *
 * @example
 * ```ts
 * import { batch, dcmconv, TransferSyntax } from 'dcmtk';
 *
 * const files = ['a.dcm', 'b.dcm', 'c.dcm'];
 * const results = await batch(
 *     files,
 *     file => dcmconv(file, `${file}.converted`, { transferSyntax: TransferSyntax.JPEG_LOSSLESS }),
 *     { concurrency: 2, onProgress: (done, total) => console.log(`${done}/${total}`) }
 * );
 * console.log(`Succeeded: ${results.succeeded}, Failed: ${results.failed}`);
 * ```
 */
async function batch<TItem, TResult>(
    items: readonly TItem[],
    operation: (item: TItem) => Promise<Result<TResult>>,
    options?: BatchOptions<TResult>
): Promise<BatchResult<TResult>> {
    const concurrency = clampConcurrency(options?.concurrency);
    const signal = options?.signal;
    const onProgress = options?.onProgress;
    const total = items.length;

    if (total === 0) {
        return { results: [], succeeded: 0, failed: 0 };
    }

    const state = createBatchState<TResult>(total);
    const inFlight = new Set<Promise<void>>();
    let nextIndex = 0;

    while (nextIndex < total) {
        if (signal?.aborted) break;

        const itemIndex = nextIndex;
        nextIndex += 1;

        const promise = processItem(items[itemIndex] as TItem, itemIndex, operation, state).then(() => {
            if (onProgress) {
                const result = state.results[itemIndex] as Result<TResult>;
                onProgress(state.completed, total, result);
            }
        });
        inFlight.add(promise);
        promise.then(
            () => inFlight.delete(promise),
            /* v8 ignore next */
            () => inFlight.delete(promise)
        );

        if (inFlight.size >= concurrency) {
            await Promise.race(inFlight);
        }
    }

    if (inFlight.size > 0) {
        await Promise.all(inFlight);
    }

    return { results: state.results as Array<Result<TResult>>, succeeded: state.succeeded, failed: state.failed };
}

export { batch };
export type { BatchOptions, BatchResult };
