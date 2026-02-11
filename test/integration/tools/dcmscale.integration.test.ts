import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dcmscale } from '../../../src/tools/dcmscale';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmscale integration', () => {
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmscale-');
        // dcmscale requires uncompressed pixel data — decompress first
        uncompressedPath = join(tempDir, 'uncompressed-source.dcm');
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: could not decompress test file: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('scales a DICOM image with xFactor and yFactor', async () => {
        const outputPath = join(tempDir, 'scaled.dcm');
        const result = await dcmscale(uncompressedPath, outputPath, { xFactor: 0.5, yFactor: 0.5 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('scaled output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'valid-scaled.dcm');
        await dcmscale(uncompressedPath, outputPath, { xFactor: 0.5, yFactor: 0.5 });

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('preserves patient metadata after scaling', async () => {
        const outputPath = join(tempDir, 'meta-scaled.dcm');
        await dcmscale(uncompressedPath, outputPath, { xFactor: 0.5, yFactor: 0.5 });

        const origJson = await dcm2json(uncompressedPath);
        const scaledJson = await dcm2json(outputPath);

        expect(origJson.ok).toBe(true);
        expect(scaledJson.ok).toBe(true);

        if (origJson.ok && scaledJson.ok) {
            const origName = origJson.value.data['00100010'];
            const scaledName = scaledJson.value.data['00100010'];
            expect(scaledName).toBeDefined();
            if (origName !== undefined && scaledName !== undefined) {
                expect(scaledName.Value).toEqual(origName.Value);
            }
        }
    });

    it('scales with explicit target size', async () => {
        const outputPath = join(tempDir, 'size-scaled.dcm');
        const result = await dcmscale(uncompressedPath, outputPath, { xSize: 64, ySize: 64 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('returns error for non-existent input file', async () => {
        const result = await dcmscale('/nonexistent/file.dcm', join(tempDir, 'out.dcm'));
        expect(result.ok).toBe(false);
    });
});
