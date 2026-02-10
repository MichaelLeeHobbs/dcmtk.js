import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmquant } from './dcmquant';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmquant' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmquant()', () => {
    it('quantizes a color DICOM image', async () => {
        const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes correct default arguments', async () => {
        await dcmquant('/path/to/input.dcm', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmquant',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes colors flag', async () => {
        await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', { colors: 256 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmquant', ['+pc', '256', '/path/to/input.dcm', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes frame flag', async () => {
        await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', { frame: 2 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmquant', ['+F', '2', '/path/to/input.dcm', '/path/to/output.dcm'], expect.any(Object));
    });

    it('combines colors and frame options', async () => {
        await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', {
            colors: 128,
            frame: 0,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmquant',
            ['+pc', '128', '+F', '0', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot quantize image', exitCode: 1 },
        });

        const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmquant failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot quantize image');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid colors value', async () => {
        const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', { colors: 1 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcmquant('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', { timeoutMs: 15000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmquant',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 15000 })
        );
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmquant('/path/to/input.dcm', '/path/to/output.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmquant',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
