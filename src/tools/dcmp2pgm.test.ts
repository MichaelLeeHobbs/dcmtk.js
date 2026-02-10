import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmp2pgm } from './dcmp2pgm';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmp2pgm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmp2pgm()', () => {
    it('renders a DICOM image to a bitmap', async () => {
        const result = await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.pgm');
        }
    });

    it('passes correct default arguments', async () => {
        await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmp2pgm',
            ['/path/to/input.dcm', '/path/to/output.pgm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes presentation state flag', async () => {
        await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm', {
            presentationState: '/path/to/state.dcm',
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmp2pgm',
            ['-p', '/path/to/state.dcm', '/path/to/input.dcm', '/path/to/output.pgm'],
            expect.any(Object)
        );
    });

    it('passes frame flag', async () => {
        await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm', { frame: 3 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmp2pgm', ['-f', '3', '/path/to/input.dcm', '/path/to/output.pgm'], expect.any(Object));
    });

    it('passes both presentation state and frame flags', async () => {
        await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm', {
            presentationState: '/path/to/state.dcm',
            frame: 5,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmp2pgm',
            ['-p', '/path/to/state.dcm', '-f', '5', '/path/to/input.dcm', '/path/to/output.pgm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm');

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

        const result = await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmp2pgm failed');
            expect(result.error.message).toContain('cannot read DICOM file');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm', { bogus: true });

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

        const result = await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmp2pgm('/path/to/input.dcm', '/path/to/output.pgm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmp2pgm',
            ['/path/to/input.dcm', '/path/to/output.pgm'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });
});
