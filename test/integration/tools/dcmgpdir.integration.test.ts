import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dcmgpdir } from '../../../src/tools/dcmgpdir';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir, copyDicomToTemp } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmgpdir integration', () => {
    let tempDir: string;
    let uncompressedFile1: string;
    let uncompressedFile2: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmgpdir-');
        // dcmgpdir needs uncompressed DICOM files — decompress samples first
        uncompressedFile1 = join(tempDir, 'file1.dcm');
        uncompressedFile2 = join(tempDir, 'file2.dcm');

        const decomp1 = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedFile1);
        if (!decomp1.ok) {
            throw new Error(`Setup failed: ${decomp1.error.message}`);
        }
        // Copy the uncompressed file as a second file for multi-file tests
        await copyDicomToTemp(uncompressedFile1, tempDir, 'file2.dcm');
        // Overwrite with actual decompress to have distinct content
        const decomp2 = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedFile2);
        if (!decomp2.ok) {
            // Fallback: just use the copy
            await copyDicomToTemp(uncompressedFile1, tempDir, 'file2.dcm');
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('creates a DICOMDIR from input files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_1');
        const result = await dcmgpdir({
            inputFiles: [uncompressedFile1],
            outputFile,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('creates DICOMDIR from multiple files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_MULTI');
        const result = await dcmgpdir({
            inputFiles: [uncompressedFile1, uncompressedFile2],
            outputFile,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('supports filesetId option', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_FS');
        const result = await dcmgpdir({
            inputFiles: [uncompressedFile1],
            outputFile,
            filesetId: 'TESTSET',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('returns error for invalid options', async () => {
        const result = await dcmgpdir({
            inputFiles: [],
        });
        expect(result.ok).toBe(false);
    });

    it('returns error for non-existent input files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR_NOEXIST');
        const result = await dcmgpdir({
            inputFiles: ['/nonexistent/path/file.dcm'],
            outputFile,
        });
        expect(result.ok).toBe(false);
    });
});
