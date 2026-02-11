import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmj2pnm } from '../../../src/tools/dcmj2pnm';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmj2pnm integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmj2pnm-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('converts DICOM to PNM format', async () => {
        const outputPath = join(tempDir, 'output.pnm');
        const result = await dcmj2pnm(SAMPLES.MR_BRAIN, outputPath, { outputFormat: 'pnm' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('output file is non-empty', async () => {
        const outputPath = join(tempDir, 'nonempty.pnm');
        await dcmj2pnm(SAMPLES.MR_BRAIN, outputPath, { outputFormat: 'pnm' });

        const stats = await stat(outputPath);
        expect(stats.size).toBeGreaterThan(0);
    });

    it('converts DICOM to BMP format', async () => {
        const outputPath = join(tempDir, 'output.bmp');
        const result = await dcmj2pnm(SAMPLES.MR_BRAIN, outputPath, { outputFormat: 'bmp' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
            const stats = await stat(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        }
    });

    it('converts with specific frame number', async () => {
        const outputPath = join(tempDir, 'frame0.pnm');
        const result = await dcmj2pnm(SAMPLES.MR_BRAIN, outputPath, { outputFormat: 'pnm', frame: 0 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('converts without explicit format (default PNM)', async () => {
        const outputPath = join(tempDir, 'default-fmt.pnm');
        const result = await dcmj2pnm(SAMPLES.MR_BRAIN, outputPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('returns error for non-existent input file', async () => {
        const result = await dcmj2pnm('/nonexistent/file.dcm', join(tempDir, 'out.pnm'));
        expect(result.ok).toBe(false);
    });
});
