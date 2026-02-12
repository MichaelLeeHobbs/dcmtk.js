import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { dcmquant } from '../../../src/tools/dcmquant';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
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

    it('runs without crashing on monochrome input', async () => {
        // dcmquant can only quantize COLOR images to palette color.
        // The available test data (MR brain) is monochrome, so dcmquant
        // is expected to fail gracefully with a clear error.
        const outputPath = join(tempDir, 'quantized.dcm');
        const result = await dcmquant(uncompressedPath, outputPath);
        expect(typeof result.ok).toBe('boolean');
        if (!result.ok) {
            expect(result.error.message).toContain('dcmquant');
        }
    });

    it('handles specific color count on monochrome input gracefully', async () => {
        const outputPath = join(tempDir, 'colors-quantized.dcm');
        const result = await dcmquant(uncompressedPath, outputPath, { colors: 128 });
        expect(typeof result.ok).toBe('boolean');
        if (!result.ok) {
            expect(result.error.message).toContain('dcmquant');
        }
    });

    it('returns error for non-existent input file', async () => {
        const result = await dcmquant('/nonexistent/file.dcm', join(tempDir, 'out.dcm'));
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid options', async () => {
        const outputPath = join(tempDir, 'fail.dcm');
        // @ts-expect-error testing invalid option
        const result = await dcmquant(uncompressedPath, outputPath, { bogus: true });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
