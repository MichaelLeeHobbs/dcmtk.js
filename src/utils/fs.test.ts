import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { ensureDirectory, moveFile, statFileSafe, removeDirSafe, listDirSafe } from './fs';

vi.mock('node:fs/promises', () => ({
    mkdir: vi.fn(),
    rename: vi.fn(),
    copyFile: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
}));

import { mkdir, rename, copyFile, unlink, stat, rm, readdir } from 'node:fs/promises';
import type { Stats } from 'node:fs';

const mockedMkdir = vi.mocked(mkdir);
const mockedRename = vi.mocked(rename);
const mockedCopyFile = vi.mocked(copyFile);
const mockedUnlink = vi.mocked(unlink);
const mockedStat = vi.mocked(stat);
const mockedRm = vi.mocked(rm);
const mockedReaddir = vi.mocked(readdir) as unknown as ReturnType<typeof vi.fn<(dir: string) => Promise<string[]>>>;

beforeEach(() => {
    vi.clearAllMocks();
    mockedMkdir.mockResolvedValue(undefined);
    mockedRename.mockResolvedValue(undefined);
    mockedCopyFile.mockResolvedValue(undefined);
    mockedUnlink.mockResolvedValue(undefined);
    mockedStat.mockResolvedValue({ size: 1024 } as Stats);
    mockedRm.mockResolvedValue(undefined);
});

describe('ensureDirectory', () => {
    it('creates directory recursively', async () => {
        const result = await ensureDirectory('/data/assoc-1');
        expect(result.ok).toBe(true);
        expect(mockedMkdir).toHaveBeenCalledWith('/data/assoc-1', { recursive: true });
    });

    it('returns error on failure', async () => {
        mockedMkdir.mockRejectedValue(new Error('permission denied'));
        const result = await ensureDirectory('/root/forbidden');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('permission denied');
    });
});

describe('moveFile', () => {
    it('renames file on same device', async () => {
        const result = await moveFile('/tmp/a.dcm', '/data/a.dcm');
        expect(result.ok).toBe(true);
        expect(mockedRename).toHaveBeenCalledWith('/tmp/a.dcm', '/data/a.dcm');
        expect(mockedCopyFile).not.toHaveBeenCalled();
    });

    it('falls back to copy+delete on cross-device', async () => {
        mockedRename.mockRejectedValue(new Error('EXDEV'));
        const result = await moveFile('/tmp/a.dcm', '/data/a.dcm');
        expect(result.ok).toBe(true);
        expect(mockedCopyFile).toHaveBeenCalledWith('/tmp/a.dcm', '/data/a.dcm');
        expect(mockedUnlink).toHaveBeenCalledWith('/tmp/a.dcm');
    });

    it('returns error when both rename and copy fail', async () => {
        mockedRename.mockRejectedValue(new Error('EXDEV'));
        mockedCopyFile.mockRejectedValue(new Error('disk full'));
        const result = await moveFile('/tmp/a.dcm', '/data/a.dcm');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('disk full');
    });
});

describe('statFileSafe', () => {
    it('returns file size on success', async () => {
        mockedStat.mockResolvedValue({ size: 4096 } as Stats);
        const size = await statFileSafe('/data/file.dcm');
        expect(size).toBe(4096);
    });

    it('returns 0 on error', async () => {
        mockedStat.mockRejectedValue(new Error('ENOENT'));
        const size = await statFileSafe('/nonexistent');
        expect(size).toBe(0);
    });
});

describe('removeDirSafe', () => {
    it('removes directory recursively', async () => {
        await removeDirSafe('/tmp/dcmrecv-pool-123');
        expect(mockedRm).toHaveBeenCalledWith('/tmp/dcmrecv-pool-123', { recursive: true, force: true });
    });

    it('swallows errors silently', async () => {
        mockedRm.mockRejectedValue(new Error('ENOENT'));
        await expect(removeDirSafe('/nonexistent')).resolves.toBeUndefined();
    });
});

describe('listDirSafe', () => {
    it('returns full paths of the entries', async () => {
        mockedReaddir.mockResolvedValue(['a.dcm', 'b.dcm']);
        const result = await listDirSafe('/tmp/pool');
        expect(result).toEqual({ ok: true, value: [join('/tmp/pool', 'a.dcm'), join('/tmp/pool', 'b.dcm')] });
    });

    it('treats a missing directory as empty', async () => {
        mockedReaddir.mockRejectedValue(Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }));
        const result = await listDirSafe('/tmp/gone');
        expect(result).toEqual({ ok: true, value: [] });
    });

    it('returns an error when the directory cannot be read', async () => {
        mockedReaddir.mockRejectedValue(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }));
        const result = await listDirSafe('/tmp/locked');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('EACCES');
    });

    it('returns an error when readdir throws a non-Error', async () => {
        mockedReaddir.mockRejectedValue('boom');
        const result = await listDirSafe('/tmp/odd');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('boom');
    });
});
