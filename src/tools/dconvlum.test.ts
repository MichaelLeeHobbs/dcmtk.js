import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dconvlum } from './dconvlum';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dconvlum' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dconvlum()', () => {
    it('converts VeriLUM data to DCMTK format', async () => {
        const result = await dconvlum('/path/to/verilum.dat', '/path/to/display.dat');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/display.dat');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dconvlum('/path/to/verilum.dat', '/path/to/display.dat');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dconvlum',
            ['/path/to/verilum.dat', '/path/to/display.dat'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes ambient light argument', async () => {
        await dconvlum('/path/to/verilum.dat', '/path/to/display.dat', { ambientLight: 10 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dconvlum', ['+Ca', '10', '/path/to/verilum.dat', '/path/to/display.dat'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dconvlum('/path/to/verilum.dat', '/path/to/display.dat');

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

        const result = await dconvlum('/path/to/verilum.dat', '/path/to/display.dat');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dconvlum failed');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dconvlum('/path/to/verilum.dat', '/path/to/display.dat');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dconvlum('/path/to/verilum.dat', '/path/to/display.dat', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('respects custom timeout', async () => {
        await dconvlum('/path/to/verilum.dat', '/path/to/display.dat', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dconvlum',
            ['/path/to/verilum.dat', '/path/to/display.dat'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });
});
