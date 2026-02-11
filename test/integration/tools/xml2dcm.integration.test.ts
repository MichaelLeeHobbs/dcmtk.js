import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { xml2dcm } from '../../../src/tools/xml2dcm';
import { dcm2xml } from '../../../src/tools/dcm2xml';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('xml2dcm integration', () => {
    let tempDir: string;
    let xmlPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('xml2dcm-');
        // Convert a DICOM file to XML for use as xml2dcm input.
        // Use writeBinaryData + encodeBinaryBase64 so pixel data is included inline.
        const xmlResult = await dcm2xml(SAMPLES.MR_BRAIN, {
            writeBinaryData: true,
            encodeBinaryBase64: true,
        });
        if (!xmlResult.ok) {
            throw new Error(`Setup failed: could not convert DICOM to XML: ${xmlResult.error.message}`);
        }
        xmlPath = join(tempDir, 'source.xml');
        await writeFile(xmlPath, xmlResult.value.xml, 'utf-8');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('converts XML to DICOM', async () => {
        const outputPath = join(tempDir, 'output.dcm');
        const result = await xml2dcm(xmlPath, outputPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'valid-output.dcm');
        await xml2dcm(xmlPath, outputPath);

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('preserves key tags in round-trip', async () => {
        const outputPath = join(tempDir, 'roundtrip.dcm');
        await xml2dcm(xmlPath, outputPath);

        const origJson = await dcm2json(SAMPLES.MR_BRAIN);
        const rtJson = await dcm2json(outputPath);

        expect(origJson.ok).toBe(true);
        expect(rtJson.ok).toBe(true);

        if (origJson.ok && rtJson.ok) {
            // PatientName should be preserved
            const origName = origJson.value.data['00100010'];
            const rtName = rtJson.value.data['00100010'];
            expect(rtName).toBeDefined();
            if (origName !== undefined && rtName !== undefined) {
                expect(rtName.Value).toEqual(origName.Value);
            }
        }
    });

    it('converts with generateNewUIDs option', async () => {
        const outputPath = join(tempDir, 'new-uids.dcm');
        const result = await xml2dcm(xmlPath, outputPath, { generateNewUIDs: true });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('returns error for non-existent input file', async () => {
        const result = await xml2dcm('/nonexistent/file.xml', join(tempDir, 'out.dcm'));
        expect(result.ok).toBe(false);
    });
});
