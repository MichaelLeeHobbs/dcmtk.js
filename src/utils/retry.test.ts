import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from './retry';
import { ok, err } from '../types';
import type { Result } from '../types';

describe('retry()', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('basic functionality', () => {
        it('returns the result on first success', async () => {
            const operation = vi.fn(() => Promise.resolve(ok(42)));

            const promise = retry(operation);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(42);
            }
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('retries on failure and succeeds on second attempt', async () => {
            let callCount = 0;
            const operation = vi.fn((): Promise<Result<string>> => {
                callCount += 1;
                if (callCount === 1) {
                    return Promise.resolve(err(new Error('first fail')));
                }
                return Promise.resolve(ok('success'));
            });

            const promise = retry(operation);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe('success');
            }
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it('returns last error after exhausting all attempts', async () => {
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('always fails')));
            });

            const promise = retry(operation, { maxAttempts: 3 });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('always fails');
            }
            expect(operation).toHaveBeenCalledTimes(3);
        });
    });

    describe('maxAttempts', () => {
        it('defaults to 3 attempts', async () => {
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation);
            await vi.runAllTimersAsync();
            await promise;

            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('respects custom maxAttempts', async () => {
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, { maxAttempts: 5 });
            await vi.runAllTimersAsync();
            await promise;

            expect(operation).toHaveBeenCalledTimes(5);
        });

        it('clamps maxAttempts to at least 1', async () => {
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, { maxAttempts: 0 });
            await vi.runAllTimersAsync();
            await promise;

            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('single attempt with maxAttempts=1 does not retry', async () => {
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, { maxAttempts: 1 });
            await vi.runAllTimersAsync();
            await promise;

            expect(operation).toHaveBeenCalledTimes(1);
        });
    });

    describe('exponential backoff', () => {
        it('increases delay exponentially', async () => {
            const delays: number[] = [];
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, {
                maxAttempts: 4,
                initialDelayMs: 100,
                backoffMultiplier: 2,
                maxDelayMs: 10_000,
                onRetry: (_error, _attempt, delayMs) => {
                    delays.push(delayMs);
                },
            });
            await vi.runAllTimersAsync();
            await promise;

            expect(delays).toHaveLength(3);
            // With jitter (+-10%), delays should be approximately 100, 200, 400
            expect(delays[0]).toBeGreaterThanOrEqual(90);
            expect(delays[0]).toBeLessThanOrEqual(110);
            expect(delays[1]).toBeGreaterThanOrEqual(180);
            expect(delays[1]).toBeLessThanOrEqual(220);
            expect(delays[2]).toBeGreaterThanOrEqual(360);
            expect(delays[2]).toBeLessThanOrEqual(440);
        });

        it('caps delay at maxDelayMs', async () => {
            const delays: number[] = [];
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, {
                maxAttempts: 5,
                initialDelayMs: 1000,
                backoffMultiplier: 10,
                maxDelayMs: 5000,
                onRetry: (_error, _attempt, delayMs) => {
                    delays.push(delayMs);
                },
            });
            await vi.runAllTimersAsync();
            await promise;

            // All delays after the first should be capped at ~5000
            for (const delay of delays) {
                expect(delay).toBeLessThanOrEqual(5500); // 5000 + 10% jitter
            }
        });
    });

    describe('shouldRetry predicate', () => {
        it('stops retrying when shouldRetry returns false', async () => {
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('permanent')));
            });

            const promise = retry(operation, {
                maxAttempts: 5,
                shouldRetry: () => false,
            });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(operation).toHaveBeenCalledTimes(1);
            expect(result.ok).toBe(false);
        });

        it('receives the error and attempt number', async () => {
            const calls: Array<{ message: string; attempt: number }> = [];
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('test error')));
            });

            const promise = retry(operation, {
                maxAttempts: 3,
                shouldRetry: (error, attempt) => {
                    calls.push({ message: error.message, attempt });
                    return true;
                },
            });
            await vi.runAllTimersAsync();
            await promise;

            expect(calls).toHaveLength(2);
            expect(calls[0]).toEqual({ message: 'test error', attempt: 1 });
            expect(calls[1]).toEqual({ message: 'test error', attempt: 2 });
        });

        it('conditionally retries based on error type', async () => {
            let callCount = 0;
            const operation = vi.fn((): Promise<Result<number>> => {
                callCount += 1;
                if (callCount <= 2) {
                    return Promise.resolve(err(new Error('timeout')));
                }
                return Promise.resolve(err(new Error('auth failed')));
            });

            const promise = retry(operation, {
                maxAttempts: 5,
                shouldRetry: error => error.message === 'timeout',
            });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(operation).toHaveBeenCalledTimes(3);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('auth failed');
            }
        });
    });

    describe('onRetry callback', () => {
        it('is called before each retry with error, attempt, and delay', async () => {
            const retryCalls: Array<{ message: string; attempt: number; delayMs: number }> = [];
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, {
                maxAttempts: 3,
                initialDelayMs: 100,
                onRetry: (error, attempt, delayMs) => {
                    retryCalls.push({ message: error.message, attempt, delayMs });
                },
            });
            await vi.runAllTimersAsync();
            await promise;

            expect(retryCalls).toHaveLength(2);
            expect(retryCalls[0]?.message).toBe('fail');
            expect(retryCalls[0]?.attempt).toBe(1);
            expect(retryCalls[1]?.attempt).toBe(2);
        });

        it('is not called on the initial attempt', async () => {
            const onRetry = vi.fn();
            const operation = vi.fn(() => Promise.resolve(ok(42)));

            const promise = retry(operation, { onRetry });
            await vi.runAllTimersAsync();
            await promise;

            expect(onRetry).not.toHaveBeenCalled();
        });
    });

    describe('abort signal', () => {
        it('stops retrying when signal is aborted before delay', async () => {
            const controller = new AbortController();
            let callCount = 0;
            const operation = vi.fn((): Promise<Result<number>> => {
                callCount += 1;
                if (callCount === 1) {
                    controller.abort();
                }
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, {
                maxAttempts: 5,
                signal: controller.signal,
            });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.ok).toBe(false);
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('handles already-aborted signal', async () => {
            const controller = new AbortController();
            controller.abort();

            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, {
                maxAttempts: 3,
                signal: controller.signal,
            });
            await vi.runAllTimersAsync();
            const result = await promise;

            // First attempt always runs, then abort is checked before retry
            expect(operation).toHaveBeenCalledTimes(1);
            expect(result.ok).toBe(false);
        });
    });

    describe('default options', () => {
        it('uses default values when no options provided', async () => {
            const operation = vi.fn(() => Promise.resolve(ok('value')));

            const promise = retry(operation);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.ok).toBe(true);
            expect(operation).toHaveBeenCalledTimes(1);
        });
    });

    describe('edge cases', () => {
        it('succeeds on the last attempt', async () => {
            let callCount = 0;
            const operation = vi.fn((): Promise<Result<string>> => {
                callCount += 1;
                if (callCount < 3) {
                    return Promise.resolve(err(new Error(`attempt ${callCount}`)));
                }
                return Promise.resolve(ok('finally'));
            });

            const promise = retry(operation, { maxAttempts: 3 });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe('finally');
            }
            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('works with backoffMultiplier of 1 (constant delay)', async () => {
            const delays: number[] = [];
            const operation = vi.fn((): Promise<Result<number>> => {
                return Promise.resolve(err(new Error('fail')));
            });

            const promise = retry(operation, {
                maxAttempts: 4,
                initialDelayMs: 500,
                backoffMultiplier: 1,
                onRetry: (_error, _attempt, delayMs) => {
                    delays.push(delayMs);
                },
            });
            await vi.runAllTimersAsync();
            await promise;

            // All delays should be approximately 500ms with jitter
            for (const delay of delays) {
                expect(delay).toBeGreaterThanOrEqual(450);
                expect(delay).toBeLessThanOrEqual(550);
            }
        });
    });
});
