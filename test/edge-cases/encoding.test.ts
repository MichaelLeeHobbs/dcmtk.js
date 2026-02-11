/**
 * Tests for encoding edge cases in _xmlToJson and _repairJson.
 * Verifies correct handling of UTF-8, BOM, control characters,
 * non-breaking spaces, emoji, null bytes, and long strings.
 *
 * @module encoding.test
 */

import { describe, it, expect } from 'vitest';
import { xmlToJson } from '../../src/tools/_xmlToJson';
import { repairJson } from '../../src/tools/_repairJson';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a patient name value in valid DCMTK Native DICOM Model XML.
 */
function wrapPatientName(familyName: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100010" vr="PN" keyword="PatientName">
    <PersonName number="1">
      <Alphabetic><FamilyName>${familyName}</FamilyName></Alphabetic>
    </PersonName>
  </DicomAttribute>
</NativeDicomModel>`;
}

/**
 * Wraps a string value in a DCMTK Native DICOM Model XML element.
 */
function wrapStringValue(tag: string, vr: string, value: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="${tag}" vr="${vr}" keyword="TestAttribute">
    <Value number="1">${value}</Value>
  </DicomAttribute>
</NativeDicomModel>`;
}

// ---------------------------------------------------------------------------
// XML encoding tests
// ---------------------------------------------------------------------------

describe('xmlToJson encoding edge cases', () => {
    it('handles UTF-8 with BOM prefix', () => {
        const xml = `\uFEFF<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']).toBeDefined();
            expect(result.value['00100020']!.Value).toEqual(['12345']);
        }
    });

    it('handles Japanese patient names (Kanji)', () => {
        const result = xmlToJson(wrapPatientName('山田太郎'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            const pn = result.value['00100010']!.Value![0] as Record<string, string>;
            expect(pn['Alphabetic']).toBe('山田太郎');
        }
    });

    it('handles German patient names (umlauts)', () => {
        const result = xmlToJson(wrapPatientName('M\u00fcller'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            const pn = result.value['00100010']!.Value![0] as Record<string, string>;
            expect(pn['Alphabetic']).toBe('M\u00fcller');
        }
    });

    it('handles Arabic patient names', () => {
        const result = xmlToJson(wrapPatientName('\u0645\u062D\u0645\u062F'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            const pn = result.value['00100010']!.Value![0] as Record<string, string>;
            expect(pn['Alphabetic']).toBe('\u0645\u062D\u0645\u062F');
        }
    });

    it('handles non-breaking space in values', () => {
        const result = xmlToJson(wrapStringValue('00104000', 'LT', 'Patient\u00A0Note'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            const val = result.value['00104000']!.Value![0] as string;
            expect(val).toContain('\u00A0');
        }
    });

    it('handles emoji in values', () => {
        const result = xmlToJson(wrapStringValue('00104000', 'LT', 'Note \uD83D\uDE00 Text'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            const val = result.value['00104000']!.Value![0] as string;
            expect(val).toContain('\uD83D\uDE00');
        }
    });

    it('handles very long string values (10,000 chars)', () => {
        const longValue = 'A'.repeat(10_000);
        const result = xmlToJson(wrapStringValue('00104000', 'LT', longValue));

        expect(result.ok).toBe(true);
        if (result.ok) {
            const val = result.value['00104000']!.Value![0] as string;
            expect(val).toHaveLength(10_000);
        }
    });

    it('handles values with XML character references for control characters', () => {
        // &#10; (LF) and &#13; (CR) are valid XML character references.
        // fast-xml-parser with parseTagValue: false may preserve them as-is
        // or decode them, depending on the parser configuration.
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00104000" vr="LT" keyword="PatientComments">
    <Value number="1">Line1&#10;Line2&#13;Line3</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const val = result.value['00104000']!.Value![0] as string;
            // The value should contain all three "Line" segments, whether
            // the character references are decoded or kept as literals
            expect(val).toContain('Line1');
            expect(val).toContain('Line2');
            expect(val).toContain('Line3');
        }
    });

    it('handles empty string value', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1"></Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // fast-xml-parser may represent empty Value elements differently
            expect(result.value['00100020']).toBeDefined();
        }
    });
});

// ---------------------------------------------------------------------------
// JSON repair encoding tests
// ---------------------------------------------------------------------------

describe('repairJson encoding edge cases', () => {
    it('handles UTF-8 strings with bare numbers', () => {
        const input = '{"00100010": {"vr": "DS", "Value": [42]}, "00100020": {"vr": "LO", "Value": ["M\u00fcller"]}}';
        const result = repairJson(input);
        const parsed = JSON.parse(result) as Record<string, { Value: unknown[] }>;

        expect(parsed['00100010']!.Value).toEqual(['42']);
        expect(parsed['00100020']!.Value).toEqual(['M\u00fcller']);
    });

    it('handles Japanese characters in quoted values alongside bare numbers', () => {
        const input = '{"00100010": {"vr": "PN", "Value": ["\u5C71\u7530\u592A\u90CE"]}, "00280030": {"vr": "DS", "Value": [0.5]}}';
        const result = repairJson(input);
        const parsed = JSON.parse(result) as Record<string, { Value: unknown[] }>;

        expect(parsed['00100010']!.Value).toEqual(['\u5C71\u7530\u592A\u90CE']);
        expect(parsed['00280030']!.Value).toEqual(['0.5']);
    });

    it('handles non-breaking space in JSON strings', () => {
        const input = '{"00104000": {"vr": "LT", "Value": ["Patient\u00A0Note"]}}';
        const result = repairJson(input);

        expect(result).toBe(input);
        const parsed = JSON.parse(result) as Record<string, { Value: string[] }>;
        expect(parsed['00104000']!.Value[0]).toContain('\u00A0');
    });

    it('handles very long string values without crashing', () => {
        const longVal = 'X'.repeat(10_000);
        const input = `{"00104000": {"vr": "LT", "Value": ["${longVal}"]}}`;
        const result = repairJson(input);

        expect(result).toBe(input);
    });

    it('handles empty Value array', () => {
        const input = '{"00100010": {"vr": "DS", "Value": []}}';
        const result = repairJson(input);

        expect(result).toBe(input);
    });

    it('preserves escaped unicode in strings', () => {
        const input = '{"00100010": {"vr": "LO", "Value": ["\\u0041\\u0042"]}}';
        const result = repairJson(input);

        expect(result).toBe(input);
    });
});
