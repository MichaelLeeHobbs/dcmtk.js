import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dcmcrle } from '../../../src/tools/dcmcrle';
import { dcmdrle } from '../../../src/tools/dcmdrle';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmcrle + dcmdrle integration', () => {
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('rle-');
        // dcmcrle needs uncompressed input — decompress OTHER_0002 first
        uncompressedPath = join(tempDir, 'uncompressed-source.dcm');
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('compresses a DICOM file with RLE', async () => {
        const outputPath = join(tempDir, 'rle-compressed.dcm');
        const result = await dcmcrle(uncompressedPath, outputPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('RLE compressed output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'rle-valid.dcm');
        await dcmcrle(uncompressedPath, outputPath);

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('decompresses an RLE-compressed file', async () => {
        const compressedPath = join(tempDir, 'rle-to-decomp.dcm');
        const decompressedPath = join(tempDir, 'rle-decomped.dcm');

        await dcmcrle(uncompressedPath, compressedPath);
        const result = await dcmdrle(compressedPath, decompressedPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(decompressedPath)).toBe(true);
        }
    });

    it('RLE round-trip preserves patient metadata', async () => {
        const compressedPath = join(tempDir, 'rle-rt-comp.dcm');
        const decompressedPath = join(tempDir, 'rle-rt-decomp.dcm');

        await dcmcrle(uncompressedPath, compressedPath);
        await dcmdrle(compressedPath, decompressedPath);

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
