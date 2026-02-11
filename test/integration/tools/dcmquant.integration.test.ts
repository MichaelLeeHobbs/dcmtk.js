import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dcmquant } from '../../../src/tools/dcmquant';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmquant integration', () => {
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmquant-');
        // dcmquant requires uncompressed pixel data — decompress first
        uncompressedPath = join(tempDir, 'uncompressed-source.dcm');
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: could not decompress test file: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('quantizes a DICOM image with default settings', async () => {
        const outputPath = join(tempDir, 'quantized.dcm');
        const result = await dcmquant(uncompressedPath, outputPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('quantized output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'valid-quantized.dcm');
        await dcmquant(uncompressedPath, outputPath);

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('quantizes with specific color count', async () => {
        const outputPath = join(tempDir, 'colors-quantized.dcm');
        const result = await dcmquant(uncompressedPath, outputPath, { colors: 128 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('returns error for non-existent input file', async () => {
        const result = await dcmquant('/nonexistent/file.dcm', join(tempDir, 'out.dcm'));
        expect(result.ok).toBe(false);
    });
});
