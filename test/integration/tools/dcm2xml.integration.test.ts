import { describe, it, expect } from 'vitest';
import { dcm2xml } from '../../../src/tools/dcm2xml';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcm2xml integration', () => {
    it('converts an MR DICOM file to XML', async () => {
        const result = await dcm2xml(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toContain('<file-format>');
            expect(result.value.xml).toContain('tag="0010,0010"'); // PatientName tag
        }
    });

    it('converts a file with nested sequences to XML', async () => {
        const result = await dcm2xml(SAMPLES.NESTED_TAGS);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toContain('<file-format>');
        }
    });

    it('converts with namespace enabled', async () => {
        const result = await dcm2xml(SAMPLES.MR_BRAIN, { namespace: true });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toContain('xmlns=');
        }
    });

    it('converts another DICOM format', async () => {
        const result = await dcm2xml(SAMPLES.OTHER_0002);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toContain('<file-format>');
        }
    });

    it('returns error for non-existent file', async () => {
        const result = await dcm2xml('/nonexistent/path/file.dcm');
        expect(result.ok).toBe(false);
    });

    it('produces valid XML structure', async () => {
        const result = await dcm2xml(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toMatch(/^<\?xml/);
            expect(result.value.xml).toContain('</file-format>');
        }
    });
});
