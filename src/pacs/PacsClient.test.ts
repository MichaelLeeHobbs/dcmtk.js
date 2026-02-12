import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '../types';
import { DicomDataset } from '../dicom/DicomDataset';
import { RetrieveMode } from './types';

vi.mock('../tools/echoscu', () => ({
    echoscu: vi.fn(),
}));

vi.mock('../tools/findscu', () => ({
    findscu: vi.fn(),
}));

vi.mock('../tools/getscu', () => ({
    getscu: vi.fn(),
}));

vi.mock('../tools/movescu', () => ({
    movescu: vi.fn(),
}));

vi.mock('../tools/storescu', () => ({
    storescu: vi.fn(),
}));

vi.mock('./parseResults', () => ({
    createTempDir: vi.fn(),
    parseExtractedFiles: vi.fn(),
    cleanupTempDir: vi.fn(),
}));

import { echoscu } from '../tools/echoscu';
import { findscu } from '../tools/findscu';
import { getscu } from '../tools/getscu';
import { movescu } from '../tools/movescu';
import { storescu } from '../tools/storescu';
import { createTempDir, parseExtractedFiles, cleanupTempDir } from './parseResults';
import { PacsClient } from './PacsClient';

const mockedEchoscu = vi.mocked(echoscu);
const mockedFindscu = vi.mocked(findscu);
const mockedGetscu = vi.mocked(getscu);
const mockedMovescu = vi.mocked(movescu);
const mockedStorescu = vi.mocked(storescu);
const mockedCreateTempDir = vi.mocked(createTempDir);
const mockedParseExtractedFiles = vi.mocked(parseExtractedFiles);
const mockedCleanupTempDir = vi.mocked(cleanupTempDir);

const VALID_CONFIG = {
    host: '192.168.1.100',
    port: 104,
    callingAETitle: 'LOCAL',
    calledAETitle: 'PACS',
};

function createClient(): PacsClient {
    const result = PacsClient.create(VALID_CONFIG);
    if (!result.ok) throw result.error;
    return result.value;
}

function mockDataset(): DicomDataset {
    const result = DicomDataset.fromJson({ '00100010': { vr: 'PN', Value: [{ Alphabetic: 'DOE^JOHN' }] } });
    if (!result.ok) throw result.error;
    return result.value;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockedCleanupTempDir.mockResolvedValue();
});

// ---------------------------------------------------------------------------
// create() validation
// ---------------------------------------------------------------------------

describe('PacsClient.create', () => {
    it('creates a client with valid config', () => {
        const result = PacsClient.create(VALID_CONFIG);
        expect(result.ok).toBe(true);
    });

    it('rejects empty host', () => {
        const result = PacsClient.create({ ...VALID_CONFIG, host: '' });
        expect(result.ok).toBe(false);
    });

    it('rejects port 0', () => {
        const result = PacsClient.create({ ...VALID_CONFIG, port: 0 });
        expect(result.ok).toBe(false);
    });

    it('rejects port above 65535', () => {
        const result = PacsClient.create({ ...VALID_CONFIG, port: 70000 });
        expect(result.ok).toBe(false);
    });

    it('rejects AE title longer than 16 characters', () => {
        const result = PacsClient.create({ ...VALID_CONFIG, callingAETitle: 'A'.repeat(17) });
        expect(result.ok).toBe(false);
    });

    it('accepts minimal config (host + port only)', () => {
        const result = PacsClient.create({ host: 'localhost', port: 11112 });
        expect(result.ok).toBe(true);
    });

    it('rejects unknown properties', () => {
        const result = PacsClient.create({ ...VALID_CONFIG, unknown: true } as never);
        expect(result.ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Accessor getters
// ---------------------------------------------------------------------------

describe('PacsClient accessors', () => {
    it('exposes host', () => {
        expect(createClient().host).toBe('192.168.1.100');
    });

    it('exposes port', () => {
        expect(createClient().port).toBe(104);
    });

    it('exposes callingAETitle', () => {
        expect(createClient().callingAETitle).toBe('LOCAL');
    });

    it('exposes calledAETitle', () => {
        expect(createClient().calledAETitle).toBe('PACS');
    });

    it('returns undefined for optional AE titles when not set', () => {
        const result = PacsClient.create({ host: 'localhost', port: 104 });
        if (!result.ok) throw result.error;
        expect(result.value.callingAETitle).toBeUndefined();
        expect(result.value.calledAETitle).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// echo()
// ---------------------------------------------------------------------------

describe('PacsClient.echo', () => {
    it('returns success with rttMs on successful echo', async () => {
        mockedEchoscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const client = createClient();
        const result = await client.echo();
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
            expect(result.value.rttMs).toBeGreaterThanOrEqual(0);
        }
    });

    it('returns error on echo failure', async () => {
        mockedEchoscu.mockResolvedValue(err(new Error('connection refused')));
        const result = await createClient().echo();
        expect(result.ok).toBe(false);
    });

    it('passes signal through to echoscu', async () => {
        const controller = new AbortController();
        mockedEchoscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        await createClient().echo({ signal: controller.signal });
        expect(mockedEchoscu).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
    });

    it('uses method timeout over client timeout', async () => {
        mockedEchoscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const configResult = PacsClient.create({ ...VALID_CONFIG, timeoutMs: 10000 });
        if (!configResult.ok) throw configResult.error;
        await configResult.value.echo({ timeoutMs: 5000 });
        expect(mockedEchoscu).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
    });
});

// ---------------------------------------------------------------------------
// findStudies()
// ---------------------------------------------------------------------------

describe('PacsClient.findStudies', () => {
    it('returns DicomDataset array on success', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([mockDataset()]));

        const result = await createClient().findStudies({ patientId: 'PAT001' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(1);
        }
    });

    it('calls findscu with --extract and outputDirectory', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().findStudies({ patientId: 'PAT001' });
        expect(mockedFindscu).toHaveBeenCalledWith(
            expect.objectContaining({
                extract: true,
                outputDirectory: '/tmp/dcmtk-pacs-test',
                queryModel: 'study',
            })
        );
    });

    it('cleans up temp directory on success', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().findStudies({});
        expect(mockedCleanupTempDir).toHaveBeenCalledWith('/tmp/dcmtk-pacs-test');
    });

    it('cleans up temp directory on findscu error', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(err(new Error('network error')));

        await createClient().findStudies({});
        expect(mockedCleanupTempDir).toHaveBeenCalledWith('/tmp/dcmtk-pacs-test');
    });

    it('returns error when temp dir creation fails', async () => {
        mockedCreateTempDir.mockResolvedValue(err(new Error('permission denied')));
        const result = await createClient().findStudies({});
        expect(result.ok).toBe(false);
    });

    it('returns error when findscu fails', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(err(new Error('timeout')));

        const result = await createClient().findStudies({});
        expect(result.ok).toBe(false);
    });

    it('passes parseConcurrency to parseExtractedFiles', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().findStudies({}, { parseConcurrency: 10 });
        expect(mockedParseExtractedFiles).toHaveBeenCalledWith('/tmp/dcmtk-pacs-test', expect.any(Number), 10, undefined);
    });
});

// ---------------------------------------------------------------------------
// findSeries()
// ---------------------------------------------------------------------------

describe('PacsClient.findSeries', () => {
    it('queries with series-level keys', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().findSeries({ studyInstanceUID: '1.2.3' });
        expect(mockedFindscu).toHaveBeenCalledWith(
            expect.objectContaining({
                keys: expect.arrayContaining(['0008,0052=SERIES', '0020,000d=1.2.3']) as unknown,
            })
        );
    });
});

// ---------------------------------------------------------------------------
// findImages()
// ---------------------------------------------------------------------------

describe('PacsClient.findImages', () => {
    it('queries with image-level keys', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().findImages({ studyInstanceUID: '1.2.3', seriesInstanceUID: '1.2.3.4' });
        expect(mockedFindscu).toHaveBeenCalledWith(
            expect.objectContaining({
                keys: expect.arrayContaining(['0008,0052=IMAGE', '0020,000d=1.2.3', '0020,000e=1.2.3.4']) as unknown,
            })
        );
    });
});

// ---------------------------------------------------------------------------
// findWorklist()
// ---------------------------------------------------------------------------

describe('PacsClient.findWorklist', () => {
    it('queries with worklist model and raw keys', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().findWorklist({ keys: ['0040,0100.0008,0060=CT'] });
        expect(mockedFindscu).toHaveBeenCalledWith(
            expect.objectContaining({
                queryModel: 'worklist',
                keys: ['0040,0100.0008,0060=CT'],
            })
        );
    });
});

// ---------------------------------------------------------------------------
// find() - raw query
// ---------------------------------------------------------------------------

describe('PacsClient.find', () => {
    it('passes raw keys to findscu', async () => {
        mockedCreateTempDir.mockResolvedValue(ok('/tmp/dcmtk-pacs-test'));
        mockedFindscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        mockedParseExtractedFiles.mockResolvedValue(ok([]));

        await createClient().find(['0008,0052=STUDY', '0010,0020=PAT001']);
        expect(mockedFindscu).toHaveBeenCalledWith(
            expect.objectContaining({
                keys: ['0008,0052=STUDY', '0010,0020=PAT001'],
            })
        );
    });
});

// ---------------------------------------------------------------------------
// retrieveStudy()
// ---------------------------------------------------------------------------

describe('PacsClient.retrieveStudy', () => {
    it('uses C-GET by default', async () => {
        mockedGetscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const result = await createClient().retrieveStudy('1.2.3', {
            outputDirectory: '/tmp/dicom',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
            expect(result.value.outputDirectory).toBe('/tmp/dicom');
        }
        expect(mockedGetscu).toHaveBeenCalledWith(
            expect.objectContaining({
                keys: expect.arrayContaining(['0008,0052=STUDY', '0020,000d=1.2.3']) as unknown,
                outputDirectory: '/tmp/dicom',
            })
        );
    });

    it('uses C-MOVE when mode is C_MOVE', async () => {
        mockedMovescu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const result = await createClient().retrieveStudy('1.2.3', {
            outputDirectory: '/tmp/dicom',
            mode: RetrieveMode.C_MOVE,
            moveDestination: 'LOCALAE',
        });
        expect(result.ok).toBe(true);
        expect(mockedMovescu).toHaveBeenCalledWith(
            expect.objectContaining({
                moveDestination: 'LOCALAE',
                outputDirectory: '/tmp/dicom',
            })
        );
    });

    it('returns error when C-MOVE missing moveDestination', async () => {
        const result = await createClient().retrieveStudy('1.2.3', {
            outputDirectory: '/tmp/dicom',
            mode: RetrieveMode.C_MOVE,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('moveDestination');
        }
    });

    it('returns error on getscu failure', async () => {
        mockedGetscu.mockResolvedValue(err(new Error('timeout')));
        const result = await createClient().retrieveStudy('1.2.3', {
            outputDirectory: '/tmp/dicom',
        });
        expect(result.ok).toBe(false);
    });

    it('returns error on movescu failure', async () => {
        mockedMovescu.mockResolvedValue(err(new Error('network error')));
        const result = await createClient().retrieveStudy('1.2.3', {
            outputDirectory: '/tmp/dicom',
            mode: RetrieveMode.C_MOVE,
            moveDestination: 'DEST',
        });
        expect(result.ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// retrieveSeries()
// ---------------------------------------------------------------------------

describe('PacsClient.retrieveSeries', () => {
    it('includes both study and series UIDs in keys', async () => {
        mockedGetscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        await createClient().retrieveSeries('1.2.3', '1.2.3.4', {
            outputDirectory: '/tmp/dicom',
        });
        expect(mockedGetscu).toHaveBeenCalledWith(
            expect.objectContaining({
                keys: expect.arrayContaining(['0008,0052=SERIES', '0020,000d=1.2.3', '0020,000e=1.2.3.4']) as unknown,
            })
        );
    });
});

// ---------------------------------------------------------------------------
// store()
// ---------------------------------------------------------------------------

describe('PacsClient.store', () => {
    it('sends files and returns file count', async () => {
        mockedStorescu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const result = await createClient().store(['/tmp/a.dcm', '/tmp/b.dcm']);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
            expect(result.value.fileCount).toBe(2);
        }
    });

    it('passes scanDirectories and recurse options', async () => {
        mockedStorescu.mockResolvedValue(ok({ success: true, stderr: '' }));
        await createClient().store(['/tmp/dir'], {
            scanDirectories: true,
            recurse: true,
        });
        expect(mockedStorescu).toHaveBeenCalledWith(
            expect.objectContaining({
                scanDirectories: true,
                recurse: true,
            })
        );
    });

    it('returns error on storescu failure', async () => {
        mockedStorescu.mockResolvedValue(err(new Error('send failed')));
        const result = await createClient().store(['/tmp/a.dcm']);
        expect(result.ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Timeout resolution
// ---------------------------------------------------------------------------

describe('timeout resolution', () => {
    it('uses default timeout when no overrides', async () => {
        mockedEchoscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const result = PacsClient.create({ host: 'localhost', port: 104 });
        if (!result.ok) throw result.error;
        await result.value.echo();
        expect(mockedEchoscu).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('uses client-level timeout', async () => {
        mockedEchoscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const result = PacsClient.create({ host: 'localhost', port: 104, timeoutMs: 15000 });
        if (!result.ok) throw result.error;
        await result.value.echo();
        expect(mockedEchoscu).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 15000 }));
    });

    it('method timeout overrides client timeout', async () => {
        mockedEchoscu.mockResolvedValue(ok({ success: true, stderr: '' }));
        const result = PacsClient.create({ host: 'localhost', port: 104, timeoutMs: 15000 });
        if (!result.ok) throw result.error;
        await result.value.echo({ timeoutMs: 3000 });
        expect(mockedEchoscu).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 3000 }));
    });
});
