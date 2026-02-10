import { describe, it, expect } from 'vitest';
import { VR, VR_CATEGORY, VR_CATEGORY_NAME, VR_META, isStringVR, isNumericVR, isBinaryVR, getVRCategory } from './vr';
import type { VRValue } from './vr';

describe('VR definitions', () => {
    describe('VR constant', () => {
        it('contains exactly 34 standard VR codes', () => {
            expect(Object.keys(VR)).toHaveLength(34);
        });

        it('has key === value for every entry', () => {
            for (const [key, value] of Object.entries(VR)) {
                expect(key).toBe(value);
            }
        });

        it('includes all expected VR codes', () => {
            const expected = [
                'AE',
                'AS',
                'AT',
                'CS',
                'DA',
                'DS',
                'DT',
                'FD',
                'FL',
                'IS',
                'LO',
                'LT',
                'OB',
                'OD',
                'OF',
                'OL',
                'OV',
                'OW',
                'PN',
                'SH',
                'SL',
                'SQ',
                'SS',
                'ST',
                'SV',
                'TM',
                'UC',
                'UI',
                'UL',
                'UN',
                'UR',
                'US',
                'UT',
                'UV',
            ];
            for (const code of expected) {
                expect(VR).toHaveProperty(code);
            }
        });
    });

    describe('VR_CATEGORY', () => {
        it('covers all 34 VR codes exactly once', () => {
            const allVRs: string[] = [];
            for (const vrs of Object.values(VR_CATEGORY)) {
                allVRs.push(...vrs);
            }
            expect(allVRs).toHaveLength(34);
            expect(new Set(allVRs).size).toBe(34);

            for (const vr of Object.values(VR)) {
                expect(allVRs).toContain(vr);
            }
        });

        it('has 5 categories', () => {
            expect(Object.keys(VR_CATEGORY)).toHaveLength(5);
        });

        it('STRING category contains text-based VRs', () => {
            expect(VR_CATEGORY.STRING).toContain('LO');
            expect(VR_CATEGORY.STRING).toContain('PN');
            expect(VR_CATEGORY.STRING).toContain('UI');
        });

        it('NUMERIC category contains numeric VRs', () => {
            expect(VR_CATEGORY.NUMERIC).toContain('US');
            expect(VR_CATEGORY.NUMERIC).toContain('FL');
            expect(VR_CATEGORY.NUMERIC).toContain('FD');
        });

        it('BINARY category contains binary VRs', () => {
            expect(VR_CATEGORY.BINARY).toContain('OB');
            expect(VR_CATEGORY.BINARY).toContain('OW');
            expect(VR_CATEGORY.BINARY).toContain('UN');
        });

        it('SEQUENCE category contains only SQ', () => {
            expect(VR_CATEGORY.SEQUENCE).toEqual(['SQ']);
        });

        it('TAG category contains only AT', () => {
            expect(VR_CATEGORY.TAG).toEqual(['AT']);
        });
    });

    describe('VR_CATEGORY_NAME', () => {
        it('has entries matching VR_CATEGORY keys', () => {
            for (const key of Object.keys(VR_CATEGORY)) {
                expect(VR_CATEGORY_NAME).toHaveProperty(key);
            }
        });
    });

    describe('VR_META', () => {
        it('has an entry for every VR code', () => {
            for (const vr of Object.values(VR)) {
                expect(VR_META).toHaveProperty(vr);
            }
        });

        it('AE has correct metadata', () => {
            expect(VR_META.AE).toEqual({
                maxLength: 16,
                paddingChar: ' ',
                fixed: false,
                category: 'STRING',
            });
        });

        it('US has correct metadata (fixed-length numeric)', () => {
            expect(VR_META.US).toEqual({
                maxLength: 2,
                paddingChar: '\0',
                fixed: true,
                category: 'NUMERIC',
            });
        });

        it('SQ has null maxLength and null paddingChar', () => {
            expect(VR_META.SQ.maxLength).toBeNull();
            expect(VR_META.SQ.paddingChar).toBeNull();
            expect(VR_META.SQ.fixed).toBe(false);
            expect(VR_META.SQ.category).toBe('SEQUENCE');
        });

        it('OB has null maxLength with null-byte padding', () => {
            expect(VR_META.OB.maxLength).toBeNull();
            expect(VR_META.OB.paddingChar).toBe('\0');
        });

        it('UI pads with null bytes', () => {
            expect(VR_META.UI.paddingChar).toBe('\0');
            expect(VR_META.UI.maxLength).toBe(64);
        });

        it('all fixed-length VRs have non-null maxLength', () => {
            for (const meta of Object.values(VR_META)) {
                if (meta.fixed) {
                    expect(meta.maxLength).not.toBeNull();
                    expect(typeof meta.maxLength).toBe('number');
                }
            }
        });

        it('every entry has a valid category', () => {
            const validCategories = new Set(Object.values(VR_CATEGORY_NAME));
            for (const meta of Object.values(VR_META)) {
                expect(validCategories).toContain(meta.category);
            }
        });

        it('category in VR_META matches VR_CATEGORY arrays', () => {
            for (const [catName, vrs] of Object.entries(VR_CATEGORY)) {
                for (const vr of vrs) {
                    const typedVr = vr as VRValue;
                    expect(VR_META[typedVr].category).toBe(catName);
                }
            }
        });
    });

    describe('isStringVR()', () => {
        it('returns true for valid VR codes', () => {
            expect(isStringVR('AE')).toBe(true);
            expect(isStringVR('US')).toBe(true);
            expect(isStringVR('SQ')).toBe(true);
            expect(isStringVR('OB')).toBe(true);
        });

        it('returns false for invalid VR codes', () => {
            expect(isStringVR('XX')).toBe(false);
            expect(isStringVR('')).toBe(false);
            expect(isStringVR('ae')).toBe(false);
            expect(isStringVR('us')).toBe(false);
        });

        it('narrows type correctly', () => {
            const vr: string = 'PN';
            if (isStringVR(vr)) {
                const _typed: VRValue = vr;
                expect(_typed).toBe('PN');
            }
        });
    });

    describe('isNumericVR()', () => {
        it('returns true for numeric VRs', () => {
            expect(isNumericVR('US')).toBe(true);
            expect(isNumericVR('UL')).toBe(true);
            expect(isNumericVR('SS')).toBe(true);
            expect(isNumericVR('SL')).toBe(true);
            expect(isNumericVR('FL')).toBe(true);
            expect(isNumericVR('FD')).toBe(true);
            expect(isNumericVR('SV')).toBe(true);
            expect(isNumericVR('UV')).toBe(true);
        });

        it('returns false for non-numeric VRs', () => {
            expect(isNumericVR('LO')).toBe(false);
            expect(isNumericVR('SQ')).toBe(false);
            expect(isNumericVR('OB')).toBe(false);
            expect(isNumericVR('AT')).toBe(false);
        });

        it('returns false for invalid strings', () => {
            expect(isNumericVR('XX')).toBe(false);
            expect(isNumericVR('')).toBe(false);
        });
    });

    describe('isBinaryVR()', () => {
        it('returns true for binary VRs', () => {
            expect(isBinaryVR('OB')).toBe(true);
            expect(isBinaryVR('OW')).toBe(true);
            expect(isBinaryVR('OD')).toBe(true);
            expect(isBinaryVR('OF')).toBe(true);
            expect(isBinaryVR('OL')).toBe(true);
            expect(isBinaryVR('OV')).toBe(true);
            expect(isBinaryVR('UN')).toBe(true);
        });

        it('returns false for non-binary VRs', () => {
            expect(isBinaryVR('US')).toBe(false);
            expect(isBinaryVR('LO')).toBe(false);
            expect(isBinaryVR('SQ')).toBe(false);
        });
    });

    describe('getVRCategory()', () => {
        it('returns STRING for text VRs', () => {
            expect(getVRCategory('LO')).toBe('STRING');
            expect(getVRCategory('PN')).toBe('STRING');
            expect(getVRCategory('UI')).toBe('STRING');
        });

        it('returns NUMERIC for numeric VRs', () => {
            expect(getVRCategory('US')).toBe('NUMERIC');
            expect(getVRCategory('FD')).toBe('NUMERIC');
        });

        it('returns BINARY for binary VRs', () => {
            expect(getVRCategory('OB')).toBe('BINARY');
            expect(getVRCategory('OW')).toBe('BINARY');
        });

        it('returns SEQUENCE for SQ', () => {
            expect(getVRCategory('SQ')).toBe('SEQUENCE');
        });

        it('returns TAG for AT', () => {
            expect(getVRCategory('AT')).toBe('TAG');
        });

        it('returns correct category for every VR', () => {
            for (const vr of Object.values(VR)) {
                const category = getVRCategory(vr);
                const typedCategory = category as keyof typeof VR_CATEGORY;
                expect(VR_CATEGORY[typedCategory] as readonly string[]).toContain(vr);
            }
        });
    });
});
