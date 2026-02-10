import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dump2dcm } from './dump2dcm';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dump2dcm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dump2dcm()', () => {
    it('converts dump to DICOM', async () => {
        const result = await dump2dcm('/path/input.dump', '/path/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await dump2dcm('/path/input.dump', '/path/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dump2dcm',
            ['/path/input.dump', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +Ug flag for generateNewUIDs', async () => {
        await dump2dcm('/path/input.dump', '/path/output.dcm', { generateNewUIDs: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dump2dcm', ['+Ug', '/path/input.dump', '/path/output.dcm'], expect.any(Object));
    });

    it('passes -F flag for writeFileFormat', async () => {
        await dump2dcm('/path/input.dump', '/path/output.dcm', { writeFileFormat: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dump2dcm', ['-F', '/path/input.dump', '/path/output.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dump2dcm('/path/input.dump', '/path/output.dcm');

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

        const result = await dump2dcm('/path/input.dump', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dump2dcm failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dump2dcm('/path/input.dump', '/path/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dump2dcm('/path/input.dump', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dump2dcm('/path/input.dump', '/path/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dump2dcm', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
