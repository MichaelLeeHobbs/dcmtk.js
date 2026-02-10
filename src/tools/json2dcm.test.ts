import { describe, it, expect, vi, beforeEach } from 'vitest';
import { json2dcm } from './json2dcm';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/json2dcm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('json2dcm()', () => {
    it('converts JSON to DICOM', async () => {
        const result = await json2dcm('/path/input.json', '/path/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await json2dcm('/path/input.json', '/path/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/json2dcm',
            ['/path/input.json', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await json2dcm('/path/input.json', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot convert', exitCode: 1 },
        });

        const result = await json2dcm('/path/input.json', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('json2dcm failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await json2dcm('/path/input.json', '/path/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await json2dcm('/path/input.json', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await json2dcm('/path/input.json', '/path/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/json2dcm', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });

    it('forwards abort signal', async () => {
        const controller = new AbortController();
        await json2dcm('/path/input.json', '/path/output.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/json2dcm', expect.any(Array), expect.objectContaining({ signal: controller.signal }));
    });
});
