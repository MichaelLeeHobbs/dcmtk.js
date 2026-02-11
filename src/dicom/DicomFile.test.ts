import { normalize } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Stats } from 'node:fs';
import { DicomFile } from './DicomFile';
import { ChangeSet } from './ChangeSet';
import type { DicomFilePath, DicomTagPath } from '../brands';
import type { DicomJsonModel } from '../tools/_xmlToJson';

vi.mock('../tools/dcm2json', () => ({
    dcm2json: vi.fn(),
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
import { dcmodify } from '../tools/dcmodify';
import { copyFile, stat, unlink } from 'node:fs/promises';

const mockedDcm2json = vi.mocked(dcm2json);
const mockedDcmodify = vi.mocked(dcmodify);
const mockedCopyFile = vi.mocked(copyFile);
const mockedStat = vi.mocked(stat);
const mockedUnlink = vi.mocked(unlink);

const SAMPLE_JSON: DicomJsonModel = {
    '00100010': { vr: 'PN', Value: [{ Alphabetic: 'Smith^John' }] },
    '00100020': { vr: 'LO', Value: ['12345'] },
};

const path = (s: string): DicomTagPath => s as DicomTagPath;
const filePath = (s: string): DicomFilePath => s as DicomFilePath;

beforeEach(() => {
    vi.clearAllMocks();

    mockedDcm2json.mockResolvedValue({
        ok: true,
        value: { data: SAMPLE_JSON, source: 'xml' as const },
    });

    mockedDcmodify.mockResolvedValue({
        ok: true,
        value: { filePath: normalize('/path/to/test.dcm') },
    });

    mockedCopyFile.mockResolvedValue(undefined);
    mockedStat.mockResolvedValue({ size: 1024 } as Stats);
    mockedUnlink.mockResolvedValue(undefined);
});

describe('DicomFile', () => {
    describe('open()', () => {
        it('opens a DICOM file and reads dataset', async () => {
            const result = await DicomFile.open('/path/to/test.dcm');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.dataset.patientName).toBe('Smith^John');
                expect(result.value.filePath).toBe(normalize('/path/to/test.dcm'));
                expect(result.value.changes.isEmpty).toBe(true);
            }
        });

        it('returns error for empty path', async () => {
            const result = await DicomFile.open('');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('empty string');
            }
        });

        it('returns error when dcm2json fails', async () => {
            mockedDcm2json.mockResolvedValue({
                ok: false,
                error: new Error('dcm2json: failed'),
            });

            const result = await DicomFile.open('/path/to/test.dcm');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcm2json');
            }
        });

        it('returns error for malformed JSON data', async () => {
            mockedDcm2json.mockResolvedValue({
                ok: true,
                value: { data: null as unknown as DicomJsonModel, source: 'xml' as const },
            });

            const result = await DicomFile.open('/path/to/test.dcm');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('Invalid DICOM JSON');
            }
        });

        it('passes timeout and signal options to dcm2json', async () => {
            const controller = new AbortController();
            await DicomFile.open('/path/to/test.dcm', {
                timeoutMs: 5000,
                signal: controller.signal,
            });

            expect(mockedDcm2json).toHaveBeenCalledWith('/path/to/test.dcm', {
                timeoutMs: 5000,
                signal: controller.signal,
            });
        });
    });

    describe('withChanges()', () => {
        it('returns new DicomFile with merged changes', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Anonymous');
            const modified = openResult.value.withChanges(changes);

            expect(modified.changes.modifications.get('(0010,0010)')).toBe('Anonymous');
        });

        it('does not modify the original DicomFile', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Anonymous');
            openResult.value.withChanges(changes);

            expect(openResult.value.changes.isEmpty).toBe(true);
        });

        it('accumulates changes across multiple calls', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const cs1 = ChangeSet.empty().setTag(path('(0010,0010)'), 'Name');
            const cs2 = ChangeSet.empty().setTag(path('(0010,0020)'), 'ID');
            const modified = openResult.value.withChanges(cs1).withChanges(cs2);

            expect(modified.changes.modifications.size).toBe(2);
        });
    });

    describe('withFilePath()', () => {
        it('returns new DicomFile with new path', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const moved = openResult.value.withFilePath(filePath('/new/path.dcm'));
            expect(moved.filePath).toBe('/new/path.dcm');
        });

        it('preserves dataset and changes', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            const modified = openResult.value.withChanges(changes).withFilePath(filePath('/new/path.dcm'));

            expect(modified.dataset.patientName).toBe('Smith^John');
            expect(modified.changes.modifications.get('(0010,0010)')).toBe('Test');
        });
    });

    describe('applyChanges()', () => {
        it('calls dcmodify with modifications', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Anonymous');
            const modified = openResult.value.withChanges(changes);
            const result = await modified.applyChanges();

            expect(result.ok).toBe(true);
            expect(mockedDcmodify).toHaveBeenCalledWith(
                normalize('/path/to/test.dcm'),
                expect.objectContaining({
                    modifications: [{ tag: '(0010,0010)', value: 'Anonymous' }],
                    insertIfMissing: true,
                })
            );
        });

        it('skips dcmodify when changes are empty', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.applyChanges();

            expect(result.ok).toBe(true);
            expect(mockedDcmodify).not.toHaveBeenCalled();
        });

        it('returns error when dcmodify fails', async () => {
            mockedDcmodify.mockResolvedValue({
                ok: false,
                error: new Error('dcmodify failed'),
            });

            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            const result = await openResult.value.withChanges(changes).applyChanges();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcmodify');
            }
        });

        it('passes options to dcmodify', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const controller = new AbortController();
            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            await openResult.value.withChanges(changes).applyChanges({
                timeoutMs: 5000,
                signal: controller.signal,
            });

            expect(mockedDcmodify).toHaveBeenCalledWith(
                normalize('/path/to/test.dcm'),
                expect.objectContaining({
                    timeoutMs: 5000,
                    signal: controller.signal,
                })
            );
        });

        it('sends erasures to dcmodify', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().eraseTag(path('(0010,0020)'));
            await openResult.value.withChanges(changes).applyChanges();

            expect(mockedDcmodify).toHaveBeenCalledWith(
                normalize('/path/to/test.dcm'),
                expect.objectContaining({
                    erasures: ['(0010,0020)'],
                })
            );
        });

        it('sends erasePrivateTags to dcmodify', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().erasePrivateTags();
            await openResult.value.withChanges(changes).applyChanges();

            expect(mockedDcmodify).toHaveBeenCalledWith(
                normalize('/path/to/test.dcm'),
                expect.objectContaining({
                    erasePrivateTags: true,
                })
            );
        });
    });

    describe('writeAs()', () => {
        it('copies file and applies changes', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Anonymous');
            const modified = openResult.value.withChanges(changes);
            const result = await modified.writeAs('/path/to/output.dcm');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(normalize('/path/to/output.dcm'));
            }
            expect(mockedCopyFile).toHaveBeenCalledWith(normalize('/path/to/test.dcm'), '/path/to/output.dcm');
            expect(mockedDcmodify).toHaveBeenCalled();
        });

        it('copies without dcmodify when changes are empty', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.writeAs('/path/to/output.dcm');

            expect(result.ok).toBe(true);
            expect(mockedCopyFile).toHaveBeenCalled();
            expect(mockedDcmodify).not.toHaveBeenCalled();
        });

        it('cleans up copy on dcmodify failure', async () => {
            mockedDcmodify.mockResolvedValue({
                ok: false,
                error: new Error('dcmodify failed'),
            });

            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const changes = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            const result = await openResult.value.withChanges(changes).writeAs('/path/to/output.dcm');

            expect(result.ok).toBe(false);
            expect(mockedUnlink).toHaveBeenCalledWith('/path/to/output.dcm');
        });

        it('returns error when copy fails', async () => {
            mockedCopyFile.mockRejectedValue(new Error('ENOSPC'));

            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.writeAs('/path/to/output.dcm');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('copy');
            }
        });

        it('returns error for empty output path', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.writeAs('');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('empty string');
            }
        });
    });

    describe('fileSize()', () => {
        it('returns file size', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.fileSize();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(1024);
            }
        });

        it('returns error when stat fails', async () => {
            mockedStat.mockRejectedValue(new Error('ENOENT'));

            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.fileSize();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('stat');
            }
        });
    });

    describe('unlink()', () => {
        it('deletes the file', async () => {
            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.unlink();

            expect(result.ok).toBe(true);
            expect(mockedUnlink).toHaveBeenCalledWith(normalize('/path/to/test.dcm'));
        });

        it('returns error when unlink fails', async () => {
            mockedUnlink.mockRejectedValue(new Error('EPERM'));

            const openResult = await DicomFile.open('/path/to/test.dcm');
            expect(openResult.ok).toBe(true);
            if (!openResult.ok) return;

            const result = await openResult.value.unlink();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('delete');
            }
        });
    });
});
