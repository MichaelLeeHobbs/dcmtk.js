import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmodify } from './dcmodify';

vi.mock('../exec', () => ({
    spawnCommand: vi.fn(),
}));

vi.mock('./_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { spawnCommand } from '../exec';
import { resolveBinary } from './_resolveBinary';

const mockedSpawn = vi.mocked(spawnCommand);
const mockedResolve = vi.mocked(resolveBinary);

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmodify' });
    mockedSpawn.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmodify()', () => {
    it('modifies DICOM tags', async () => {
        const result = await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Anonymous' }],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.filePath).toBe('/path/to/test.dcm');
        }
    });

    it('uses spawn instead of exec for safety', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Smith^John' }],
        });

        expect(mockedSpawn).toHaveBeenCalled();
    });

    it('passes -nb flag by default (no backup)', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Test' }],
        });

        expect(mockedSpawn).toHaveBeenCalledWith('/usr/local/bin/dcmodify', ['-nb', '-m', '(0010,0010)=Test', '/path/to/test.dcm'], expect.any(Object));
    });

    it('allows backup when noBackup is false', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Test' }],
            noBackup: false,
        });

        const args = mockedSpawn.mock.calls[0]![1] as string[];
        expect(args).not.toContain('-nb');
    });

    it('uses -i flag for insertIfMissing', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Test' }],
            insertIfMissing: true,
        });

        expect(mockedSpawn).toHaveBeenCalledWith('/usr/local/bin/dcmodify', ['-nb', '-i', '(0010,0010)=Test', '/path/to/test.dcm'], expect.any(Object));
    });

    it('handles multiple modifications', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [
                { tag: '(0010,0010)', value: 'Anonymous' },
                { tag: '(0010,0020)', value: 'ANON001' },
            ],
        });

        expect(mockedSpawn).toHaveBeenCalledWith(
            '/usr/local/bin/dcmodify',
            ['-nb', '-m', '(0010,0010)=Anonymous', '-m', '(0010,0020)=ANON001', '/path/to/test.dcm'],
            expect.any(Object)
        );
    });

    it('handles values with shell metacharacters safely', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: "O'Brien; DROP TABLE" }],
        });

        const args = mockedSpawn.mock.calls[0]![1] as string[];
        expect(args).toContain("(0010,0010)=O'Brien; DROP TABLE");
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Test' }],
        });

        expect(result.ok).toBe(false);
    });

    it('returns error on spawn failure', async () => {
        mockedSpawn.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Test' }],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedSpawn.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot modify', exitCode: 1 },
        });

        const result = await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Test' }],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmodify failed');
        }
    });

    it('returns error when no operations provided', async () => {
        const result = await dcmodify('/path/to/test.dcm', {});

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for empty modifications with no erasures', async () => {
        const result = await dcmodify('/path/to/test.dcm', {
            modifications: [],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid tag format', async () => {
        const result = await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: 'bad-tag', value: 'Test' }],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('generates -e flags for erasures', async () => {
        await dcmodify('/path/to/test.dcm', {
            erasures: ['(0010,0010)', '(0010,0020)'],
        });

        expect(mockedSpawn).toHaveBeenCalledWith(
            '/usr/local/bin/dcmodify',
            ['-nb', '-e', '(0010,0010)', '-e', '(0010,0020)', '/path/to/test.dcm'],
            expect.any(Object)
        );
    });

    it('generates -ep flag for erasePrivateTags', async () => {
        await dcmodify('/path/to/test.dcm', {
            erasePrivateTags: true,
        });

        expect(mockedSpawn).toHaveBeenCalledWith('/usr/local/bin/dcmodify', ['-nb', '-ep', '/path/to/test.dcm'], expect.any(Object));
    });

    it('supports erasure-only operation (no modifications)', async () => {
        const result = await dcmodify('/path/to/test.dcm', {
            erasures: ['(0010,0010)'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.filePath).toBe('/path/to/test.dcm');
        }
    });

    it('combines modifications, erasures, and erasePrivateTags', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0010,0010)', value: 'Anonymous' }],
            erasures: ['(0010,0020)'],
            erasePrivateTags: true,
        });

        expect(mockedSpawn).toHaveBeenCalledWith(
            '/usr/local/bin/dcmodify',
            ['-nb', '-m', '(0010,0010)=Anonymous', '-e', '(0010,0020)', '-ep', '/path/to/test.dcm'],
            expect.any(Object)
        );
    });

    it('accepts path-format tags for modifications', async () => {
        await dcmodify('/path/to/test.dcm', {
            modifications: [{ tag: '(0040,A730)[0].(0040,A160)', value: 'Test' }],
        });

        expect(mockedSpawn).toHaveBeenCalledWith(
            '/usr/local/bin/dcmodify',
            ['-nb', '-m', '(0040,A730)[0].(0040,A160)=Test', '/path/to/test.dcm'],
            expect.any(Object)
        );
    });
});
