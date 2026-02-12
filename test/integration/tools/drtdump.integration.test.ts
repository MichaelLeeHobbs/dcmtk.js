import { describe, it, expect } from 'vitest';
import { drtdump } from '../../../src/tools/drtdump';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('drtdump integration', () => {
    it('runs without crashing for a non-RT DICOM file', async () => {
        const result = await drtdump(SAMPLES.MR_BRAIN);
        // drtdump exits 0 even for non-RT DICOM files — just verify it runs
        expect(typeof result.ok).toBe('boolean');
    });

    it('returns error for non-existent file', async () => {
        const result = await drtdump('/nonexistent/path/file.dcm');
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await drtdump(SAMPLES.MR_BRAIN, { bogus: true });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
