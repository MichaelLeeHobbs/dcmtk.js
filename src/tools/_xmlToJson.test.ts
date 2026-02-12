import { describe, it, expect } from 'vitest';
import { xmlToJson } from './_xmlToJson';

/** Minimal valid dcm2xml output with a string element. */
const SIMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

/** XML with PersonName element. */
const PN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100010" vr="PN" keyword="PatientName">
    <PersonName number="1">
      <Alphabetic>
        <FamilyName>Smith</FamilyName>
        <GivenName>John</GivenName>
      </Alphabetic>
    </PersonName>
  </DicomAttribute>
</NativeDicomModel>`;

/** XML with multiple values. */
const MULTI_VALUE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00280030" vr="DS" keyword="PixelSpacing">
    <Value number="1">0.5</Value>
    <Value number="2">0.5</Value>
  </DicomAttribute>
</NativeDicomModel>`;

/** XML with sequence (SQ). */
const SEQUENCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00081115" vr="SQ" keyword="ReferencedSeriesSequence">
    <Item>
      <DicomAttribute tag="0020000E" vr="UI" keyword="SeriesInstanceUID">
        <Value number="1">1.2.3.4</Value>
      </DicomAttribute>
    </Item>
  </DicomAttribute>
</NativeDicomModel>`;

/** XML with InlineBinary. */
const BINARY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="7FE00010" vr="OW" keyword="PixelData">
    <InlineBinary>AQIDBA==</InlineBinary>
  </DicomAttribute>
</NativeDicomModel>`;

/** XML with empty element (no value). */
const EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100040" vr="CS" keyword="PatientSex">
  </DicomAttribute>
</NativeDicomModel>`;

/** XML with multiple elements. */
const MULTI_ELEMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100010" vr="PN" keyword="PatientName">
    <PersonName number="1">
      <Alphabetic>
        <FamilyName>Doe</FamilyName>
      </Alphabetic>
    </PersonName>
  </DicomAttribute>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">ID001</Value>
  </DicomAttribute>
  <DicomAttribute tag="00080060" vr="CS" keyword="Modality">
    <Value number="1">CT</Value>
  </DicomAttribute>
</NativeDicomModel>`;

describe('xmlToJson()', () => {
    it('converts a simple string element', () => {
        const result = xmlToJson(SIMPLE_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']).toEqual({
                vr: 'LO',
                Value: ['12345'],
            });
        }
    });

    it('converts PersonName element', () => {
        const result = xmlToJson(PN_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100010']).toEqual({
                vr: 'PN',
                Value: [{ Alphabetic: 'Smith^John' }],
            });
        }
    });

    it('converts multi-value elements', () => {
        const result = xmlToJson(MULTI_VALUE_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00280030']).toEqual({
                vr: 'DS',
                Value: ['0.5', '0.5'],
            });
        }
    });

    it('converts sequence elements', () => {
        const result = xmlToJson(SEQUENCE_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const sq = result.value['00081115'];
            expect(sq).toBeDefined();
            expect(sq!.vr).toBe('SQ');
            expect(sq!.Value).toHaveLength(1);

            const item = sq!.Value![0] as Record<string, unknown>;
            expect(item['0020000E']).toEqual({
                vr: 'UI',
                Value: ['1.2.3.4'],
            });
        }
    });

    it('converts InlineBinary elements', () => {
        const result = xmlToJson(BINARY_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['7FE00010']).toEqual({
                vr: 'OW',
                InlineBinary: 'AQIDBA==',
            });
        }
    });

    it('handles empty elements (no value)', () => {
        const result = xmlToJson(EMPTY_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100040']).toEqual({ vr: 'CS' });
        }
    });

    it('converts multiple elements', () => {
        const result = xmlToJson(MULTI_ELEMENT_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value)).toHaveLength(3);
            expect(result.value['00100010']?.vr).toBe('PN');
            expect(result.value['00100020']?.vr).toBe('LO');
            expect(result.value['00080060']?.vr).toBe('CS');
        }
    });

    it('returns error for invalid XML', () => {
        const result = xmlToJson('not xml at all <<<>>>');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/missing NativeDicomModel|Failed to parse/);
        }
    });

    it('returns error for missing NativeDicomModel root', () => {
        const result = xmlToJson('<?xml version="1.0"?><Root><Child/></Root>');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/missing NativeDicomModel root element/);
        }
    });

    it('handles empty NativeDicomModel', () => {
        const result = xmlToJson('<NativeDicomModel></NativeDicomModel>');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value)).toHaveLength(0);
        }
    });

    it('converts BulkDataURI elements', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="7FE00010" vr="OW" keyword="PixelData">
    <BulkDataURI uri="file:///data/pixel.raw"/>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['7FE00010']?.BulkDataURI).toBe('file:///data/pixel.raw');
        }
    });

    it('converts PersonName with multiple representations', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100010" vr="PN" keyword="PatientName">
    <PersonName number="1">
      <Alphabetic>
        <FamilyName>Yamada</FamilyName>
        <GivenName>Tarou</GivenName>
      </Alphabetic>
      <Ideographic>
        <FamilyName>山田</FamilyName>
        <GivenName>太郎</GivenName>
      </Ideographic>
    </PersonName>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const pn = result.value['00100010'];
            expect(pn?.Value).toHaveLength(1);
            const nameObj = pn!.Value![0] as Record<string, string>;
            expect(nameObj['Alphabetic']).toBe('Yamada^Tarou');
            expect(nameObj['Ideographic']).toBe('山田^太郎');
        }
    });

    it('handles PersonName with non-object pnNode', () => {
        // When PersonName contains a primitive instead of an object, convertPersonName should return {}
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100010" vr="PN" keyword="PatientName">
    <PersonName number="1">plain-text</PersonName>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Should handle gracefully — Value may be empty or contain empty PN
            const pn = result.value['00100010'];
            expect(pn?.vr).toBe('PN');
        }
    });

    it('handles sequence with non-object items', () => {
        // When a sequence Item is a primitive, it should be skipped
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00081115" vr="SQ" keyword="ReferencedSeriesSequence">
    <Item>plain-text</Item>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00081115']?.vr).toBe('SQ');
        }
    });

    it('converts multiple sequence items', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00081115" vr="SQ" keyword="ReferencedSeriesSequence">
    <Item>
      <DicomAttribute tag="0020000E" vr="UI" keyword="SeriesInstanceUID">
        <Value number="1">1.2.3</Value>
      </DicomAttribute>
    </Item>
    <Item>
      <DicomAttribute tag="0020000E" vr="UI" keyword="SeriesInstanceUID">
        <Value number="1">4.5.6</Value>
      </DicomAttribute>
    </Item>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00081115']?.Value).toHaveLength(2);
        }
    });
});
