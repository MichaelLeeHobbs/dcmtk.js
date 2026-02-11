import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dcmmkdir } from '../../../src/tools/dcmmkdir';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir, copyDicomToTemp } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmmkdir integration', () => {
    let tempDir: string;
    let uncompressedFile1: string;
    let uncompressedFile2: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmmkdir-');
        // dcmmkdir needs uncompressed DICOM files — decompress samples first
        uncompressedFile1 = join(tempDir, 'file1.dcm');
        uncompressedFile2 = join(tempDir, 'file2.dcm');

        const decomp1 = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedFile1);
        if (!decomp1.ok) {
            throw new Error(`Setup failed: ${decomp1.error.message}`);
        }
        const decomp2 = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedFile2);
        if (!decomp2.ok) {
            await copyDicomToTemp(uncompressedFile1, tempDir, 'file2.dcm');
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('creates a DICOMDIR from input files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_MK1');
        const result = await dcmmkdir({
            inputFiles: [uncompressedFile1],
            outputFile,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('creates DICOMDIR from multiple files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_MK_MULTI');
        const result = await dcmmkdir({
            inputFiles: [uncompressedFile1, uncompressedFile2],
            outputFile,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('supports filesetId option', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_MK_FS');
        const result = await dcmmkdir({
            inputFiles: [uncompressedFile1],
            outputFile,
            filesetId: 'MKDIRSET',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('supports append mode', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_MK_APPEND');
        // First create a DICOMDIR
        const firstResult = await dcmmkdir({
            inputFiles: [uncompressedFile1],
            outputFile,
        });
        expect(firstResult.ok).toBe(true);

        // Then append to it
        const appendResult = await dcmmkdir({
            inputFiles: [uncompressedFile2],
            outputFile,
            append: true,
        });
        expect(appendResult.ok).toBe(true);
        if (appendResult.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('returns error for invalid options', async () => {
        const result = await dcmmkdir({
            inputFiles: [],
        });
        expect(result.ok).toBe(false);
    });

    it('returns error for non-existent input files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_MK_NOEXIST');
        const result = await dcmmkdir({
            inputFiles: ['/nonexistent/path/file.dcm'],
            outputFile,
        });
        expect(result.ok).toBe(false);
    });
});
