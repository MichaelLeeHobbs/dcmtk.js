import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cda2dcm } from '../../../src/tools/cda2dcm';
import { dcm2cda } from '../../../src/tools/dcm2cda';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('cda2dcm + dcm2cda integration', () => {
    let tempDir: string;
    let cdaPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('cda-');

        // Create a minimal CDA XML document
        const cdaContent = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<ClinicalDocument xmlns="urn:hl7-org:v3">',
            '  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>',
            '  <id root="1.2.3.4.5"/>',
            '  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1"/>',
            '  <effectiveTime value="20240101"/>',
            '  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>',
            '</ClinicalDocument>',
        ].join('\n');

        cdaPath = join(tempDir, 'test.xml');
        await writeFile(cdaPath, cdaContent);
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    describe('cda2dcm', () => {
        it('encapsulates a CDA document into a DICOM file', async () => {
            const outputPath = join(tempDir, 'encapsulated-cda.dcm');
            const result = await cda2dcm(cdaPath, outputPath);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputPath).toBe(outputPath);
                expect(existsSync(outputPath)).toBe(true);
            }
        });

        it('output is valid DICOM', async () => {
            const outputPath = join(tempDir, 'valid-cda.dcm');
            await cda2dcm(cdaPath, outputPath);

            const testResult = await dcmftest(outputPath);
            expect(testResult.ok).toBe(true);
            if (testResult.ok) {
                expect(testResult.value.isDicom).toBe(true);
            }
        });

        it('returns error for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail.dcm');
            const result = await cda2dcm('/nonexistent/path/doc.xml', outputPath);
            expect(result.ok).toBe(false);
        });
    });

    describe('dcm2cda', () => {
        it('extracts CDA from a DICOM-encapsulated CDA', async () => {
            const encapPath = join(tempDir, 'for-cda-extract.dcm');
            const encapResult = await cda2dcm(cdaPath, encapPath);
            if (!encapResult.ok) {
                expect.fail('Setup: cda2dcm failed');
            }

            const extractedPath = join(tempDir, 'extracted.xml');
            const result = await dcm2cda(encapPath, extractedPath);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputPath).toBe(extractedPath);
                expect(existsSync(extractedPath)).toBe(true);
            }
        });

        it('returns error for non-CDA DICOM file', async () => {
            const outputPath = join(tempDir, 'fail-cda-extract.xml');
            const result = await dcm2cda(SAMPLES.MR_BRAIN, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcm2cda');
            }
        });

        it('returns error for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail2.xml');
            const result = await dcm2cda('/nonexistent/path/file.dcm', outputPath);
            expect(result.ok).toBe(false);
        });
    });
});
