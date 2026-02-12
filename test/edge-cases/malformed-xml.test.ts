/**
 * Tests for malformed XML handling in _xmlToJson.
 * Verifies that the XML parser handles various invalid and edge-case
 * inputs gracefully, returning appropriate errors or empty results.
 *
 * @module malformed-xml.test
 */

import { describe, it, expect } from 'vitest';
import { xmlToJson } from '../../src/tools/_xmlToJson';

describe('xmlToJson malformed XML inputs', () => {
    it('returns error for empty string', () => {
        const result = xmlToJson('');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/missing NativeDicomModel/);
        }
    });

    it('returns error for plain text (not XML)', () => {
        const result = xmlToJson('hello world');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/missing NativeDicomModel/);
        }
    });

    it('returns error for XML without NativeDicomModel root', () => {
        const result = xmlToJson('<Root><Child/></Root>');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/missing NativeDicomModel root element/);
        }
    });

    it('handles unclosed tags gracefully', () => {
        const result = xmlToJson('<NativeDicomModel><DicomAttribute');

        // fast-xml-parser may or may not throw for unclosed tags
        // Either an error or a result with the available data is acceptable
        expect(result).toBeDefined();
        if (result.ok) {
            // If it succeeds, it should be a valid (possibly empty) object
            expect(typeof result.value).toBe('object');
        } else {
            expect(result.error).toBeInstanceOf(Error);
        }
    });

    it('handles DicomAttribute missing required tag/vr attributes', () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute>
    <Value number="1">test</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        // Should succeed but the attribute without a tag is skipped
        // (convertAttributes checks for tag === undefined)
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value)).toHaveLength(0);
        }
    });

    it('handles empty self-closing NativeDicomModel', () => {
        const result = xmlToJson('<NativeDicomModel/>');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value)).toHaveLength(0);
        }
    });

    it('handles NativeDicomModel with text content only', () => {
        const result = xmlToJson('<NativeDicomModel>random text content</NativeDicomModel>');

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Text content inside NativeDicomModel with no DicomAttribute children
            // should produce an empty object
            expect(Object.keys(result.value)).toHaveLength(0);
        }
    });

    it('handles deeply nested sequences (10 levels)', () => {
        let xml = '<?xml version="1.0"?>\n<NativeDicomModel>\n';
        let closingTags = '';

        // Build 10 levels of nested SQ > Item > DicomAttribute
        for (let i = 0; i < 10; i++) {
            const tag = `0040A73${String(i).padStart(1, '0')}`;
            xml += `  <DicomAttribute tag="${tag}" vr="SQ" keyword="Seq${String(i)}">\n    <Item>\n`;
            closingTags = `    </Item>\n  </DicomAttribute>\n${closingTags}`;
        }

        // Innermost element
        xml += '      <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">\n';
        xml += '        <Value number="1">DEEP</Value>\n';
        xml += '      </DicomAttribute>\n';

        xml += closingTags;
        xml += '</NativeDicomModel>';

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Verify the outermost SQ exists
            expect(result.value['0040A730']).toBeDefined();
            expect(result.value['0040A730']!.vr).toBe('SQ');
        }
    });

    it('handles DicomAttribute with empty tag and vr attributes', () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute tag="" vr="">
    <Value number="1">empty attrs</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty string tag is still a valid key — it will be stored under ""
            // This is technically malformed DICOM but should not crash
            if (result.value[''] !== undefined) {
                expect(result.value[''].vr).toBe('');
            }
        }
    });

    it('handles duplicate DicomAttribute tags (last wins)', () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">FIRST</Value>
  </DicomAttribute>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">SECOND</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // The second element should overwrite the first
            expect(result.value['00100020']!.Value).toEqual(['SECOND']);
        }
    });

    it('handles XML with processing instructions other than xml decl', () => {
        const xml = `<?xml version="1.0"?>
<?some-processing-instruction data="value"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">PI_TEST</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        // Should handle extra processing instructions without error
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']!.Value).toEqual(['PI_TEST']);
        }
    });

    it('handles XML with CDATA sections in values', () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute tag="00104000" vr="LT" keyword="PatientComments">
    <Value number="1"><![CDATA[Special <chars> & "quotes"]]></Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const val = result.value['00104000']!.Value![0] as string;
            expect(val).toContain('Special');
        }
    });

    it('handles XML with numeric tag values (not strings)', () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute tag="00280010" vr="US" keyword="Rows">
    <Value number="1">512</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // With parseTagValue: false, the value should remain a string
            expect(result.value['00280010']!.Value).toEqual(['512']);
        }
    });
});
