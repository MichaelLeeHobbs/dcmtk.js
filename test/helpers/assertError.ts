/**
 * Error message assertion helper for precise error matching.
 *
 * Replaces loose .toContain() checks with exact or regex-based matching.
 * Can be used across test files for consistent error message validation.
 *
 * @module assertError
 */

import { expect } from 'vitest';

/**
 * Asserts that an error message matches an expected pattern exactly.
 * Replaces loose .toContain() checks with precise matching.
 *
 * @param actual - The actual error message string
 * @param expected - A string for exact match or a RegExp for pattern match
 */
function expectErrorMessage(actual: string, expected: RegExp | string): void {
    if (typeof expected === 'string') {
        expect(actual).toBe(expected);
    } else {
        expect(actual).toMatch(expected);
    }
}

export { expectErrorMessage };
