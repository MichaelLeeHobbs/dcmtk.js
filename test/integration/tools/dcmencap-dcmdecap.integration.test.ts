import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmencap } from '../../../src/tools/dcmencap';
import { dcmdecap } from '../../../src/tools/dcmdecap';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmencap + dcmdecap integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('encap-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('encapsulates a document into a DICOM file', async () => {
        const inputPath = SAMPLES.OTHER_0002;
        const outputPath = join(tempDir, 'encapsulated.dcm');
        const result = await dcmencap(inputPath, outputPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('encapsulated output is valid DICOM', async () => {
        const inputPath = SAMPLES.OTHER_0002;
        const outputPath = join(tempDir, 'encap-valid.dcm');
        await dcmencap(inputPath, outputPath);

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('encapsulates with document title option', async () => {
        const inputPath = SAMPLES.OTHER_0002;
        const outputPath = join(tempDir, 'encap-titled.dcm');
        const result = await dcmencap(inputPath, outputPath, { documentTitle: 'Test Document' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('decapsulates a DICOM file to extract document', async () => {
        const inputPath = SAMPLES.OTHER_0002;
        const encapPath = join(tempDir, 'to-decap.dcm');
        const decapPath = join(tempDir, 'decapped.dat');

        // First encapsulate
        const encapResult = await dcmencap(inputPath, encapPath);
        expect(encapResult.ok).toBe(true);

        // Then decapsulate
        const decapResult = await dcmdecap(encapPath, decapPath);
        expect(decapResult.ok).toBe(true);
        if (decapResult.ok) {
            expect(decapResult.value.outputPath).toBe(decapPath);
            expect(existsSync(decapPath)).toBe(true);
        }
    });

    it('decapsulated output has non-zero size', async () => {
        const inputPath = SAMPLES.OTHER_0002;
        const encapPath = join(tempDir, 'roundtrip-encap.dcm');
        const decapPath = join(tempDir, 'roundtrip-decap.dat');

        await dcmencap(inputPath, encapPath);
        await dcmdecap(encapPath, decapPath);

        const fileStat = await stat(decapPath);
        expect(fileStat.size).toBeGreaterThan(0);
    });

    it('dcmdecap returns error for non-existent input', async () => {
        const decapPath = join(tempDir, 'should-not-exist.dat');
        const result = await dcmdecap('/nonexistent/path/file.dcm', decapPath);
        expect(result.ok).toBe(false);
    });
});
