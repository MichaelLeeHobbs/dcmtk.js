import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stl2dcm } from './stl2dcm';

vi.mock('../exec', () => ({
    execCommand: vi.fn(),
}));

vi.mock('./_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { execCommand } from '../exec';
import { resolveBinary } from './_resolveBinary';

const mockedExec = vi.mocked(execCommand);
const mockedResolve = vi.mocked(resolveBinary);

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/stl2dcm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('stl2dcm()', () => {
    it('converts STL to DICOM', async () => {
        const result = await stl2dcm('/path/model.stl', '/path/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await stl2dcm('/path/model.stl', '/path/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/stl2dcm',
            ['/path/model.stl', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await stl2dcm('/path/model.stl', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot convert STL', exitCode: 1 },
        });

        const result = await stl2dcm('/path/model.stl', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('stl2dcm failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option key
        const result = await stl2dcm('/path/model.stl', '/path/output.dcm', { unknownKey: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await stl2dcm('/path/model.stl', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await stl2dcm('/path/model.stl', '/path/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/stl2dcm', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });

    it('works without options', async () => {
        const result = await stl2dcm('/path/model.stl', '/path/output.dcm');

        expect(result.ok).toBe(true);
        expect(mockedExec).toHaveBeenCalledOnce();
    });
});
