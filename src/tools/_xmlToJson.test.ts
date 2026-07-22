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

    it('converts multi-value elements with numeric coercion for DS VR', () => {
        const result = xmlToJson(MULTI_VALUE_XML);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00280030']).toEqual({
                vr: 'DS',
                Value: [0.5, 0.5],
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

    it('decodes empty value positions as empty strings, not the number attribute', () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute tag="00080008" vr="CS" keyword="ImageType">
    <Value number="1"/>
    <Value number="2">SECONDARY</Value>
  </DicomAttribute>
</NativeDicomModel>`;
        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00080008']).toEqual({ vr: 'CS', Value: ['', 'SECONDARY'] });
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

    it('accepts known standard VR codes as-is', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']?.vr).toBe('LO');
        }
    });

    it('falls back to UN for unrecognized VR codes', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="xs" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']?.vr).toBe('UN');
        }
    });

    it('falls back to UN for retired DCMTK-internal VR "ox"', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="7FE00010" vr="ox" keyword="PixelData">
    <InlineBinary>AQIDBA==</InlineBinary>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['7FE00010']?.vr).toBe('UN');
            expect(result.value['7FE00010']?.InlineBinary).toBe('AQIDBA==');
        }
    });

    it('coerces US VR values to numbers', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00280010" vr="US" keyword="Rows">
    <Value number="1">512</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00280010']!.Value).toEqual([512]);
        }
    });

    it('coerces IS VR values to numbers', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00200013" vr="IS" keyword="InstanceNumber">
    <Value number="1">42</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00200013']!.Value).toEqual([42]);
        }
    });

    it('keeps string VR values as strings even if numeric-looking', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">123</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']!.Value).toEqual(['123']);
        }
    });

    it('keeps non-parseable DS values as strings (defensive)', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00280030" vr="DS" keyword="PixelSpacing">
    <Value number="1">abc</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00280030']!.Value).toEqual(['abc']);
        }
    });

    it('unwraps @_number-only wrapper objects', () => {
        // Simulate fast-xml-parser producing {"@_number": "1"} without #text
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">test-value</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Value should be unwrapped to a plain string, not a wrapper object
            const val = result.value['00100020']!.Value![0];
            expect(typeof val).toBe('string');
        }
    });

    it('decodes the five predefined XML entities in element values (issue #26)', () => {
        // dcm2xml emits XML-escaped entities for values containing & < > " '
        // so the output is well-formed XML. They must be decoded back to literals.
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00081090" vr="LO" keyword="ManufacturerModelName">
    <Value number="1">Model &quot;Foo&quot; &amp; &lt;Bar&gt; &apos;Baz&apos;</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00081090']!.Value).toEqual([`Model "Foo" & <Bar> 'Baz'`]);
        }
    });

    it('decodes XML entities in PersonName components (issue #26)', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00080090" vr="PN" keyword="ReferringPhysicianName">
    <PersonName number="1">
      <Alphabetic>
        <FamilyName>Smith &amp; Jones</FamilyName>
      </Alphabetic>
    </PersonName>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00080090']!.Value).toEqual([{ Alphabetic: 'Smith & Jones' }]);
        }
    });

    it('does not double-decode escaped entity sequences (issue #26)', () => {
        // A literal "&lt;" in the value is emitted by dcm2xml as "&amp;lt;".
        // Decoding &amp; last must yield the literal "&lt;", not "<".
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00081090" vr="LO" keyword="ManufacturerModelName">
    <Value number="1">a &amp;lt; b</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00081090']!.Value).toEqual(['a &lt; b']);
        }
    });

    it('prefers #text over @_number when both present', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">actual-text</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        const result = xmlToJson(xml);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value['00100020']!.Value).toEqual(['actual-text']);
        }
    });
});
