import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmdspfn } from './dcmdspfn';

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

const SAMPLE_OUTPUT = 'Display function: GSDF\nAmbient light: 10 cd/m2';

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmdspfn' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_OUTPUT, stderr: '', exitCode: 0 },
    });
});

describe('dcmdspfn()', () => {
    it('returns display function text', async () => {
        const result = await dcmdspfn();

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe(SAMPLE_OUTPUT);
        }
    });

    it('passes monitor file argument', async () => {
        await dcmdspfn({ monitorFile: '/path/to/monitor.lut' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdspfn', ['+Im', '/path/to/monitor.lut'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes camera file argument', async () => {
        await dcmdspfn({ cameraFile: '/path/to/camera.lut' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdspfn', ['+Ic', '/path/to/camera.lut'], expect.any(Object));
    });

    it('passes printer file and ambient light arguments', async () => {
        await dcmdspfn({ printerFile: '/path/to/printer.lut', ambientLight: 10 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdspfn', ['+Ip', '/path/to/printer.lut', '+Ca', '10'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmdspfn();

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read file', exitCode: 1 },
        });

        const result = await dcmdspfn({ monitorFile: '/bad/path.lut' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmdspfn failed');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmdspfn();

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmdspfn({ bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
