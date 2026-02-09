import { describe, it, expect } from 'vitest';
import { ok, err, assertUnreachable } from './types';
import type { Result } from './types';

describe('Result type helpers', () => {
    describe('ok()', () => {
        it('creates a success result with a number', () => {
            const result = ok(42);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(42);
            }
        });

        it('creates a success result with a string', () => {
            const result = ok('hello');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe('hello');
            }
        });

        it('creates a success result with an object', () => {
            const data = { name: 'test', count: 1 };
            const result = ok(data);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toEqual(data);
            }
        });
    });

    describe('err()', () => {
        it('creates a failure result with an Error', () => {
            const error = new Error('something went wrong');
            const result = err(error);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(error);
                expect(result.error.message).toBe('something went wrong');
            }
        });

        it('creates a failure result with a custom error type', () => {
            const result = err({ code: 'NOT_FOUND', message: 'missing' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('NOT_FOUND');
            }
        });
    });

    describe('assertUnreachable()', () => {
        it('throws an error with JSON representation of the value', () => {
            expect(() => {
                assertUnreachable('unexpected' as never);
            }).toThrow('Exhaustive check failed: "unexpected"');
        });
    });

    describe('type narrowing', () => {
        it('narrows to success branch when ok is true', () => {
            const result: Result<number> = ok(42);

            if (result.ok) {
                const value: number = result.value;
                expect(value).toBe(42);
            } else {
                expect.unreachable('should not reach error branch');
            }
        });

        it('narrows to error branch when ok is false', () => {
            const result: Result<number> = err(new Error('fail'));

            if (!result.ok) {
                const error: Error = result.error;
                expect(error.message).toBe('fail');
            } else {
                expect.unreachable('should not reach success branch');
            }
        });
    });
});
