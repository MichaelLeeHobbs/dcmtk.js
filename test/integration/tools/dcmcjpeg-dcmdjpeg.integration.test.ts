import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dcmcjpeg } from '../../../src/tools/dcmcjpeg';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmcjpeg + dcmdjpeg integration', () => {
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('jpeg-');
        // Decompress OTHER_0002 (JPEG Baseline) to get an uncompressed input for dcmcjpeg
        uncompressedPath = join(tempDir, 'uncompressed-source.dcm');
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('compresses a DICOM file with lossless JPEG', async () => {
        const outputPath = join(tempDir, 'compressed.dcm');
        const result = await dcmcjpeg(uncompressedPath, outputPath, { lossless: true });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('compressed output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'valid-compressed.dcm');
        await dcmcjpeg(uncompressedPath, outputPath, { lossless: true });

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('decompresses a JPEG-compressed file', async () => {
        const compressedPath = join(tempDir, 'to-decompress.dcm');
        const decompressedPath = join(tempDir, 'decompressed.dcm');

        await dcmcjpeg(uncompressedPath, compressedPath, { lossless: true });
        const result = await dcmdjpeg(compressedPath, decompressedPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(decompressedPath)).toBe(true);
        }
    });

    it('decompressed output is valid DICOM', async () => {
        const compressedPath = join(tempDir, 'rt-compress.dcm');
        const decompressedPath = join(tempDir, 'rt-decompress.dcm');

        await dcmcjpeg(uncompressedPath, compressedPath, { lossless: true });
        await dcmdjpeg(compressedPath, decompressedPath);

        const testResult = await dcmftest(decompressedPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('round-trip preserves patient metadata', async () => {
        const compressedPath = join(tempDir, 'meta-compress.dcm');
        const decompressedPath = join(tempDir, 'meta-decompress.dcm');

        await dcmcjpeg(uncompressedPath, compressedPath, { lossless: true });
        await dcmdjpeg(compressedPath, decompressedPath);

        const origJson = await dcm2json(uncompressedPath);
        const rtJson = await dcm2json(decompressedPath);

        expect(origJson.ok).toBe(true);
        expect(rtJson.ok).toBe(true);

        if (origJson.ok && rtJson.ok) {
            const origName = origJson.value.data['00100010'];
            const rtName = rtJson.value.data['00100010'];
            expect(rtName).toBeDefined();
            if (origName !== undefined && rtName !== undefined) {
                expect(rtName.Value).toEqual(origName.Value);
            }
        }
    });
});
