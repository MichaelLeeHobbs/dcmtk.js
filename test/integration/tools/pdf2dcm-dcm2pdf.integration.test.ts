import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pdf2dcm } from '../../../src/tools/pdf2dcm';
import { dcm2pdf } from '../../../src/tools/dcm2pdf';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('pdf2dcm + dcm2pdf integration', () => {
    let tempDir: string;
    let pdfPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('pdf-');

        // Create a minimal valid PDF
        const pdfContent = [
            '%PDF-1.0',
            '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
            '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
            '3 0 obj<</Type/Page/MediaBox[0 0 1 1]/Parent 2 0 R>>endobj',
            'xref',
            '0 4',
            '0000000000 65535 f ',
            '0000000009 00000 n ',
            '0000000058 00000 n ',
            '0000000115 00000 n ',
            'trailer<</Size 4/Root 1 0 R>>',
            'startxref',
            '190',
            '%%EOF',
        ].join('\n');

        pdfPath = join(tempDir, 'test.pdf');
        await writeFile(pdfPath, pdfContent);
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    describe('pdf2dcm', () => {
        it('encapsulates a PDF into a DICOM file', async () => {
            const outputPath = join(tempDir, 'encapsulated.dcm');
            const result = await pdf2dcm(pdfPath, outputPath);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputPath).toBe(outputPath);
                expect(existsSync(outputPath)).toBe(true);
            }
        });

        it('output is valid DICOM', async () => {
            const outputPath = join(tempDir, 'valid-pdf.dcm');
            await pdf2dcm(pdfPath, outputPath);

            const testResult = await dcmftest(outputPath);
            expect(testResult.ok).toBe(true);
            if (testResult.ok) {
                expect(testResult.value.isDicom).toBe(true);
            }
        });

        it('returns error for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail.dcm');
            const result = await pdf2dcm('/nonexistent/path/file.pdf', outputPath);
            expect(result.ok).toBe(false);
        });
    });

    describe('dcm2pdf', () => {
        it('extracts PDF from a DICOM-encapsulated PDF', async () => {
            const encapPath = join(tempDir, 'for-extract.dcm');
            const encapResult = await pdf2dcm(pdfPath, encapPath);
            if (!encapResult.ok) {
                expect.fail('Setup: pdf2dcm failed');
            }

            const extractedPath = join(tempDir, 'extracted.pdf');
            const result = await dcm2pdf(encapPath, extractedPath);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputPath).toBe(extractedPath);
                expect(existsSync(extractedPath)).toBe(true);

                // Verify extracted content starts with %PDF
                const content = await readFile(extractedPath, 'utf8');
                expect(content).toContain('%PDF');
            }
        });

        it('returns error for non-PDF DICOM file', async () => {
            const outputPath = join(tempDir, 'fail-extract.pdf');
            const result = await dcm2pdf(SAMPLES.MR_BRAIN, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcm2pdf');
            }
        });

        it('returns error for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail2.pdf');
            const result = await dcm2pdf('/nonexistent/path/file.dcm', outputPath);
            expect(result.ok).toBe(false);
        });
    });
});
