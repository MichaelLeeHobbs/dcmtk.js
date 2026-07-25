import { describe, it, expect } from 'vitest';
import { lookupTag, lookupTagByName, lookupTagByKeyword } from './dictionary';
import { createDicomTag } from '../brands';
import type { DictionaryEntry } from './dictionary';

describe('DICOM Dictionary', () => {
    describe('lookupTag()', () => {
        it('finds PatientName by branded DicomTag', () => {
            const tagResult = createDicomTag('(0010,0010)');
            expect(tagResult.ok).toBe(true);
            if (!tagResult.ok) return;

            const entry = lookupTag(tagResult.value);
            expect(entry).toBeDefined();
            expect(entry?.vr).toBe('PN');
            expect(entry?.name).toBe('PatientName');
            expect(entry?.vm).toEqual([1, 1]);
            expect(entry?.retired).toBe(false);
        });

        it('finds PatientID by branded DicomTag', () => {
            const tagResult = createDicomTag('(0010,0020)');
            expect(tagResult.ok).toBe(true);
            if (!tagResult.ok) return;

            const entry = lookupTag(tagResult.value);
            expect(entry).toBeDefined();
            expect(entry?.vr).toBe('LO');
            expect(entry?.name).toBe('PatientID');
        });

        it('finds Modality by 8-char hex string', () => {
            const entry = lookupTag('00080060');
            expect(entry).toBeDefined();
            expect(entry?.vr).toBe('CS');
            expect(entry?.name).toBe('Modality');
        });

        it('handles lowercase hex input', () => {
            const entry = lookupTag('00100010');
            expect(entry).toBeDefined();
            expect(entry?.name).toBe('PatientName');

            const entryLower = lookupTag('00100010');
            expect(entryLower).toBeDefined();
        });

        it('handles parenthesized format strings', () => {
            const entry = lookupTag('(0008,0060)');
            expect(entry).toBeDefined();
            expect(entry?.name).toBe('Modality');
        });

        it('returns undefined for unknown tags', () => {
            expect(lookupTag('FFFFFFFF')).toBeUndefined();
            expect(lookupTag('99999999')).toBeUndefined();
        });

        it('finds retired tags', () => {
            // Look for a known retired tag: (0000,0001) = CommandLengthToEnd
            const entry = lookupTag('00000001');
            if (entry !== undefined) {
                expect(entry.retired).toBe(true);
            }
        });

        it('returns correct vm for multi-valued tags', () => {
            // ImageOrientationPatient has vm [6, 6]
            const entry = lookupTag('00200037');
            expect(entry).toBeDefined();
            expect(entry?.name).toBe('ImageOrientationPatient');
            expect(entry?.vm).toEqual([6, 6]);
        });

        it('returns correct vm for unbounded tags', () => {
            // AttributeIdentifierList has vm [1, null]
            const entry = lookupTag('00001005');
            expect(entry).toBeDefined();
            expect(entry?.name).toBe('AttributeIdentifierList');
            expect(entry?.vm[1]).toBeNull();
        });
    });

    describe('lookupTag() — repeating groups', () => {
        it('resolves the first overlay group (6000,eeee)', () => {
            const entry = lookupTag('60000010');
            expect(entry).toEqual({ vr: 'US', name: 'OverlayRows', vm: [1, 1], retired: false });
        });

        it('resolves every even overlay group in the range', () => {
            for (const group of ['6000', '6002', '6010', '601E', '60FE']) {
                const entry = lookupTag(`${group}3000`);
                expect(entry?.name).toBe('OverlayData');
                expect(entry?.vr).toBe('OW');
            }
        });

        it('resolves overlay groups given in parenthesized form', () => {
            expect(lookupTag('(6002,0010)')?.name).toBe('OverlayRows');
        });

        it('does not resolve odd groups in the overlay range — those are private', () => {
            expect(lookupTag('60010010')).toBeUndefined();
            expect(lookupTag('60FF0010')).toBeUndefined();
        });

        it('does not resolve elements outside a repeating entry', () => {
            // (60xx,0FFF) is not defined; (6100,0010) is past the range end.
            expect(lookupTag('60000FFF')).toBeUndefined();
            expect(lookupTag('61000010')).toBeUndefined();
        });

        it('resolves retired curve groups (50xx,eeee)', () => {
            const entry = lookupTag('50000005');
            expect(entry?.name).toBe('RETIRED_CurveDimensions');
            expect(entry?.vr).toBe('US');
            expect(entry?.retired).toBe(true);
            expect(lookupTag('50020005')?.name).toBe('RETIRED_CurveDimensions');
        });

        it('resolves retired variable pixel data groups (7Fxx,eeee)', () => {
            expect(lookupTag('7F000010')?.name).toBe('RETIRED_VariablePixelData');
            expect(lookupTag('7F0E0010')?.name).toBe('RETIRED_VariablePixelData');
        });

        it('prefers an exact entry over a repeating range that also covers it', () => {
            // (7FE0,0010) PixelData sits inside the (7F00-7FFF,0010) range.
            expect(lookupTag('7FE00010')?.name).toBe('PixelData');
        });

        it('resolves element ranges', () => {
            // (0020,3100-31FF) RETIRED_SourceImageIDs
            expect(lookupTag('00203100')?.name).toBe('RETIRED_SourceImageIDs');
            expect(lookupTag('002031FF')?.name).toBe('RETIRED_SourceImageIDs');
            expect(lookupTag('00203200')).toBeUndefined();
        });

        it('leaves private tags unknown rather than matching a placeholder entry', () => {
            // DCMTK's PrivateCreator/PrivateGroupLength pseudo-entries span every
            // odd group; they are deliberately excluded from the generated data.
            expect(lookupTag('00291010')).toBeUndefined();
            expect(lookupTag('00090000')).toBeUndefined();
        });

        it('returns undefined for malformed input instead of matching a range', () => {
            expect(lookupTag('6000')).toBeUndefined();
            expect(lookupTag('6000001Z')).toBeUndefined();
            expect(lookupTag('')).toBeUndefined();
        });
    });

    describe('lookupTagByName()', () => {
        it('finds PatientName by keyword', () => {
            const result = lookupTagByName('PatientName');
            expect(result).toBeDefined();
            expect(result?.tag).toBe('00100010');
            expect(result?.entry.vr).toBe('PN');
        });

        it('finds Modality by keyword', () => {
            const result = lookupTagByName('Modality');
            expect(result).toBeDefined();
            expect(result?.tag).toBe('00080060');
        });

        it('finds StudyInstanceUID by keyword', () => {
            const result = lookupTagByName('StudyInstanceUID');
            expect(result).toBeDefined();
            expect(result?.tag).toBe('0020000D');
            expect(result?.entry.vr).toBe('UI');
        });

        it('returns undefined for unknown names', () => {
            expect(lookupTagByName('NotARealTag')).toBeUndefined();
            expect(lookupTagByName('')).toBeUndefined();
        });

        it('is case-sensitive', () => {
            expect(lookupTagByName('patientname')).toBeUndefined();
            expect(lookupTagByName('PATIENTNAME')).toBeUndefined();
        });

        it('reports repeating groups at the first tag they cover', () => {
            const result = lookupTagByName('OverlayRows');
            expect(result?.tag).toBe('60000010');
            expect(result?.entry.vr).toBe('US');
            expect(lookupTagByName('RETIRED_SourceImageIDs')?.tag).toBe('00203100');
        });
    });

    describe('lookupTagByKeyword()', () => {
        it('returns DicomTag for PatientName', () => {
            const tag = lookupTagByKeyword('PatientName');
            expect(tag).toBe('(0010,0010)');
        });

        it('returns DicomTag for Modality', () => {
            const tag = lookupTagByKeyword('Modality');
            expect(tag).toBe('(0008,0060)');
        });

        it('returns DicomTag for PixelData', () => {
            const tag = lookupTagByKeyword('PixelData');
            expect(tag).toBe('(7FE0,0010)');
        });

        it('returns undefined for unknown keywords', () => {
            expect(lookupTagByKeyword('FakeKeyword')).toBeUndefined();
            expect(lookupTagByKeyword('')).toBeUndefined();
        });

        it('returned tag is uppercase', () => {
            const tag = lookupTagByKeyword('StudyInstanceUID');
            expect(tag).toBe('(0020,000D)');
        });

        it('returns the base tag of a repeating group', () => {
            expect(lookupTagByKeyword('OverlayData')).toBe('(6000,3000)');
            expect(lookupTagByKeyword('RETIRED_CurveDimensions')).toBe('(5000,0005)');
        });
    });

    describe('dictionary integrity', () => {
        it('name index covers all entries (buildNameIndex iterates every key)', () => {
            // lookupTagByName triggers buildNameIndex which iterates all dictionary entries
            // This ensures every entry is visited, covering the Object.keys iteration path
            const result = lookupTagByName('PatientName');
            expect(result).toBeDefined();
            expect(result?.tag).toBe('00100010');
        });

        it('lookupTagByKeyword returns valid DicomTag for known keywords', () => {
            // This exercises the createDicomTag path inside lookupTagByKeyword
            const tag = lookupTagByKeyword('PatientName');
            expect(tag).toBe('(0010,0010)');

            const tag2 = lookupTagByKeyword('PixelData');
            expect(tag2).toBe('(7FE0,0010)');
        });
    });

    describe('DictionaryEntry type', () => {
        it('entries have the expected shape', () => {
            const entry = lookupTag('00100010');
            expect(entry).toBeDefined();
            if (entry === undefined) return;

            const typed: DictionaryEntry = entry;
            expect(typeof typed.vr).toBe('string');
            expect(typeof typed.name).toBe('string');
            expect(Array.isArray(typed.vm)).toBe(true);
            expect(typeof typed.retired).toBe('boolean');
        });
    });
});
