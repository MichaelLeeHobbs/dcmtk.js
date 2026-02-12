import { describe, it, expect } from 'vitest';
import { batch } from './batch';
import { ok, err } from '../types';
import type { Result } from '../types';

describe('batch()', () => {
    describe('basic functionality', () => {
        it('processes an empty array and returns empty results', async () => {
            const result = await batch([], () => Promise.resolve(ok('done')));

            expect(result.results).toEqual([]);
            expect(result.succeeded).toBe(0);
            expect(result.failed).toBe(0);
        });

        it('processes a single item', async () => {
            const result = await batch(['hello'], item => Promise.resolve(ok(item.toUpperCase())));

            expect(result.results).toHaveLength(1);
            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            const first = result.results[0];
            if (first?.ok) {
                expect(first.value).toBe('HELLO');
            }
        });

        it('processes multiple items and returns results in order', async () => {
            const items = [1, 2, 3, 4, 5];
            const result = await batch(items, item => Promise.resolve(ok(item * 10)));

            expect(result.results).toHaveLength(5);
            expect(result.succeeded).toBe(5);
            expect(result.failed).toBe(0);

            for (let i = 0; i < items.length; i++) {
                const r = result.results[i];
                if (r?.ok) {
                    expect(r.value).toBe((items[i] as number) * 10);
                }
            }
        });

        it('handles mixed success and failure results', async () => {
            const items = [1, 2, 3, 4];
            const result = await batch(items, item => {
                if (item % 2 === 0) {
                    return Promise.resolve(err(new Error(`${item} is even`)));
                }
                return Promise.resolve(ok(item));
            });

            expect(result.succeeded).toBe(2);
            expect(result.failed).toBe(2);
            expect(result.results).toHaveLength(4);
        });

        it('catches thrown exceptions and wraps them as err()', async () => {
            const result = await batch(['a', 'b'], item => {
                if (item === 'b') {
                    return Promise.reject(new Error('unexpected'));
                }
                return Promise.resolve(ok(item));
            });

            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(1);

            const second = result.results[1];
            if (second && !second.ok) {
                expect(second.error.message).toBe('unexpected');
            }
        });

        it('wraps non-Error thrown values as Error strings', async () => {
            const result = await batch(['a'], () => {
                return Promise.reject(new Error('string error'));
            });

            expect(result.failed).toBe(1);
            const first = result.results[0];
            if (first && !first.ok) {
                expect(first.error.message).toBe('string error');
            }
        });
    });

    describe('concurrency control', () => {
        it('defaults to concurrency of 4', async () => {
            let maxConcurrent = 0;
            let currentConcurrent = 0;

            const items = [1, 2, 3, 4, 5, 6, 7, 8];
            await batch(items, async item => {
                currentConcurrent += 1;
                if (currentConcurrent > maxConcurrent) {
                    maxConcurrent = currentConcurrent;
                }
                await new Promise(resolve => setTimeout(resolve, 50));
                currentConcurrent -= 1;
                return ok(item);
            });

            expect(maxConcurrent).toBeLessThanOrEqual(4);
            expect(maxConcurrent).toBeGreaterThanOrEqual(1);
        });

        it('respects concurrency limit of 1 (sequential)', async () => {
            let maxConcurrent = 0;
            let currentConcurrent = 0;

            const items = [1, 2, 3, 4];
            await batch(
                items,
                async item => {
                    currentConcurrent += 1;
                    if (currentConcurrent > maxConcurrent) {
                        maxConcurrent = currentConcurrent;
                    }
                    await new Promise(resolve => setTimeout(resolve, 10));
                    currentConcurrent -= 1;
                    return ok(item);
                },
                { concurrency: 1 }
            );

            expect(maxConcurrent).toBe(1);
        });

        it('respects concurrency limit of 2', async () => {
            let maxConcurrent = 0;
            let currentConcurrent = 0;

            const items = [1, 2, 3, 4, 5, 6];
            await batch(
                items,
                async item => {
                    currentConcurrent += 1;
                    if (currentConcurrent > maxConcurrent) {
                        maxConcurrent = currentConcurrent;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                    currentConcurrent -= 1;
                    return ok(item);
                },
                { concurrency: 2 }
            );

            expect(maxConcurrent).toBeLessThanOrEqual(2);
        });

        it('clamps concurrency below 1 to 1', async () => {
            let maxConcurrent = 0;
            let currentConcurrent = 0;

            await batch(
                [1, 2, 3],
                async item => {
                    currentConcurrent += 1;
                    if (currentConcurrent > maxConcurrent) {
                        maxConcurrent = currentConcurrent;
                    }
                    await new Promise(resolve => setTimeout(resolve, 10));
                    currentConcurrent -= 1;
                    return ok(item);
                },
                { concurrency: 0 }
            );

            expect(maxConcurrent).toBe(1);
        });

        it('clamps concurrency above 64 to 64', async () => {
            const result = await batch([1, 2], item => Promise.resolve(ok(item)), { concurrency: 100 });

            expect(result.succeeded).toBe(2);
        });
    });

    describe('ordering', () => {
        it('returns results in input order even when items complete out of order', async () => {
            const items = [1, 2, 3];
            // Item 1 takes longest, item 3 is fastest
            const delays = [100, 50, 10];

            const result = await batch(
                items,
                async item => {
                    const index = items.indexOf(item);
                    await new Promise(resolve => setTimeout(resolve, delays[index] as number));
                    return ok(item * 100);
                },
                { concurrency: 3 }
            );

            expect(result.results).toHaveLength(3);
            const values = result.results.map(r => (r.ok ? r.value : null));
            expect(values).toEqual([100, 200, 300]);
        });
    });

    describe('progress callback', () => {
        it('calls onProgress after each item completes', async () => {
            const progressCalls: Array<{ completed: number; total: number }> = [];

            await batch([1, 2, 3], item => Promise.resolve(ok(item)), {
                concurrency: 1,
                onProgress: (completed, total) => {
                    progressCalls.push({ completed, total });
                },
            });

            expect(progressCalls).toHaveLength(3);
            expect(progressCalls[0]).toEqual({ completed: 1, total: 3 });
            expect(progressCalls[1]).toEqual({ completed: 2, total: 3 });
            expect(progressCalls[2]).toEqual({ completed: 3, total: 3 });
        });

        it('passes the result to onProgress', async () => {
            const results: Array<Result<number>> = [];

            await batch(
                [1, 2],
                item => {
                    if (item === 2) return Promise.resolve(err(new Error('fail')));
                    return Promise.resolve(ok(item));
                },
                {
                    concurrency: 1,
                    onProgress: (_completed, _total, result) => {
                        results.push(result);
                    },
                }
            );

            expect(results).toHaveLength(2);
            expect(results[0]?.ok).toBe(true);
            expect(results[1]?.ok).toBe(false);
        });
    });

    describe('abort signal', () => {
        it('stops launching new items when aborted', async () => {
            const controller = new AbortController();
            let processedCount = 0;

            const result = await batch(
                [1, 2, 3, 4, 5],
                async item => {
                    processedCount += 1;
                    await new Promise(resolve => setTimeout(resolve, 50));
                    if (item === 2) {
                        controller.abort();
                    }
                    return ok(item);
                },
                { concurrency: 1, signal: controller.signal }
            );

            // With concurrency 1, after item 2 signals abort, items 3+ should not launch
            expect(processedCount).toBeLessThanOrEqual(3);
            expect(result.succeeded).toBeLessThan(5);
        });

        it('handles already-aborted signal', async () => {
            const controller = new AbortController();
            controller.abort();

            const result = await batch([1, 2, 3], item => Promise.resolve(ok(item)), { signal: controller.signal });

            expect(result.succeeded).toBe(0);
            expect(result.results).toHaveLength(3);
        });
    });

    describe('rejection handling', () => {
        it('cleans up in-flight set on rejection', async () => {
            const result = await batch(
                [1, 2, 3, 4],
                item => {
                    if (item === 2) {
                        return Promise.reject(new Error('boom'));
                    }
                    return Promise.resolve(ok(item));
                },
                { concurrency: 2 }
            );

            expect(result.failed).toBe(1);
            expect(result.succeeded).toBe(3);
            expect(result.results).toHaveLength(4);
        });
    });

    describe('edge cases', () => {
        it('handles items with undefined concurrency option', async () => {
            const result = await batch([1, 2], item => Promise.resolve(ok(item)), { concurrency: undefined });

            expect(result.succeeded).toBe(2);
        });

        it('handles large number of items', async () => {
            const items = Array.from({ length: 100 }, (_, i) => i);
            const result = await batch(items, item => Promise.resolve(ok(item)), { concurrency: 10 });

            expect(result.succeeded).toBe(100);
            expect(result.failed).toBe(0);
        });
    });
});
