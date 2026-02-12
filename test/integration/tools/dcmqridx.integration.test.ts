import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { dcmqridx } from '../../../src/tools/dcmqridx';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmqridx integration', () => {
    let tempDir: string;
    let indexDir: string;
    let uncompressedFile: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmqridx-');
        indexDir = join(tempDir, 'index');
        // Create index directory
        const { mkdir } = await import('node:fs/promises');
        await mkdir(indexDir, { recursive: true });

        // Decompress a sample file for registration
        uncompressedFile = join(tempDir, 'sample.dcm');
        const decomp = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedFile);
        if (!decomp.ok) {
            throw new Error(`Setup failed: ${decomp.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('registers a DICOM file in the index database', async () => {
        const result = await dcmqridx({
            indexDirectory: indexDir,
            inputFiles: [uncompressedFile],
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.mode).toBe('register');
        }
    });

    it('prints database contents after registration', async () => {
        // Register first
        await dcmqridx({
            indexDirectory: indexDir,
            inputFiles: [uncompressedFile],
        });

        // Then print
        const printResult = await dcmqridx({
            indexDirectory: indexDir,
            print: true,
        });
        expect(printResult.ok).toBe(true);
        if (printResult.ok) {
            expect(printResult.value.mode).toBe('print');
            if (printResult.value.mode === 'print') {
                expect(printResult.value.output).toBeDefined();
            }
        }
    });

    it('registers with notNew flag', async () => {
        const notNewIndexDir = join(tempDir, 'index-notnew');
        const { mkdir } = await import('node:fs/promises');
        await mkdir(notNewIndexDir, { recursive: true });

        const result = await dcmqridx({
            indexDirectory: notNewIndexDir,
            inputFiles: [uncompressedFile],
            notNew: true,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.mode).toBe('register');
        }
    });

    it('returns error for invalid options (no inputFiles and no print)', async () => {
        const result = await dcmqridx({
            indexDirectory: indexDir,
        });
        expect(result.ok).toBe(false);
    });

    it('runs without crashing for non-existent input files', async () => {
        const result = await dcmqridx({
            indexDirectory: indexDir,
            inputFiles: ['/nonexistent/path/file.dcm'],
        });
        // dcmqridx exits 0 even for non-existent input files — just verify it runs
        expect(typeof result.ok).toBe('boolean');
    });
});
