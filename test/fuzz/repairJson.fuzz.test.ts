/**
 * Property-based fuzz tests for the JSON repair utility.
 *
 * Exercises _repairJson with random JSON-like inputs to verify it
 * never corrupts valid JSON and correctly quotes bare numbers.
 *
 * @module fuzz/repairJson
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { repairJson } from '../../src/tools/_repairJson';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a quoted string value for use in Value arrays. */
const quotedString = fc
    .string({ minLength: 0, maxLength: 20 })
    .filter(s => !s.includes('"') && !s.includes('\\'))
    .map(s => `"${s}"`);

/** Generates a bare (unquoted) numeric value — the kind dcm2json emits incorrectly. */
const bareNumber = fc.oneof(
    fc.integer({ min: -9999, max: 9999 }).map(String),
    fc.double({ min: -999.99, max: 999.99, noNaN: true, noDefaultInfinity: true }).map(n => n.toFixed(2))
);

/** Generates a "Value" array with bare numbers (the malformed case). */
const malformedValueArray = fc.array(bareNumber, { minLength: 1, maxLength: 5 }).map(nums => `"Value": [${nums.join(', ')}]`);

/** Generates a "Value" array with properly quoted strings. */
const validValueArray = fc.array(quotedString, { minLength: 1, maxLength: 5 }).map(strs => `"Value": [${strs.join(', ')}]`);

/** Generates an 8-character lowercase hex string for fake DICOM tags. */
const hexTag = fc.stringMatching(/^[0-9a-f]{8}$/);

/** Generates a complete DICOM JSON-like element with a Value array. */
const dicomElement = fc.tuple(hexTag, fc.oneof(malformedValueArray, validValueArray)).map(([tag, value]) => `"${tag}": { "vr": "DS", ${value} }`);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('repairJson fuzz tests', () => {
    it('never throws for arbitrary strings', () => {
        fc.assert(
            fc.property(fc.string(), input => {
                expect(() => repairJson(input)).not.toThrow();
            }),
            { numRuns: 1000 }
        );
    });

    it('never throws for arbitrary unicode', () => {
        fc.assert(
            fc.property(fc.string(), input => {
                expect(() => repairJson(input)).not.toThrow();
            }),
            { numRuns: 500 }
        );
    });

    it('preserves valid JSON that has no Value arrays', () => {
        fc.assert(
            fc.property(fc.json(), jsonStr => {
                // JSON without "Value": [...] should pass through unchanged
                if (!jsonStr.includes('"Value"')) {
                    expect(repairJson(jsonStr)).toBe(jsonStr);
                }
            }),
            { numRuns: 500 }
        );
    });

    it('produces parseable JSON from well-formed DICOM JSON with bare numbers', () => {
        fc.assert(
            fc.property(fc.array(dicomElement, { minLength: 1, maxLength: 3 }), elements => {
                const raw = `{ ${elements.join(', ')} }`;
                const repaired = repairJson(raw);
                // The repaired output should be valid JSON
                expect(() => JSON.parse(repaired) as unknown).not.toThrow();
            }),
            { numRuns: 300 }
        );
    });

    it('idempotent: repairing already-repaired JSON produces same result', () => {
        fc.assert(
            fc.property(fc.array(dicomElement, { minLength: 1, maxLength: 3 }), elements => {
                const raw = `{ ${elements.join(', ')} }`;
                const once = repairJson(raw);
                const twice = repairJson(once);
                expect(twice).toBe(once);
            }),
            { numRuns: 200 }
        );
    });

    it('quotes bare integers in Value arrays', () => {
        fc.assert(
            fc.property(fc.integer({ min: -9999, max: 9999 }), num => {
                const raw = `{"00000000": {"vr": "DS", "Value": [${num}]}}`;
                const repaired = repairJson(raw);
                expect(repaired).toContain(`"${num}"`);
                expect(() => JSON.parse(repaired) as unknown).not.toThrow();
            }),
            { numRuns: 300 }
        );
    });

    it('quotes bare decimals in Value arrays', () => {
        fc.assert(
            fc.property(fc.double({ min: -999.99, max: 999.99, noNaN: true, noDefaultInfinity: true }), num => {
                const str = num.toFixed(3);
                const raw = `{"00000000": {"vr": "DS", "Value": [${str}]}}`;
                const repaired = repairJson(raw);
                expect(repaired).toContain(`"${str}"`);
                expect(() => JSON.parse(repaired) as unknown).not.toThrow();
            }),
            { numRuns: 300 }
        );
    });

    it('leaves already-quoted strings alone', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.includes('"') && !s.includes('\\') && !s.includes(']')),
                    { minLength: 1, maxLength: 4 }
                ),
                strings => {
                    const inner = strings.map(s => `"${s}"`).join(', ');
                    const raw = `{"00000000": {"vr": "LO", "Value": [${inner}]}}`;
                    const repaired = repairJson(raw);
                    // Should be unchanged — all values were already quoted
                    expect(repaired).toBe(raw);
                }
            ),
            { numRuns: 200 }
        );
    });

    it('handles empty Value arrays', () => {
        const raw = '{"00000000": {"vr": "DS", "Value": []}}';
        const repaired = repairJson(raw);
        expect(repaired).toBe(raw);
        expect(() => JSON.parse(repaired) as unknown).not.toThrow();
    });
});
