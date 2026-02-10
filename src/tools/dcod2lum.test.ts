import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcod2lum } from './dcod2lum';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcod2lum' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcod2lum()', () => {
    it('converts OD values to P-values', async () => {
        const result = await dcod2lum('/path/to/od.dat', '/path/to/lum.dat');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/lum.dat');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dcod2lum('/path/to/od.dat', '/path/to/lum.dat');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcod2lum',
            ['/path/to/od.dat', '/path/to/lum.dat'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcod2lum('/path/to/od.dat', '/path/to/lum.dat');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read input file', exitCode: 1 },
        });

        const result = await dcod2lum('/path/to/od.dat', '/path/to/lum.dat');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcod2lum failed');
            expect(result.error.message).toContain('cannot read input file');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcod2lum('/path/to/od.dat', '/path/to/lum.dat');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcod2lum('/path/to/od.dat', '/path/to/lum.dat', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcod2lum',
            ['/path/to/od.dat', '/path/to/lum.dat'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcod2lum('/path/to/od.dat', '/path/to/lum.dat', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcod2lum('/path/to/od.dat', '/path/to/lum.dat', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcod2lum',
            ['/path/to/od.dat', '/path/to/lum.dat'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
