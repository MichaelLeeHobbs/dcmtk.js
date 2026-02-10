import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { dcmconv } from '../../../src/tools/dcmconv';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';
import { join } from 'node:path';

describe.skipIf(!dcmtkAvailable)('dcmconv integration', () => {
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmconv-');
        // dcmconv cannot convert compressed pixel data — decompress first
        uncompressedPath = join(tempDir, 'uncompressed.dcm');
        // Use OTHER_0002 (JPEG Baseline) — dcmdjpeg cannot handle JPEG 2000
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: could not decompress test file: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('converts to Explicit VR Little Endian', async () => {
        const outputPath = join(tempDir, 'explicit-le.dcm');
        const result = await dcmconv(uncompressedPath, outputPath, { transferSyntax: '+te' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'verify-valid.dcm');
        await dcmconv(uncompressedPath, outputPath, { transferSyntax: '+te' });

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('converts to Implicit VR Little Endian', async () => {
        const outputPath = join(tempDir, 'implicit-le.dcm');
        const result = await dcmconv(uncompressedPath, outputPath, { transferSyntax: '+ti' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('preserves metadata after conversion', async () => {
        const outputPath = join(tempDir, 'preserve-meta.dcm');
        await dcmconv(uncompressedPath, outputPath, { transferSyntax: '+te' });

        const origJson = await dcm2json(uncompressedPath);
        const convJson = await dcm2json(outputPath);

        expect(origJson.ok).toBe(true);
        expect(convJson.ok).toBe(true);

        if (origJson.ok && convJson.ok) {
            const origName = origJson.value.data['00100010'];
            const convName = convJson.value.data['00100010'];
            expect(convName).toBeDefined();
            if (origName !== undefined && convName !== undefined) {
                expect(convName.Value).toEqual(origName.Value);
            }
        }
    });
});
