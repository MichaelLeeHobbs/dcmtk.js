import { describe, it, expect } from 'vitest';
import { dcmdump } from '../../../src/tools/dcmdump';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmdump integration', () => {
    it('dumps metadata from an MR DICOM file', async () => {
        const result = await dcmdump(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toContain('(0010,0010)');
            expect(result.value.text.length).toBeGreaterThan(100);
        }
    });

    it('dumps metadata from a DICOM file with nested tags', async () => {
        const result = await dcmdump(SAMPLES.NESTED_TAGS);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text.length).toBeGreaterThan(100);
        }
    });

    it('searches for a specific tag', async () => {
        const result = await dcmdump(SAMPLES.MR_BRAIN, { searchTag: '(0010,0010)' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toContain('(0010,0010)');
        }
    });

    it('dumps in short format', async () => {
        const result = await dcmdump(SAMPLES.MR_BRAIN, { format: 'short' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Short format produces different output than standard
            expect(result.value.text.length).toBeGreaterThan(0);
        }
    });

    it('returns error for non-existent file', async () => {
        const result = await dcmdump('/nonexistent/path/file.dcm');
        expect(result.ok).toBe(false);
    });

    it('dumps metadata from another DICOM file', async () => {
        const result = await dcmdump(SAMPLES.OTHER_0002);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text.length).toBeGreaterThan(100);
        }
    });
});
