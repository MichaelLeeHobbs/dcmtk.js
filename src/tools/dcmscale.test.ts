import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmscale } from './dcmscale';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmscale' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmscale()', () => {
    it('scales a DICOM image', async () => {
        const result = await dcmscale('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes correct default arguments', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmscale',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes xFactor flag', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { xFactor: 0.5 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmscale', ['+Sxf', '0.5', '/path/to/input.dcm', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes yFactor flag', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { yFactor: 2 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmscale', ['+Syf', '2', '/path/to/input.dcm', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes xSize flag', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { xSize: 256 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmscale', ['+Sxv', '256', '/path/to/input.dcm', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes ySize flag', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { ySize: 512 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmscale', ['+Syv', '512', '/path/to/input.dcm', '/path/to/output.dcm'], expect.any(Object));
    });

    it('combines multiple scaling options', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', {
            xFactor: 0.5,
            yFactor: 0.75,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmscale',
            ['+Sxf', '0.5', '+Syf', '0.75', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmscale('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot scale image', exitCode: 1 },
        });

        const result = await dcmscale('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmscale failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot scale image');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { bogus: true });

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

        const result = await dcmscale('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { timeoutMs: 10000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmscale',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 10000 })
        );
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmscale('/path/to/input.dcm', '/path/to/output.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmscale',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
