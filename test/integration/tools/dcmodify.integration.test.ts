import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dcmodify } from '../../../src/tools/dcmodify';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir, copyDicomToTemp } from '../helpers';

describe.skipIf(!dcmtkAvailable)('dcmodify integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmodify-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('modifies an existing tag value', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'modify-tag.dcm');

        const result = await dcmodify(filePath, {
            modifications: [{ tag: '(0010,0010)', value: 'TestPatient' }],
            noBackup: true,
        });
        expect(result.ok).toBe(true);

        // Verify the modification
        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const patientName = jsonResult.value.data['00100010'];
            expect(patientName).toBeDefined();
            if (patientName !== undefined) {
                const values = patientName.Value;
                expect(values).toBeDefined();
                if (values !== undefined) {
                    const first = values[0] as Record<string, unknown>;
                    expect(first['Alphabetic']).toBe('TestPatient');
                }
            }
        }
    });

    it('inserts a missing tag with insertIfMissing', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'insert-tag.dcm');

        const result = await dcmodify(filePath, {
            modifications: [{ tag: '(0010,1000)', value: 'OTHER_ID_123' }],
            insertIfMissing: true,
            noBackup: true,
        });
        expect(result.ok).toBe(true);

        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const tag = jsonResult.value.data['00101000'];
            expect(tag).toBeDefined();
        }
    });

    it('erases a tag', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'erase-tag.dcm');

        const result = await dcmodify(filePath, {
            erasures: ['(0010,0010)'],
            noBackup: true,
        });
        expect(result.ok).toBe(true);

        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            expect(jsonResult.value.data['00100010']).toBeUndefined();
        }
    });

    it('erases private tags', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'erase-private.dcm');

        const result = await dcmodify(filePath, {
            erasePrivateTags: true,
            noBackup: true,
        });
        expect(result.ok).toBe(true);

        // File should still be valid
        const testResult = await dcmftest(filePath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('applies multiple modifications', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'multi-modify.dcm');

        const result = await dcmodify(filePath, {
            modifications: [
                { tag: '(0010,0010)', value: 'MultiTest' },
                { tag: '(0010,0020)', value: 'MULTI001' },
            ],
            noBackup: true,
        });
        expect(result.ok).toBe(true);

        const jsonResult = await dcm2json(filePath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            expect(jsonResult.value.data['00100010']).toBeDefined();
            expect(jsonResult.value.data['00100020']).toBeDefined();
        }
    });

    it('does not create .bak when noBackup is true', async () => {
        const filePath = await copyDicomToTemp(SAMPLES.MR_BRAIN, tempDir, 'no-backup.dcm');
        const { existsSync } = await import('node:fs');

        await dcmodify(filePath, {
            modifications: [{ tag: '(0010,0010)', value: 'NoBak' }],
            noBackup: true,
        });

        expect(existsSync(`${filePath}.bak`)).toBe(false);
    });
});
