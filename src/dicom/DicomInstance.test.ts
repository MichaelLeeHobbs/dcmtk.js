import { normalize } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Stats } from 'node:fs';
import { DicomInstance } from './DicomInstance';
import { DicomDataset } from './DicomDataset';
import { ChangeSet } from './ChangeSet';
import type { DicomTagPath } from '../brands';
import type { DicomJsonModel } from '../tools/_xmlToJson';

vi.mock('../tools/dcm2json', () => ({
    dcm2json: vi.fn(),
}));

vi.mock('../tools/dicom2json', () => ({
    dicom2json: vi.fn(),
}));

vi.mock('../tools/dcmodify', () => ({
    dcmodify: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
    copyFile: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
}));

import { dcm2json } from '../tools/dcm2json';
import { dicom2json } from '../tools/dicom2json';
import { dcmodify } from '../tools/dcmodify';
import { copyFile, stat, unlink } from 'node:fs/promises';

const mockedDcm2json = vi.mocked(dcm2json);
const mockedDicom2json = vi.mocked(dicom2json);
const mockedDcmodify = vi.mocked(dcmodify);
const mockedCopyFile = vi.mocked(copyFile);
const mockedStat = vi.mocked(stat);
const mockedUnlink = vi.mocked(unlink);

const SAMPLE_JSON: DicomJsonModel = {
    '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Smith^John' }] },
    '00100020': { vr: 'LO', Value: ['12345'] },
    '00080060': { vr: 'CS', Value: ['CT'] },
    '00080020': { vr: 'DA', Value: ['20260101'] },
    '00080050': { vr: 'SH', Value: ['ACC001'] },
    '00200013': { vr: 'IS', Value: [42] },
};

beforeEach(() => {
    vi.clearAllMocks();
    mockedDcm2json.mockResolvedValue({
        ok: true,
        value: { data: SAMPLE_JSON, source: 'xml' as const },
    });
    mockedDicom2json.mockResolvedValue({
        ok: true,
        value: { data: SAMPLE_JSON, warnings: [], source: 'js' as const },
    });
    mockedDcmodify.mockResolvedValue({
        ok: true,
        value: { filePath: normalize('/path/to/test.dcm') },
    });
    mockedCopyFile.mockResolvedValue(undefined);
    mockedStat.mockResolvedValue({ size: 2048 } as Stats);
    mockedUnlink.mockResolvedValue(undefined);
});

describe('DicomInstance', () => {
    describe('open()', () => {
        it('opens a DICOM file and reads dataset', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.patientName).toBe('Smith^John');
                expect(result.value.filePath).toBe(normalize('/path/to/test.dcm'));
                expect(result.value.hasUnsavedChanges).toBe(false);
            }
        });

        it('returns error for empty path', async () => {
            const result = await DicomInstance.open('');
            expect(result.ok).toBe(false);
        });

        it('returns error when the parser fails', async () => {
            mockedDicom2json.mockResolvedValue({
                ok: false,
                error: new Error('dicom2json: failed'),
            });
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid JSON data', async () => {
            mockedDicom2json.mockResolvedValue({
                ok: true,
                value: { data: null as unknown as DicomJsonModel, warnings: [], source: 'js' as const },
            });
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(false);
        });

        it('passes options to dicom2json with DCMTK fallback enabled', async () => {
            const controller = new AbortController();
            await DicomInstance.open('/path/to/test.dcm', {
                timeoutMs: 5000,
                signal: controller.signal,
            });
            expect(mockedDicom2json).toHaveBeenCalledWith('/path/to/test.dcm', {
                timeoutMs: 5000,
                signal: controller.signal,
                charsetAssume: undefined,
                dcmtkFallback: true,
            });
            expect(mockedDcm2json).not.toHaveBeenCalled();
        });

        it('passes charsetAssume to dicom2json', async () => {
            await DicomInstance.open('/path/to/test.dcm', {
                charsetAssume: 'ISO_IR 100',
            });
            expect(mockedDicom2json).toHaveBeenCalledWith(
                '/path/to/test.dcm',
                expect.objectContaining({
                    charsetAssume: 'ISO_IR 100',
                })
            );
        });

        it("uses the deprecated dcm2json path when engine is 'dcmtk'", async () => {
            const result = await DicomInstance.open('/path/to/test.dcm', { engine: 'dcmtk' });
            expect(result.ok).toBe(true);
            expect(mockedDcm2json).toHaveBeenCalledWith(
                '/path/to/test.dcm',
                expect.objectContaining({
                    timeoutMs: expect.any(Number) as number,
                })
            );
            expect(mockedDicom2json).not.toHaveBeenCalled();
        });

        it('surfaces parser warnings on the instance (#34)', async () => {
            mockedDicom2json.mockResolvedValue({
                ok: true,
                value: { data: SAMPLE_JSON, warnings: ['possible UTF-8 mislabel: 00100010'], source: 'js' as const },
            });
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value.warnings).toEqual(['possible UTF-8 mislabel: 00100010']);
        });

        it('preserves warnings across fluent modifications', async () => {
            mockedDicom2json.mockResolvedValue({
                ok: true,
                value: { data: SAMPLE_JSON, warnings: ['w1'], source: 'js' as const },
            });
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const modified = result.value.setPatientName('DOE^JOHN').withMetadata('k', 'v');
            expect(modified.warnings).toEqual(['w1']);
        });

        it('passes utf8MislabelPromote to dicom2json', async () => {
            await DicomInstance.open('/path/to/test.dcm', { utf8MislabelPromote: true });
            expect(mockedDicom2json).toHaveBeenCalledWith(
                '/path/to/test.dcm',
                expect.objectContaining({
                    utf8MislabelPromote: true,
                })
            );
        });

        it("reports empty warnings for engine 'dcmtk'", async () => {
            const result = await DicomInstance.open('/path/to/test.dcm', { engine: 'dcmtk' });
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value.warnings).toEqual([]);
        });
    });

    describe('fromDataset()', () => {
        it('creates instance from dataset without file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const result = DicomInstance.fromDataset(ds.value);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.filePath).toBeUndefined();
                expect(result.value.patientName).toBe('Smith^John');
            }
        });

        it('creates instance from dataset with file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const result = DicomInstance.fromDataset(ds.value, '/data/image.dcm');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.filePath).toBe(normalize('/data/image.dcm'));
            }
        });

        it('returns error for invalid file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const result = DicomInstance.fromDataset(ds.value, '');
            expect(result.ok).toBe(false);
        });
    });

    describe('read accessors', () => {
        it('getString returns tag value', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.getString('00100020')).toBe('12345');
        });

        it('getString returns fallback for missing tag', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.getString('00101234', 'N/A')).toBe('N/A');
        });

        it('getNumber returns numeric value', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const num = result.value.getNumber('00200013');
            expect(num.ok).toBe(true);
            if (num.ok) expect(num.value).toBe(42);
        });

        it('hasTag returns true for existing tag', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.hasTag('00100010')).toBe(true);
        });

        it('hasTag returns false for missing tag', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.hasTag('00101234')).toBe(false);
        });

        it('convenience getters work', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const inst = result.value;
            expect(inst.patientName).toBe('Smith^John');
            expect(inst.patientID).toBe('12345');
            expect(inst.modality).toBe('CT');
            expect(inst.studyDate).toBe('20260101');
            expect(inst.accession).toBe('ACC001');
        });

        it('dataset getter returns underlying DicomDataset', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.dataset).toBeInstanceOf(DicomDataset);
        });

        it('findValues delegates to dataset', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const values = result.value.findValues('(0010,0020)' as DicomTagPath);
            expect(values).toContain('12345');
        });
    });

    describe('withChanges()', () => {
        it('returns new instance with merged changes', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const changes = ChangeSet.empty().setTag('(0010,0010)', 'Anonymous');
            const modified = result.value.withChanges(changes);

            expect(modified.changes.modifications.get('(0010,0010)')).toBe('Anonymous');
            expect(modified.hasUnsavedChanges).toBe(true);
        });

        it('does not modify the original instance', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const changes = ChangeSet.empty().setTag('(0010,0010)', 'Anonymous');
            result.value.withChanges(changes);

            expect(result.value.hasUnsavedChanges).toBe(false);
        });

        it('accumulates changes across multiple calls', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const cs1 = ChangeSet.empty().setTag('(0010,0010)', 'Name');
            const cs2 = ChangeSet.empty().setTag('(0010,0020)', 'ID');
            const modified = result.value.withChanges(cs1).withChanges(cs2);

            expect(modified.changes.modifications.size).toBe(2);
        });
    });

    describe('withFilePath()', () => {
        it('returns new instance with new path', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const moved = result.value.withFilePath('/new/path.dcm');
            expect(moved.filePath).toBe(normalize('/new/path.dcm'));
        });

        it('preserves dataset and changes', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.setTag('(0010,0010)', 'Test').withFilePath('/new/path.dcm');

            expect(modified.dataset.patientName).toBe('Smith^John');
            expect(modified.changes.modifications.get('(0010,0010)')).toBe('Test');
        });

        it('throws for invalid path', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(() => result.value.withFilePath('')).toThrow();
        });
    });

    describe('write methods', () => {
        it('setTag returns new instance with modification', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.setTag('(0010,0010)', 'Anonymous');
            expect(modified.changes.modifications.get('(0010,0010)')).toBe('Anonymous');
            expect(modified.hasUnsavedChanges).toBe(true);
        });

        it('setTag does not modify original', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            result.value.setTag('(0010,0010)', 'Anonymous');
            expect(result.value.hasUnsavedChanges).toBe(false);
        });

        it('eraseTag returns new instance with erasure', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.eraseTag('(0010,0020)');
            expect(modified.changes.erasures.has('(0010,0020)')).toBe(true);
        });

        it('erasePrivateTags sets the flag', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.erasePrivateTags();
            expect(modified.changes.erasePrivate).toBe(true);
        });

        it('convenience setters work', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const inst = result.value
                .setPatientName('DOE^JOHN')
                .setPatientID('PAT002')
                .setStudyDate('20260228')
                .setModality('MR')
                .setAccessionNumber('ACC999')
                .setStudyDescription('Brain MRI')
                .setSeriesDescription('Sagittal')
                .setInstitutionName('Hospital');

            expect(inst.changes.modifications.size).toBe(8);
            expect(inst.changes.modifications.get('(0010,0010)')).toBe('DOE^JOHN');
            expect(inst.changes.modifications.get('(0008,0080)')).toBe('Hospital');
        });

        it('transformTag transforms existing value', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.transformTag('(0010,0020)', current => `ANON_${current ?? ''}`);
            expect(modified.changes.modifications.get('(0010,0020)')).toBe('ANON_12345');
        });

        it('transformTag handles missing tag', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.transformTag('(0010,1234)', current => current ?? 'DEFAULT');
            expect(modified.changes.modifications.get('(0010,1234)')).toBe('DEFAULT');
        });

        it('setBatch sets multiple tags', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.setBatch({
                '(0010,0010)': 'DOE^JOHN',
                '(0010,0020)': 'PAT001',
            });
            expect(modified.changes.modifications.size).toBe(2);
        });

        it('changes chain correctly', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const inst = result.value.setTag('(0010,0010)', 'Name').eraseTag('(0010,0020)').erasePrivateTags();

            expect(inst.changes.modifications.size).toBe(1);
            expect(inst.changes.erasures.has('(0010,0020)')).toBe(true);
            expect(inst.changes.erasePrivate).toBe(true);
        });
    });

    describe('file I/O', () => {
        it('applyChanges calls dcmodify', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.setTag('(0010,0010)', 'Anonymous');
            const applyResult = await modified.applyChanges();

            expect(applyResult.ok).toBe(true);
            expect(mockedDcmodify).toHaveBeenCalled();
        });

        it('applyChanges no-ops when empty', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const applyResult = await result.value.applyChanges();
            expect(applyResult.ok).toBe(true);
            expect(mockedDcmodify).not.toHaveBeenCalled();
        });

        it('applyChanges returns error without file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const inst = DicomInstance.fromDataset(ds.value);
            expect(inst.ok).toBe(true);
            if (!inst.ok) return;

            return inst.value
                .setTag('(0010,0010)', 'Test')
                .applyChanges()
                .then(r => {
                    expect(r.ok).toBe(false);
                });
        });

        it('writeAs copies and applies changes', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const modified = result.value.setTag('(0010,0010)', 'Anonymous');
            const writeResult = await modified.writeAs('/output/copy.dcm');

            expect(writeResult.ok).toBe(true);
            expect(mockedCopyFile).toHaveBeenCalled();
            expect(mockedDcmodify).toHaveBeenCalled();
            if (writeResult.ok) {
                expect(writeResult.value.filePath).toBe(normalize('/output/copy.dcm'));
                expect(writeResult.value.hasUnsavedChanges).toBe(false);
            }
        });

        it('writeAs copies without dcmodify when empty', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const writeResult = await result.value.writeAs('/output/copy.dcm');
            expect(writeResult.ok).toBe(true);
            expect(mockedCopyFile).toHaveBeenCalled();
            expect(mockedDcmodify).not.toHaveBeenCalled();
        });

        it('writeAs cleans up on dcmodify failure', async () => {
            mockedDcmodify.mockResolvedValue({
                ok: false,
                error: new Error('dcmodify failed'),
            });

            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const writeResult = await result.value.setTag('(0010,0010)', 'Test').writeAs('/output/copy.dcm');
            expect(writeResult.ok).toBe(false);
            expect(mockedUnlink).toHaveBeenCalledWith('/output/copy.dcm');
        });

        it('writeAs returns error without file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const inst = DicomInstance.fromDataset(ds.value);
            expect(inst.ok).toBe(true);
            if (!inst.ok) return;

            return inst.value.writeAs('/output/copy.dcm').then(r => {
                expect(r.ok).toBe(false);
            });
        });

        it('writeAs returns error for invalid output path', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const writeResult = await result.value.writeAs('');
            expect(writeResult.ok).toBe(false);
        });

        it('fileSize returns size', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const sizeResult = await result.value.fileSize();
            expect(sizeResult.ok).toBe(true);
            if (sizeResult.ok) expect(sizeResult.value).toBe(2048);
        });

        it('fileSize returns error without file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const inst = DicomInstance.fromDataset(ds.value);
            expect(inst.ok).toBe(true);
            if (!inst.ok) return;

            return inst.value.fileSize().then(r => {
                expect(r.ok).toBe(false);
            });
        });

        it('unlink deletes the file', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const unlinkResult = await result.value.unlink();
            expect(unlinkResult.ok).toBe(true);
            expect(mockedUnlink).toHaveBeenCalledWith(normalize('/path/to/test.dcm'));
        });

        it('unlink returns error without file path', () => {
            const ds = DicomDataset.fromJson(SAMPLE_JSON);
            expect(ds.ok).toBe(true);
            if (!ds.ok) return;

            const inst = DicomInstance.fromDataset(ds.value);
            expect(inst.ok).toBe(true);
            if (!inst.ok) return;

            return inst.value.unlink().then(r => {
                expect(r.ok).toBe(false);
            });
        });
    });

    describe('metadata', () => {
        it('withMetadata attaches metadata', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const inst = result.value.withMetadata('source', 'PACS');
            expect(inst.getMetadata('source')).toBe('PACS');
        });

        it('withMetadata does not modify original', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            result.value.withMetadata('key', 'value');
            expect(result.value.getMetadata('key')).toBeUndefined();
        });

        it('getMetadata returns undefined for missing key', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.getMetadata('nonexistent')).toBeUndefined();
        });

        it('metadata chains with other operations', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const inst = result.value.setPatientName('DOE^JOHN').withMetadata('processed', true).withMetadata('source', 'scanner');

            expect(inst.changes.modifications.get('(0010,0010)')).toBe('DOE^JOHN');
            expect(inst.getMetadata('processed')).toBe(true);
            expect(inst.getMetadata('source')).toBe('scanner');
        });
    });

    describe('immutability', () => {
        it('all setters return new instances', async () => {
            const result = await DicomInstance.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const original = result.value;
            const a = original.setTag('(0010,0010)', 'A');
            const b = original.eraseTag('(0010,0020)');
            const c = original.erasePrivateTags();
            const d = original.withMetadata('key', 'val');

            expect(original.hasUnsavedChanges).toBe(false);
            expect(a).not.toBe(original);
            expect(b).not.toBe(original);
            expect(c).not.toBe(original);
            expect(d).not.toBe(original);
        });
    });
});
