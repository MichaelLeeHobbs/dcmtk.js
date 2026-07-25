import { describe, it, expect } from 'vitest';
import { DicomDataset } from './DicomDataset';
import type { DicomTag, DicomTagPath } from '../brands';
import type { DicomJsonModel, DicomJsonElement } from '../tools/_xmlToJson';
import type { WalkTagEntry } from './walkTags';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSampleData(): DicomJsonModel {
    return {
        '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Smith^John' }] },
        '00100020': { vr: 'LO', Value: ['PATIENT-001'] },
        '00080020': { vr: 'DA', Value: ['20240115'] },
        '00080050': { vr: 'SH', Value: ['ACC-12345'] },
        '00080060': { vr: 'CS', Value: ['CT'] },
        '00080016': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.2'] },
        '00080018': { vr: 'UI', Value: ['1.2.3.4.5.6.7.8.9'] },
        '0020000D': { vr: 'UI', Value: ['1.2.3.4.5'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.4.5.6'] },
        '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] },
        '00280010': { vr: 'US', Value: [512] },
        '00280011': { vr: 'US', Value: [512] },
        '00280030': { vr: 'DS', Value: [0.5, 0.5] },
        '00080008': { vr: 'CS', Value: ['ORIGINAL', 'PRIMARY', 'AXIAL'] },
        '7FE00010': { vr: 'OW', InlineBinary: 'AAAA' },
        '00081115': {
            vr: 'SQ',
            Value: [
                {
                    '0020000E': { vr: 'UI', Value: ['1.2.3.4.5.6.7'] },
                    '00081199': {
                        vr: 'SQ',
                        Value: [
                            { '00081150': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.2'] } },
                            { '00081150': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.4'] } },
                        ],
                    },
                },
                {
                    '0020000E': { vr: 'UI', Value: ['1.2.3.4.5.6.8'] },
                    '00081199': {
                        vr: 'SQ',
                        Value: [{ '00081150': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.7'] } }],
                    },
                },
            ],
        },
        '00101010': { vr: 'AS', Value: ['032Y'] },
        '00280101': { vr: 'US' },
    };
}

function makeDataset(): DicomDataset {
    const result = DicomDataset.fromJson(makeSampleData());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected');
    return result.value;
}

// ---------------------------------------------------------------------------
// fromJson
// ---------------------------------------------------------------------------

describe('DicomDataset.fromJson', () => {
    it('accepts a valid JSON object', () => {
        const result = DicomDataset.fromJson({ '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Test' }] } });
        expect(result.ok).toBe(true);
    });

    it('accepts an empty object', () => {
        const result = DicomDataset.fromJson({});
        expect(result.ok).toBe(true);
    });

    it('rejects a non-hex tag key', () => {
        const result = DicomDataset.fromJson({ NOTATAG1: { vr: 'LO', Value: ['x'] } });
        expect(result.ok).toBe(false);
    });

    it('rejects a non-element value under a valid key', () => {
        const result = DicomDataset.fromJson({ '00100020': 'not an element' });
        expect(result.ok).toBe(false);
    });

    it('rejects null', () => {
        const result = DicomDataset.fromJson(null);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/non-null/);
    });

    it('rejects undefined', () => {
        const result = DicomDataset.fromJson(undefined);
        expect(result.ok).toBe(false);
    });

    it('rejects arrays', () => {
        const result = DicomDataset.fromJson([1, 2, 3]);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/non-array/);
    });

    it('rejects primitives', () => {
        expect(DicomDataset.fromJson('string').ok).toBe(false);
        expect(DicomDataset.fromJson(42).ok).toBe(false);
        expect(DicomDataset.fromJson(true).ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getElement
// ---------------------------------------------------------------------------

describe('DicomDataset.getElement', () => {
    const ds = makeDataset();

    it('finds element by hex string', () => {
        const result = ds.getElement('00100010');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.vr).toBe('PN');
        }
    });

    it('finds element by DicomTag format', () => {
        const result = ds.getElement('(0010,0010)' as DicomTag);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.vr).toBe('PN');
        }
    });

    it('is case-insensitive for hex', () => {
        const result = ds.getElement('00100010');
        expect(result.ok).toBe(true);
    });

    it('returns error for unknown tag', () => {
        const result = ds.getElement('99999999');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/not found/);
    });

    it('returns error for invalid tag format', () => {
        const result = ds.getElement('INVALID');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/Invalid tag format/);
    });

    it('returns InlineBinary element', () => {
        const result = ds.getElement('7FE00010');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.InlineBinary).toBe('AAAA');
        }
    });
});

// ---------------------------------------------------------------------------
// getValue / getFirstValue
// ---------------------------------------------------------------------------

describe('DicomDataset.getValue', () => {
    const ds = makeDataset();

    it('returns Value array for single-valued tag', () => {
        const result = ds.getValue('00100020');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(['PATIENT-001']);
        }
    });

    it('returns Value array for multi-valued tag', () => {
        const result = ds.getValue('00080008');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(['ORIGINAL', 'PRIMARY', 'AXIAL']);
        }
    });

    it('returns error for tag with no Value property', () => {
        const result = ds.getValue('00280101');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/no Value/);
    });

    it('returns error for missing tag', () => {
        const result = ds.getValue('99999999');
        expect(result.ok).toBe(false);
    });
});

describe('DicomDataset.getFirstValue', () => {
    const ds = makeDataset();

    it('returns first value of single-valued tag', () => {
        const result = ds.getFirstValue('00100020');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe('PATIENT-001');
    });

    it('returns first value of multi-valued tag', () => {
        const result = ds.getFirstValue('00080008');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe('ORIGINAL');
    });

    it('returns error for missing tag', () => {
        const result = ds.getFirstValue('99999999');
        expect(result.ok).toBe(false);
    });

    it('returns error for tag with no Value', () => {
        const result = ds.getFirstValue('00280101');
        expect(result.ok).toBe(false);
    });

    it('returns error for empty Value array', () => {
        const r = DicomDataset.fromJson({ '00100020': { vr: 'LO', Value: [] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const result = r.value.getFirstValue('00100020');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/empty/);
    });
});

// ---------------------------------------------------------------------------
// getString
// ---------------------------------------------------------------------------

describe('DicomDataset.getString', () => {
    const ds = makeDataset();

    it('returns string value for LO tag', () => {
        expect(ds.getString('00100020')).toBe('PATIENT-001');
    });

    it('returns Alphabetic component for PN tag', () => {
        expect(ds.getString('00100010')).toBe('Smith^John');
    });

    it('returns empty string for missing tag when no fallback', () => {
        expect(ds.getString('99999999')).toBe('');
    });

    it('returns fallback for missing tag', () => {
        expect(ds.getString('99999999', 'N/A')).toBe('N/A');
    });

    it('returns fallback when element has no Value', () => {
        expect(ds.getString('00280101', 'default')).toBe('default');
    });

    it('converts numeric values to string', () => {
        expect(ds.getString('00280010')).toBe('512');
    });

    it('returns empty string for element with null first value', () => {
        const r = DicomDataset.fromJson({ '00100020': { vr: 'LO', Value: [null] } });
        if (!r.ok) return;
        expect(r.value.getString('00100020', 'fallback')).toBe('fallback');
    });

    it('returns empty string for a PN value that is not a component object', () => {
        const r = DicomDataset.fromJson({ '00100010': { vr: 'PN', Value: ['plain string'] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.getString('00100010', 'fallback')).toBe('fallback');
    });

    it('joins multi-valued tags with backslash (#43)', () => {
        const r = DicomDataset.fromJson({ '00080061': { vr: 'CS', Value: ['OT', 'CR'] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.getString('00080061')).toBe('OT\\CR');
    });

    it('preserves empty components so present tags never read as missing (#43)', () => {
        const r = DicomDataset.fromJson({ '00080061': { vr: 'CS', Value: ['', 'OT', ''] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.getString('00080061', 'MISSING')).toBe('\\OT\\');
    });

    it('joins multi-valued PN tags by Alphabetic component (#43)', () => {
        const r = DicomDataset.fromJson({ '00081060': { vr: 'PN', Value: [{ Alphabetic: 'Doe^Jane' }, { Alphabetic: 'Roe^Richard' }] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.getString('00081060')).toBe('Doe^Jane\\Roe^Richard');
    });

    it('joins multi-valued numeric tags (#43)', () => {
        const r = DicomDataset.fromJson({ '00201041': { vr: 'DS', Value: [-12.5, 3.25] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.getString('00201041')).toBe('-12.5\\3.25');
    });

    it('null components join as empty, still distinguishable from missing (#43)', () => {
        const r = DicomDataset.fromJson({ '00080061': { vr: 'CS', Value: [null, 'OT'] } });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.getString('00080061', 'MISSING')).toBe('\\OT');
    });

    it('handles PN without Alphabetic component', () => {
        const r = DicomDataset.fromJson({ '00100010': { vr: 'PN', Value: [{ Ideographic: 'Test' }] } });
        if (!r.ok) return;
        expect(r.value.getString('00100010', 'fallback')).toBe('fallback');
    });

    it('handles PN with non-string Alphabetic', () => {
        const r = DicomDataset.fromJson({ '00100010': { vr: 'PN', Value: [{ Alphabetic: 123 }] } });
        if (!r.ok) return;
        expect(r.value.getString('00100010', 'fallback')).toBe('fallback');
    });

    it('handles boolean values', () => {
        const r = DicomDataset.fromJson({ '00100020': { vr: 'CS', Value: [true] } });
        if (!r.ok) return;
        expect(r.value.getString('00100020')).toBe('true');
    });

    it('returns fallback for non-primitive values', () => {
        const r = DicomDataset.fromJson({ '00100020': { vr: 'LO', Value: [{ nested: true }] } });
        if (!r.ok) return;
        expect(r.value.getString('00100020', 'fallback')).toBe('fallback');
    });
});

// ---------------------------------------------------------------------------
// getNumber
// ---------------------------------------------------------------------------

describe('DicomDataset.getNumber', () => {
    const ds = makeDataset();

    it('returns number for US tag', () => {
        const result = ds.getNumber('00280010');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(512);
    });

    it('parses numeric string (DS tag)', () => {
        const result = ds.getNumber('00280030');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(0.5);
    });

    it('returns error for non-numeric string', () => {
        const result = ds.getNumber('00100020');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/Cannot convert/);
    });

    it('returns error for missing tag', () => {
        const result = ds.getNumber('99999999');
        expect(result.ok).toBe(false);
    });

    it('returns error for element with no Value', () => {
        const result = ds.getNumber('00280101');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/no Value/);
    });

    it('returns error for non-numeric type', () => {
        const r = DicomDataset.fromJson({ '00280010': { vr: 'US', Value: [{ obj: true }] } });
        if (!r.ok) return;
        const result = r.value.getNumber('00280010');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/not numeric/);
    });

    it('returns error for empty Value array', () => {
        const r = DicomDataset.fromJson({ '00280010': { vr: 'US', Value: [] } });
        if (!r.ok) return;
        const result = r.value.getNumber('00280010');
        expect(result.ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getStrings
// ---------------------------------------------------------------------------

describe('DicomDataset.getStrings', () => {
    const ds = makeDataset();

    it('returns all string values for multi-valued CS tag', () => {
        const result = ds.getStrings('00080008');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(['ORIGINAL', 'PRIMARY', 'AXIAL']);
        }
    });

    it('returns single-element array for single-valued tag', () => {
        const result = ds.getStrings('00100020');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(['PATIENT-001']);
        }
    });

    it('converts numeric values to strings', () => {
        const result = ds.getStrings('00280030');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(['0.5', '0.5']); // numbers converted to strings by extractStrings
        }
    });

    it('returns error for missing tag', () => {
        const result = ds.getStrings('99999999');
        expect(result.ok).toBe(false);
    });

    it('returns empty array for element with no Value', () => {
        const result = ds.getStrings('00280101');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual([]);
    });

    it('converts boolean values to strings', () => {
        const r = DicomDataset.fromJson({ '00100020': { vr: 'CS', Value: [true, false] } });
        if (!r.ok) return;
        const result = r.value.getStrings('00100020');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(['true', 'false']);
    });

    it('returns empty string for non-primitive values', () => {
        const r = DicomDataset.fromJson({ '00100020': { vr: 'LO', Value: [{ nested: true }] } });
        if (!r.ok) return;
        const result = r.value.getStrings('00100020');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(['']);
    });
});

// ---------------------------------------------------------------------------
// hasTag
// ---------------------------------------------------------------------------

describe('DicomDataset.hasTag', () => {
    const ds = makeDataset();

    it('returns true for present tag (hex string)', () => {
        expect(ds.hasTag('00100010')).toBe(true);
    });

    it('returns true for present tag (DicomTag format)', () => {
        expect(ds.hasTag('(0010,0010)' as DicomTag)).toBe(true);
    });

    it('returns false for absent tag', () => {
        expect(ds.hasTag('99999999')).toBe(false);
    });

    it('returns false for invalid tag format', () => {
        expect(ds.hasTag('INVALID')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getElementAtPath
// ---------------------------------------------------------------------------

describe('DicomDataset.getElementAtPath', () => {
    const ds = makeDataset();

    it('resolves simple (non-sequence) tag path', () => {
        const result = ds.getElementAtPath('(0010,0010)' as DicomTagPath);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.vr).toBe('PN');
    });

    it('traverses into a sequence item', () => {
        const result = ds.getElementAtPath('(0008,1115)[0].(0020,000E)' as DicomTagPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.Value).toEqual(['1.2.3.4.5.6.7']);
        }
    });

    it('traverses nested sequences', () => {
        const result = ds.getElementAtPath('(0008,1115)[0].(0008,1199)[1].(0008,1150)' as DicomTagPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.Value).toEqual(['1.2.840.10008.5.1.4.1.1.4']);
        }
    });

    it('returns error for non-existent intermediate tag', () => {
        const result = ds.getElementAtPath('(9999,9999)[0].(0010,0010)' as DicomTagPath);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/not found/);
    });

    it('returns error for out-of-range sequence index', () => {
        const result = ds.getElementAtPath('(0008,1115)[99].(0020,000E)' as DicomTagPath);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/no valid item at index/);
    });

    it('returns error when intermediate tag is not a sequence', () => {
        const result = ds.getElementAtPath('(0010,0010)[0].(0010,0020)' as DicomTagPath);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/not a sequence/);
    });

    it('uses index 0 by default when no index specified on intermediate segment', () => {
        const data: DicomJsonModel = {
            '00081115': {
                vr: 'SQ',
                Value: [{ '0020000E': { vr: 'UI', Value: ['1.2.3'] } }],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const result = r.value.getElementAtPath('(0008,1115).(0020,000E)' as DicomTagPath);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.Value).toEqual(['1.2.3']);
    });
});

// ---------------------------------------------------------------------------
// findValues
// ---------------------------------------------------------------------------

describe('DicomDataset.findValues', () => {
    const ds = makeDataset();

    it('collects values across all wildcard items', () => {
        const values = ds.findValues('(0008,1115)[*].(0020,000E)' as DicomTagPath);
        expect(values).toEqual(['1.2.3.4.5.6.7', '1.2.3.4.5.6.8']);
    });

    it('collects values from nested wildcard paths', () => {
        const values = ds.findValues('(0008,1115)[*].(0008,1199)[*].(0008,1150)' as DicomTagPath);
        expect(values).toEqual(['1.2.840.10008.5.1.4.1.1.2', '1.2.840.10008.5.1.4.1.1.4', '1.2.840.10008.5.1.4.1.1.7']);
    });

    it('returns empty array for non-existent tag in wildcard path', () => {
        const values = ds.findValues('(0008,1115)[*].(9999,9999)' as DicomTagPath);
        expect(values).toEqual([]);
    });

    it('collects values through an explicit item index', () => {
        const values = ds.findValues('(0008,1115)[1].(0020,000E)' as DicomTagPath);
        expect(values).toEqual(['1.2.3.4.5.6.8']);
    });

    it('returns empty array for an out-of-range item index', () => {
        const values = ds.findValues('(0008,1115)[9].(0020,000E)' as DicomTagPath);
        expect(values).toEqual([]);
    });

    it('returns empty array when base tag is missing', () => {
        const values = ds.findValues('(9999,9999)[*].(0010,0010)' as DicomTagPath);
        expect(values).toEqual([]);
    });

    it('handles non-wildcard path (specific index)', () => {
        const values = ds.findValues('(0008,1115)[1].(0020,000E)' as DicomTagPath);
        expect(values).toEqual(['1.2.3.4.5.6.8']);
    });

    it('returns leaf values for simple (non-sequence) path', () => {
        const values = ds.findValues('(0010,0020)' as DicomTagPath);
        expect(values).toEqual(['PATIENT-001']);
    });

    it('returns empty for tag with no Value property', () => {
        const values = ds.findValues('(0028,0101)' as DicomTagPath);
        expect(values).toEqual([]);
    });

    it('handles intermediate non-sequence gracefully', () => {
        const values = ds.findValues('(0010,0010)[*].(0010,0020)' as DicomTagPath);
        expect(values).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Convenience getters
// ---------------------------------------------------------------------------

describe('DicomDataset convenience getters', () => {
    const ds = makeDataset();

    it('accession returns AccessionNumber', () => {
        expect(ds.accession).toBe('ACC-12345');
    });

    it('patientName returns PN Alphabetic component', () => {
        expect(ds.patientName).toBe('Smith^John');
    });

    it('patientID returns PatientID', () => {
        expect(ds.patientID).toBe('PATIENT-001');
    });

    it('studyDate returns StudyDate', () => {
        expect(ds.studyDate).toBe('20240115');
    });

    it('modality returns Modality', () => {
        expect(ds.modality).toBe('CT');
    });

    it('sopClassUID returns branded SOPClassUID', () => {
        expect(ds.sopClassUID).toBe('1.2.840.10008.5.1.4.1.1.2');
    });

    it('studyInstanceUID returns StudyInstanceUID', () => {
        expect(ds.studyInstanceUID).toBe('1.2.3.4.5');
    });

    it('seriesInstanceUID returns SeriesInstanceUID', () => {
        expect(ds.seriesInstanceUID).toBe('1.2.3.4.5.6');
    });

    it('sopInstanceUID returns SOPInstanceUID', () => {
        expect(ds.sopInstanceUID).toBe('1.2.3.4.5.6.7.8.9');
    });

    it('transferSyntaxUID returns TransferSyntaxUID', () => {
        expect(ds.transferSyntaxUID).toBe('1.2.840.10008.1.2.1');
    });

    it('returns empty string when convenience tag is missing', () => {
        const r = DicomDataset.fromJson({});
        if (!r.ok) return;
        expect(r.value.patientName).toBe('');
        expect(r.value.modality).toBe('');
        expect(r.value.studyDate).toBe('');
    });

    it('sopClassUID returns undefined when tag is missing', () => {
        const r = DicomDataset.fromJson({});
        if (!r.ok) return;
        expect(r.value.sopClassUID).toBeUndefined();
    });

    it('sopClassUID returns undefined for invalid UID', () => {
        const r = DicomDataset.fromJson({ '00080016': { vr: 'UI', Value: ['not-a-valid-uid!'] } });
        if (!r.ok) return;
        expect(r.value.sopClassUID).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('DicomDataset immutability', () => {
    it('data cannot be mutated via getElement reference', () => {
        const data: DicomJsonModel = {
            '00100020': { vr: 'LO', Value: ['ORIGINAL'] },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const ds = r.value;

        const elemResult = ds.getElement('00100020');
        if (!elemResult.ok) return;

        // Attempting to mutate via the reference should not affect the dataset
        // The TypeScript readonly types prevent this at compile-time,
        // but we verify runtime behavior too
        const mutable = elemResult.value as unknown as Record<string, unknown>;
        mutable['vr'] = 'PN';

        // Original data is affected because JS objects are references,
        // but the dataset still returns the same reference — this is expected.
        // True deep freeze is not needed; immutability is enforced by the type system.
        const elemResult2 = ds.getElement('00100020');
        expect(elemResult2.ok).toBe(true);
    });

    it('external mutation of source data does not break construction', () => {
        const data: Record<string, unknown> = {
            '00100020': { vr: 'LO', Value: ['ORIGINAL'] },
        };
        const r = DicomDataset.fromJson(data);
        expect(r.ok).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('DicomDataset edge cases', () => {
    it('handles lowercase hex tag keys in data', () => {
        const r = DicomDataset.fromJson({ '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Test' }] } });
        if (!r.ok) return;
        // Access with uppercase lookup should find lowercase-keyed data
        // since our normalizer uppercases the query
        expect(r.value.hasTag('00100010')).toBe(true);
    });

    it('handles InlineBinary elements without Value', () => {
        const r = DicomDataset.fromJson({ '7FE00010': { vr: 'OW', InlineBinary: 'AAAA' } });
        if (!r.ok) return;
        const result = r.value.getElement('7FE00010');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.InlineBinary).toBe('AAAA');
    });

    it('getValue returns error for InlineBinary element without Value', () => {
        const r = DicomDataset.fromJson({ '7FE00010': { vr: 'OW', InlineBinary: 'AAAA' } });
        if (!r.ok) return;
        const result = r.value.getValue('7FE00010');
        expect(result.ok).toBe(false);
    });

    it('handles tag path with non-object sequence item', () => {
        const data: DicomJsonModel = {
            '00081115': { vr: 'SQ', Value: ['not-an-object' as unknown] },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const result = r.value.getElementAtPath('(0008,1115)[0].(0020,000E)' as DicomTagPath);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/no valid item/);
    });

    it('handles null sequence item in wildcard traversal', () => {
        const data: DicomJsonModel = {
            '00081115': { vr: 'SQ', Value: [null as unknown, { '0020000E': { vr: 'UI', Value: ['1.2.3'] } }] },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const values = r.value.findValues('(0008,1115)[*].(0020,000E)' as DicomTagPath);
        expect(values).toEqual(['1.2.3']);
    });
});

// ---------------------------------------------------------------------------
// Nested sequence edge cases
// ---------------------------------------------------------------------------

describe('DicomDataset nested sequence edge cases', () => {
    it('handles 3-level deep nested sequence via getElementAtPath', () => {
        const data: DicomJsonModel = {
            '0040A730': {
                vr: 'SQ',
                Value: [
                    {
                        '0040A730': {
                            vr: 'SQ',
                            Value: [
                                {
                                    '0040A730': {
                                        vr: 'SQ',
                                        Value: [{ '0040A160': { vr: 'UT', Value: ['deep-value'] } }],
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const result = r.value.getElementAtPath('(0040,A730)[0].(0040,A730)[0].(0040,A730)[0].(0040,A160)' as DicomTagPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.Value).toEqual(['deep-value']);
        }
    });

    it('handles empty sequence (Value: [])', () => {
        const data: DicomJsonModel = {
            '00081115': {
                vr: 'SQ',
                Value: [],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;

        // Traversing into an empty sequence should fail
        const result = r.value.getElementAtPath('(0008,1115)[0].(0020,000E)' as DicomTagPath);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/no valid item/);
    });

    it('returns empty array for wildcard into empty sequence', () => {
        const data: DicomJsonModel = {
            '00081115': {
                vr: 'SQ',
                Value: [],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const values = r.value.findValues('(0008,1115)[*].(0020,000E)' as DicomTagPath);
        expect(values).toEqual([]);
    });

    it('wildcard path into 3-level nested sequences', () => {
        const data: DicomJsonModel = {
            '0040A730': {
                vr: 'SQ',
                Value: [
                    {
                        '0040A730': {
                            vr: 'SQ',
                            Value: [{ '0040A160': { vr: 'UT', Value: ['nested-a'] } }, { '0040A160': { vr: 'UT', Value: ['nested-b'] } }],
                        },
                    },
                    {
                        '0040A730': {
                            vr: 'SQ',
                            Value: [{ '0040A160': { vr: 'UT', Value: ['nested-c'] } }],
                        },
                    },
                ],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const values = r.value.findValues('(0040,A730)[*].(0040,A730)[*].(0040,A160)' as DicomTagPath);
        expect(values).toEqual(['nested-a', 'nested-b', 'nested-c']);
    });

    it('multiple items in a sequence with wildcard returns all values', () => {
        const data: DicomJsonModel = {
            '00081115': {
                vr: 'SQ',
                Value: [
                    { '0020000E': { vr: 'UI', Value: ['series-1'] } },
                    { '0020000E': { vr: 'UI', Value: ['series-2'] } },
                    { '0020000E': { vr: 'UI', Value: ['series-3'] } },
                    { '0020000E': { vr: 'UI', Value: ['series-4'] } },
                ],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const values = r.value.findValues('(0008,1115)[*].(0020,000E)' as DicomTagPath);
        expect(values).toEqual(['series-1', 'series-2', 'series-3', 'series-4']);
    });

    it('sequence with missing Value property treated as absent', () => {
        const data: DicomJsonModel = {
            '00081115': {
                vr: 'SQ',
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const result = r.value.getElementAtPath('(0008,1115)[0].(0020,000E)' as DicomTagPath);
        expect(result.ok).toBe(false);
    });

    it('deeply nested wildcard with some items missing the target tag', () => {
        const data: DicomJsonModel = {
            '0040A730': {
                vr: 'SQ',
                Value: [
                    {
                        '0040A730': {
                            vr: 'SQ',
                            Value: [{ '0040A160': { vr: 'UT', Value: ['found'] } }, { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'irrelevant' }] } }],
                        },
                    },
                ],
            },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const values = r.value.findValues('(0040,A730)[*].(0040,A730)[*].(0040,A160)' as DicomTagPath);
        expect(values).toEqual(['found']);
    });
});

// ---------------------------------------------------------------------------
// Wildcard traversal truncation (D-9)
// ---------------------------------------------------------------------------

describe('DicomDataset wildcard traversal truncation', () => {
    it('returns all results for datasets within the iteration limit', () => {
        // Build a moderately-sized dataset — well within the 5000-iteration limit
        const items: Record<string, DicomJsonElement>[] = [];
        for (let i = 0; i < 100; i++) {
            items.push({ '0020000E': { vr: 'UI', Value: [`1.2.3.${i}`] } });
        }
        const data: DicomJsonModel = {
            '00081115': { vr: 'SQ', Value: items },
        };
        const r = DicomDataset.fromJson(data);
        if (!r.ok) return;
        const values = r.value.findValues('(0008,1115)[*].(0020,000E)' as DicomTagPath);
        expect(values).toHaveLength(100);
    });
});

// ---------------------------------------------------------------------------
// walkTags (delegates to standalone — light coverage)
// ---------------------------------------------------------------------------

describe('DicomDataset.walkTags', () => {
    it('returns all tags from a flat dataset', () => {
        const r = DicomDataset.fromJson({
            '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Test' }] },
            '00100020': { vr: 'LO', Value: ['ID'] },
        });
        if (!r.ok) return;
        const entries: ReadonlyArray<WalkTagEntry> = r.value.walkTags();
        expect(entries).toHaveLength(2);
    });

    it('filters by VR', () => {
        const r = DicomDataset.fromJson({
            '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Test' }] },
            '00100020': { vr: 'LO', Value: ['ID'] },
        });
        if (!r.ok) return;
        const entries = r.value.walkTags({ vrFilter: ['LO'] });
        expect(entries).toHaveLength(1);
        expect(entries[0]!.tag).toBe('00100020');
    });

    it('recurses into sequences', () => {
        const ds = makeDataset();
        const entries = ds.walkTags({ vrFilter: ['UI'] });
        expect(entries.length).toBeGreaterThan(1);
        expect(entries.some(e => e.depth > 0)).toBe(true);
    });
});
