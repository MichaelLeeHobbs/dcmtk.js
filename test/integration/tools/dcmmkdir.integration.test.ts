import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmmkdir } from '../../../src/tools/dcmmkdir';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmmkdir integration', () => {
    let tempDir: string;
    let imagesDir: string;
    let file1: string;
    let file2: string;

    beforeAll(async () => {
        // Create a DICOM media-compliant directory structure:
        // tempDir/           <-- media root, DICOMDIR goes here
        //   IMAGES/          <-- 8.3 compliant subdirectory
        //     IM000001       <-- 8.3 compliant filename (no extension)
        //     IM000002
        tempDir = await createTempDir('dcmmkdir-');
        imagesDir = join(tempDir, 'IMAGES');
        await mkdir(imagesDir, { recursive: true });

        file1 = join(imagesDir, 'IM000001');
        file2 = join(imagesDir, 'IM000002');

        const decomp1 = await dcmdjpeg(SAMPLES.OTHER_0002, file1);
        if (!decomp1.ok) {
            throw new Error(`Setup failed: ${decomp1.error.message}`);
        }
        const decomp2 = await dcmdjpeg(SAMPLES.OTHER_0002, file2);
        if (!decomp2.ok) {
            throw new Error(`Setup failed: ${decomp2.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('creates a DICOMDIR from input files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR');
        const result = await dcmmkdir({
            inputFiles: ['IMAGES/IM000001'],
            outputFile,
            inputDirectory: tempDir,
            mapFilenames: true,
            inventAttributes: true,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('creates DICOMDIR from multiple files', async () => {
        const outputFile = join(tempDir, 'DICOMDIR2');
        const result = await dcmmkdir({
            inputFiles: ['IMAGES/IM000001', 'IMAGES/IM000002'],
            outputFile,
            inputDirectory: tempDir,
            mapFilenames: true,
            inventAttributes: true,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('supports filesetId option', async () => {
        const outputFile = join(tempDir, 'DICOMDIR3');
        const result = await dcmmkdir({
            inputFiles: ['IMAGES/IM000001'],
            outputFile,
            inputDirectory: tempDir,
            mapFilenames: true,
            inventAttributes: true,
            filesetId: 'MKDIRSET',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputFile)).toBe(true);
        }
    });

    it('supports append mode', async () => {
        const outputFile = join(tempDir, 'DICOMDIR4');
        // First create a DICOMDIR
        const firstResult = await dcmmkdir({
            inputFiles: ['IMAGES/IM000001'],
            outputFile,
            inputDirectory: tempDir,
            mapFilenames: true,
            inventAttributes: true,
        });
        expect(firstResult.ok).toBe(true);

        // Then append to it
        const appendResult = await dcmmkdir({
            inputFiles: ['IMAGES/IM000002'],
            outputFile,
            inputDirectory: tempDir,
            mapFilenames: true,
            inventAttributes: true,
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
        const outputFile = join(tempDir, 'DICOMDIR5');
        const result = await dcmmkdir({
            inputFiles: ['/nonexistent/path/file.dcm'],
            outputFile,
        });
        expect(result.ok).toBe(false);
    });
});
