import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DicomFile } from '../../../src/dicom/DicomFile';
import { ChangeSet } from '../../../src/dicom/ChangeSet';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir, copyDicomToTemp } from '../helpers';
import type { DicomTagPath } from '../../../src/brands';

describe.skipIf(!dcmtkAvailable)('DicomFile integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dicomfile-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('opens a real DICOM file', async () => {
        const result = await DicomFile.open(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.dataset.patientName.length).toBeGreaterThan(0);
            expect(result.value.dataset.modality).toBe('MR');
        }
    });

    it('opens another DICOM file format', async () => {
        const result = await DicomFile.open(SAMPLES.OTHER_0002);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.dataset.sopInstanceUID.length).toBeGreaterThan(0);
        }
    });

    it('writeAs creates a copy without changes', async () => {
        const fileResult = await DicomFile.open(SAMPLES.MR_BRAIN);
        expect(fileResult.ok).toBe(true);
        if (!fileResult.ok) return;

        const outputPath = join(tempDir, 'copy.dcm');
        const writeResult = await fileResult.value.writeAs(outputPath);
        expect(writeResult.ok).toBe(true);

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('writeAs with changes modifies the copy', async () => {
        const fileResult = await DicomFile.open(SAMPLES.MR_BRAIN);
        if (!fileResult.ok) return;

        const changes = ChangeSet.empty().setTag('(0010,0010)' as DicomTagPath, 'WriteAsTest');
        const modified = fileResult.value.withChanges(changes);

        const outputPath = join(tempDir, 'modified-copy.dcm');
        const writeResult = await modified.writeAs(outputPath);
        expect(writeResult.ok).toBe(true);

        // Verify the modification in the copy
        const jsonResult = await dcm2json(outputPath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const pn = jsonResult.value.data['00100010'];
            expect(pn).toBeDefined();
            if (pn !== undefined) {
                const values = pn.Value;
                expect(values).toBeDefined();
                if (values !== undefined) {
                    const first = values[0] as Record<string, unknown>;
                    expect(first['Alphabetic']).toBe('WriteAsTest');
                }
            }
        }

        // Original should be unchanged
        const origJson = await dcm2json(SAMPLES.MR_BRAIN);
        expect(origJson.ok).toBe(true);
        if (origJson.ok) {
            const origPn = origJson.value.data['00100010'];
            expect(origPn).toBeDefined();
            if (origPn !== undefined) {
                const values = origPn.Value;
                if (values !== undefined) {
                    const first = values[0] as Record<string, unknown>;
                    expect(first['Alphabetic']).not.toBe('WriteAsTest');
                }
            }
        }
    });

    it('applyChanges modifies in-place', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'in-place.dcm');

        const fileResult = await DicomFile.open(filePath);
        if (!fileResult.ok) return;

        const changes = ChangeSet.empty().setTag('(0010,0010)' as DicomTagPath, 'InPlaceTest');
        const modified = fileResult.value.withChanges(changes);

        const applyResult = await modified.applyChanges();
        expect(applyResult.ok).toBe(true);

        // Verify
        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const pn = jsonResult.value.data['00100010'];
            expect(pn).toBeDefined();
            if (pn !== undefined) {
                const values = pn.Value;
                if (values !== undefined) {
                    const first = values[0] as Record<string, unknown>;
                    expect(first['Alphabetic']).toBe('InPlaceTest');
                }
            }
        }
    });

    it('fileSize matches fs.stat', async () => {
        const fileResult = await DicomFile.open(SAMPLES.MR_BRAIN);
        if (!fileResult.ok) return;

        const sizeResult = await fileResult.value.fileSize();
        expect(sizeResult.ok).toBe(true);

        const stats = await stat(SAMPLES.MR_BRAIN);
        if (sizeResult.ok) {
            expect(sizeResult.value).toBe(stats.size);
        }
    });

    it('erases a tag via ChangeSet', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'erase-via-cs.dcm');

        const fileResult = await DicomFile.open(filePath);
        if (!fileResult.ok) return;

        const changes = ChangeSet.empty().eraseTag('(0010,0010)' as DicomTagPath);
        const modified = fileResult.value.withChanges(changes);

        const applyResult = await modified.applyChanges();
        expect(applyResult.ok).toBe(true);

        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            expect(jsonResult.value.data['00100010']).toBeUndefined();
        }
    });
});
