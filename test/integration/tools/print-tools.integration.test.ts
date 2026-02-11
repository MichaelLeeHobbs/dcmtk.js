import { describe, it, expect } from 'vitest';
import { dcmprscu } from '../../../src/tools/dcmprscu';
import { dcmpsprt } from '../../../src/tools/dcmpsprt';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('print tools integration', () => {
    describe('dcmprscu', () => {
        it('returns error when no print server is available', async () => {
            const result = await dcmprscu({
                host: '127.0.0.1',
                port: 59999,
                timeoutMs: 5000,
            });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcmprscu');
            }
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing missing required field
            const result = await dcmprscu({ host: '127.0.0.1' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });

    describe('dcmpsprt', () => {
        it('returns error for a non-print-job DICOM file', async () => {
            const result = await dcmpsprt(SAMPLES.MR_BRAIN);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcmpsprt');
            }
        });

        it('returns error for non-existent file', async () => {
            const result = await dcmpsprt('/nonexistent/path/printjob.dcm');
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await dcmpsprt(SAMPLES.MR_BRAIN, { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });
});
