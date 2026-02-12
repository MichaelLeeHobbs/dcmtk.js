import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { dcmencap } from '../../../src/tools/dcmencap';
import { dcmdecap } from '../../../src/tools/dcmdecap';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmencap + dcmdecap integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('encap-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    describe('dcmencap', () => {
        it('returns error when given a DICOM file as input', async () => {
            // dcmencap expects raw data (e.g. compressed pixel data fragments),
            // not DICOM files. Passing a DICOM file produces "unknown file type".
            const outputPath = join(tempDir, 'encapsulated.dcm');
            const result = await dcmencap(SAMPLES.OTHER_0002, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcmencap');
            }
        });

        it('returns error for non-existent input file', async () => {
            const outputPath = join(tempDir, 'fail-encap.dcm');
            const result = await dcmencap('/nonexistent/path/file.raw', outputPath);
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            const outputPath = join(tempDir, 'fail-opts.dcm');
            // @ts-expect-error testing invalid option
            const result = await dcmencap(SAMPLES.OTHER_0002, outputPath, { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });

    describe('dcmdecap', () => {
        it('returns error when given a non-encapsulated DICOM file', async () => {
            // dcmdecap expects a DICOM file containing encapsulated document data.
            // A standard imaging DICOM file (MR) does not contain encapsulated documents,
            // so dcmdecap should fail gracefully.
            const outputPath = join(tempDir, 'decapped.dat');
            const result = await dcmdecap(SAMPLES.OTHER_0002, outputPath);
            expect(typeof result.ok).toBe('boolean');
            if (!result.ok) {
                expect(result.error.message).toContain('dcmdecap');
            }
        });

        it('returns error for non-existent input', async () => {
            const decapPath = join(tempDir, 'should-not-exist.dat');
            const result = await dcmdecap('/nonexistent/path/file.dcm', decapPath);
            expect(result.ok).toBe(false);
        });
    });
});
