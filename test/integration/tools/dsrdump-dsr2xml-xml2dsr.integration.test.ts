import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { dsrdump } from '../../../src/tools/dsrdump';
import { dsr2xml } from '../../../src/tools/dsr2xml';
import { xml2dsr } from '../../../src/tools/xml2dsr';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dsrdump + dsr2xml + xml2dsr integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('sr-tools-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    describe('dsrdump', () => {
        it('returns error for a non-SR DICOM file', async () => {
            const result = await dsrdump(SAMPLES.MR_BRAIN);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dsrdump');
            }
        });

        it('returns error for non-existent file', async () => {
            const result = await dsrdump('/nonexistent/path/file.dcm');
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await dsrdump(SAMPLES.MR_BRAIN, { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });

    describe('dsr2xml', () => {
        it('runs without crashing for a non-SR DICOM file', async () => {
            const result = await dsr2xml(SAMPLES.MR_BRAIN);
            // dsr2xml exits 0 even for non-SR DICOM files — just verify it runs
            expect(typeof result.ok).toBe('boolean');
        });

        it('returns error for non-existent file', async () => {
            const result = await dsr2xml('/nonexistent/path/file.dcm');
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await dsr2xml(SAMPLES.MR_BRAIN, { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });

    describe('xml2dsr', () => {
        it('returns error for invalid XML input', async () => {
            const { writeFile } = await import('node:fs/promises');
            const invalidXmlPath = join(tempDir, 'invalid.xml');
            await writeFile(invalidXmlPath, '<not-a-valid-sr-document/>');
            const outputPath = join(tempDir, 'output-sr.dcm');

            const result = await xml2dsr(invalidXmlPath, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('xml2dsr');
            }
        });

        it('returns error for non-existent input file', async () => {
            const outputPath = join(tempDir, 'output-sr-2.dcm');
            const result = await xml2dsr('/nonexistent/path/report.xml', outputPath);
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await xml2dsr('/path/to/in.xml', '/path/to/out.dcm', { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });
});
