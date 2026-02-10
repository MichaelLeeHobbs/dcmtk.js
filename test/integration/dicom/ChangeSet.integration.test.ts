import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChangeSet } from '../../../src/dicom/ChangeSet';
import { DicomFile } from '../../../src/dicom/DicomFile';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir, copyDicomToTemp } from '../helpers';
import type { DicomTagPath } from '../../../src/brands';

describe.skipIf(!dcmtkAvailable)('ChangeSet integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('changeset-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('full workflow: build changeset, apply, verify', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'cs-workflow.dcm');

        const fileResult = await DicomFile.open(filePath);
        expect(fileResult.ok).toBe(true);
        if (!fileResult.ok) return;

        const changeset = ChangeSet.empty()
            .setTag('(0010,0010)' as DicomTagPath, 'ChangedName')
            .setTag('(0010,0020)' as DicomTagPath, 'CSTEST001');

        const modified = fileResult.value.withChanges(changeset);
        const applyResult = await modified.applyChanges();
        expect(applyResult.ok).toBe(true);

        // Verify both tags were modified
        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const pn = jsonResult.value.data['00100010'];
            expect(pn).toBeDefined();
            if (pn !== undefined) {
                const values = pn.Value;
                if (values !== undefined) {
                    const first = values[0] as Record<string, unknown>;
                    expect(first['Alphabetic']).toBe('ChangedName');
                }
            }

            const pid = jsonResult.value.data['00100020'];
            expect(pid).toBeDefined();
            if (pid !== undefined) {
                const values = pid.Value;
                if (values !== undefined) {
                    expect(values[0]).toBe('CSTEST001');
                }
            }
        }
    });

    it('merge two changesets and apply', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'cs-merge.dcm');

        const fileResult = await DicomFile.open(filePath);
        if (!fileResult.ok) return;

        const cs1 = ChangeSet.empty().setTag('(0010,0010)' as DicomTagPath, 'MergeA');

        const cs2 = ChangeSet.empty().setTag('(0010,0020)' as DicomTagPath, 'MERGE002');

        const merged = cs1.merge(cs2);
        const modified = fileResult.value.withChanges(merged);

        const applyResult = await modified.applyChanges();
        expect(applyResult.ok).toBe(true);

        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const pn = jsonResult.value.data['00100010'];
            if (pn?.Value !== undefined) {
                const first = pn.Value[0] as Record<string, unknown>;
                expect(first['Alphabetic']).toBe('MergeA');
            }

            const pid = jsonResult.value.data['00100020'];
            if (pid?.Value !== undefined) {
                expect(pid.Value[0]).toBe('MERGE002');
            }
        }
    });

    it('changeset with erasure removes tag from file', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'cs-erase.dcm');

        const fileResult = await DicomFile.open(filePath);
        if (!fileResult.ok) return;

        const changeset = ChangeSet.empty()
            .eraseTag('(0010,0010)' as DicomTagPath)
            .setTag('(0010,0020)' as DicomTagPath, 'AFTERERASE');

        const modified = fileResult.value.withChanges(changeset);
        const applyResult = await modified.applyChanges();
        expect(applyResult.ok).toBe(true);

        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            expect(jsonResult.value.data['00100010']).toBeUndefined();
            const pid = jsonResult.value.data['00100020'];
            if (pid?.Value !== undefined) {
                expect(pid.Value[0]).toBe('AFTERERASE');
            }
        }
    });
});
