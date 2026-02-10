import { describe, it, expect } from 'vitest';
import { repairJson } from './_repairJson';

describe('repairJson()', () => {
    it('returns valid JSON unchanged', () => {
        const valid = '{"00100010": {"vr": "PN", "Value": [{"Alphabetic": "Smith^John"}]}}';
        expect(repairJson(valid)).toBe(valid);
    });

    it('quotes bare integers in Value arrays', () => {
        const input = '{"00201208": {"vr": "IS", "Value": [42]}}';
        const expected = '{"00201208": {"vr": "IS", "Value": ["42"]}}';
        expect(repairJson(input)).toBe(expected);
    });

    it('quotes bare decimals in Value arrays', () => {
        const input = '{"00280030": {"vr": "DS", "Value": [0.5, 0.5]}}';
        const expected = '{"00280030": {"vr": "DS", "Value": ["0.5", "0.5"]}}';
        expect(repairJson(input)).toBe(expected);
    });

    it('quotes negative numbers', () => {
        const input = '{"00280030": {"vr": "DS", "Value": [-1.5, 2.0]}}';
        const expected = '{"00280030": {"vr": "DS", "Value": ["-1.5", "2.0"]}}';
        expect(repairJson(input)).toBe(expected);
    });

    it('quotes scientific notation values', () => {
        const input = '{"00280030": {"vr": "DS", "Value": [1.5e10, -2.0E-3]}}';
        const expected = '{"00280030": {"vr": "DS", "Value": ["1.5e10", "-2.0E-3"]}}';
        expect(repairJson(input)).toBe(expected);
    });

    it('does not modify already-quoted string values', () => {
        const input = '{"00100010": {"vr": "DS", "Value": ["1.5", "2.0"]}}';
        expect(repairJson(input)).toBe(input);
    });

    it('does not modify non-Value arrays', () => {
        const input = '{"data": [1, 2, 3]}';
        expect(repairJson(input)).toBe(input);
    });

    it('handles multiline Value arrays', () => {
        const input = `{
    "00280030": {
        "vr": "DS",
        "Value": [
            0.5,
            0.5
        ]
    }
}`;
        const result = repairJson(input);
        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed).toHaveProperty('00280030');
    });

    it('handles mixed quoted and unquoted values', () => {
        const input = '{"00280030": {"vr": "DS", "Value": ["1.0", 2.0, "3.0"]}}';
        const result = repairJson(input);
        // Verify it produces valid JSON with correct values
        const parsed = JSON.parse(result) as Record<string, { Value: string[] }>;
        expect(parsed['00280030']!.Value).toEqual(['1.0', '2.0', '3.0']);
    });

    it('handles empty Value arrays', () => {
        const input = '{"00280030": {"vr": "DS", "Value": []}}';
        expect(repairJson(input)).toBe(input);
    });

    it('handles values starting with decimal point', () => {
        const input = '{"00280030": {"vr": "DS", "Value": [.5]}}';
        const expected = '{"00280030": {"vr": "DS", "Value": [".5"]}}';
        expect(repairJson(input)).toBe(expected);
    });
});
