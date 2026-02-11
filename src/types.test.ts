import { describe, it, expect } from 'vitest';
import { ok, err, assertUnreachable, unwrap, mapResult } from './types';
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

    describe('unwrap()', () => {
        it('returns the value from a successful Result', () => {
            const result = ok(42);
            expect(unwrap(result)).toBe(42);
        });

        it('returns string value from a successful Result', () => {
            const result = ok('hello');
            expect(unwrap(result)).toBe('hello');
        });

        it('returns object value from a successful Result', () => {
            const data = { name: 'test', count: 1 };
            const result = ok(data);
            expect(unwrap(result)).toEqual(data);
        });

        it('throws the error from a failed Result', () => {
            const error = new Error('something went wrong');
            const result = err(error);
            expect(() => unwrap(result)).toThrow(error);
        });

        it('throws custom error objects from a failed Result', () => {
            const error = new Error('not found');
            const result: Result<number> = err(error);
            expect(() => unwrap(result)).toThrow('not found');
        });

        it('works with Result<void>', () => {
            const result: Result<void> = ok(undefined);
            expect(unwrap(result)).toBeUndefined();
        });
    });

    describe('mapResult()', () => {
        it('transforms the value of a successful Result', () => {
            const result = ok(42);
            const mapped = mapResult(result, x => x * 2);
            expect(mapped.ok).toBe(true);
            if (mapped.ok) {
                expect(mapped.value).toBe(84);
            }
        });

        it('transforms to a different type', () => {
            const result = ok(42);
            const mapped = mapResult(result, x => `value: ${x}`);
            expect(mapped.ok).toBe(true);
            if (mapped.ok) {
                expect(mapped.value).toBe('value: 42');
            }
        });

        it('passes through errors unchanged', () => {
            const error = new Error('fail');
            const result: Result<number> = err(error);
            const mapped = mapResult(result, x => x * 2);
            expect(mapped.ok).toBe(false);
            if (!mapped.ok) {
                expect(mapped.error).toBe(error);
            }
        });

        it('does not call fn on error results', () => {
            const result: Result<number> = err(new Error('fail'));
            let called = false;
            mapResult(result, x => {
                called = true;
                return x;
            });
            expect(called).toBe(false);
        });

        it('works with complex transformations', () => {
            const result = ok({ x: 1, y: 2 });
            const mapped = mapResult(result, p => p.x + p.y);
            expect(mapped.ok).toBe(true);
            if (mapped.ok) {
                expect(mapped.value).toBe(3);
            }
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
