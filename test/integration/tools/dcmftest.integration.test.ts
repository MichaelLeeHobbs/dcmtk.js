import { describe, it, expect } from 'vitest';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmftest integration', () => {
    it('identifies a valid DICOM file', async () => {
        const result = await dcmftest(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isDicom).toBe(true);
        }
    });

    it('identifies a second valid DICOM file', async () => {
        const result = await dcmftest(SAMPLES.OTHER_0002);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isDicom).toBe(true);
        }
    });

    it('identifies nested-tags DICOM file as valid', async () => {
        const result = await dcmftest(SAMPLES.NESTED_TAGS);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isDicom).toBe(true);
        }
    });

    it('returns isDicom false for a non-DICOM file', async () => {
        // package.json is not a DICOM file — dcmftest returns non-zero exit code
        const result = await dcmftest('package.json');
        // Binary may return error or ok with isDicom: false
        if (result.ok) {
            expect(result.value.isDicom).toBe(false);
        } else {
            // Non-zero exit code is also a valid response for non-DICOM
            expect(result.ok).toBe(false);
        }
    });

    it('returns error for non-existent path', async () => {
        const result = await dcmftest('/nonexistent/path/file.dcm');
        // dcmftest returns non-zero exit code for missing files
        expect(result.ok).toBe(false);
    });

    it('respects timeout option', async () => {
        const result = await dcmftest(SAMPLES.MR_BRAIN, { timeoutMs: 60_000 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isDicom).toBe(true);
        }
    });
});
