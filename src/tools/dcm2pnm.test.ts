import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcm2pnm, Dcm2pnmOutputFormat } from './dcm2pnm';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2pnm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcm2pnm()', () => {
    it('converts a DICOM image to an output file', async () => {
        const result = await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.pnm');
        }
    });

    it('passes correct default arguments', async () => {
        await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcm2pnm',
            ['/path/to/input.dcm', '/path/to/output.pnm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes output format flag for PNG', async () => {
        await dcm2pnm('/path/to/input.dcm', '/path/to/output.png', {
            outputFormat: Dcm2pnmOutputFormat.PNG,
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2pnm', ['+on', '/path/to/input.dcm', '/path/to/output.png'], expect.any(Object));
    });

    it('supports all output format presets', async () => {
        const expectedFlags: Record<string, string> = {
            pnm: '+op',
            png: '+on',
            bmp: '+ob',
            tiff: '+ot',
        };

        for (const [format, flag] of Object.entries(expectedFlags)) {
            vi.clearAllMocks();
            mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2pnm' });
            mockedExec.mockResolvedValue({
                ok: true,
                value: { stdout: '', stderr: '', exitCode: 0 },
            });

            await dcm2pnm('/in.dcm', '/out.img', {
                outputFormat: format as 'pnm' | 'png' | 'bmp' | 'tiff',
            });

            expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2pnm', [flag, '/in.dcm', '/out.img'], expect.any(Object));
        }
    });

    it('passes frame flag', async () => {
        await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm', { frame: 5 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2pnm', ['+F', '5', '/path/to/input.dcm', '/path/to/output.pnm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read DICOM file', exitCode: 1 },
        });

        const result = await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcm2pnm failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot read DICOM file');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm', { bogus: true });

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

        const result = await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcm2pnm',
            ['/path/to/input.dcm', '/path/to/output.pnm'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcm2pnm('/path/to/input.dcm', '/path/to/output.pnm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcm2pnm',
            ['/path/to/input.dcm', '/path/to/output.pnm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
