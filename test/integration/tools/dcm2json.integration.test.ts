import { describe, it, expect } from 'vitest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcm2json integration', () => {
    it('converts MR DICOM via XML path (default)', async () => {
        const result = await dcm2json(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('xml');
            expect(result.value.data).toBeDefined();
            expect(result.value.data['00100010']).toBeDefined();
        }
    });

    it('converts a DICOM file with nested sequences', async () => {
        const result = await dcm2json(SAMPLES.NESTED_TAGS);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.data).toBeDefined();
        }
    });

    it('converts another DICOM file', async () => {
        const result = await dcm2json(SAMPLES.OTHER_0002);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.data).toBeDefined();
        }
    });

    it('returns error for non-existent file', async () => {
        const result = await dcm2json('/nonexistent/path/file.dcm');
        expect(result.ok).toBe(false);
    });

    it('result data has expected DICOM JSON structure', async () => {
        const result = await dcm2json(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const patientName = result.value.data['00100010'];
            expect(patientName).toBeDefined();
            if (patientName !== undefined) {
                expect(patientName).toHaveProperty('vr');
                expect(patientName).toHaveProperty('Value');
            }
        }
    });
});
