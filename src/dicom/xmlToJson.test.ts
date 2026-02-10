import { describe, it, expect } from 'vitest';
import { xmlToJson } from './xmlToJson';

describe('xmlToJson (public re-export)', () => {
    it('is importable from dicom/xmlToJson', () => {
        expect(typeof xmlToJson).toBe('function');
    });

    it('converts basic XML to DICOM JSON Model', () => {
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

    it('returns error for invalid XML', () => {
        const result = xmlToJson('not xml at all');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('missing NativeDicomModel');
        }
    });
});
