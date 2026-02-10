import { describe, it, expect, vi, beforeEach } from 'vitest';
import { xml2dsr } from './xml2dsr';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/xml2dsr' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('xml2dsr()', () => {
    it('converts XML to DICOM SR', async () => {
        const result = await xml2dsr('/path/input.xml', '/path/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await xml2dsr('/path/input.xml', '/path/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/xml2dsr',
            ['/path/input.xml', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +Ug flag for generateNewUIDs', async () => {
        await xml2dsr('/path/input.xml', '/path/output.dcm', { generateNewUIDs: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/xml2dsr', ['+Ug', '/path/input.xml', '/path/output.dcm'], expect.any(Object));
    });

    it('passes +Vd flag for validateDocument', async () => {
        await xml2dsr('/path/input.xml', '/path/output.dcm', { validateDocument: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/xml2dsr', ['+Vd', '/path/input.xml', '/path/output.dcm'], expect.any(Object));
    });

    it('passes both flags together', async () => {
        await xml2dsr('/path/input.xml', '/path/output.dcm', { generateNewUIDs: true, validateDocument: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/xml2dsr', ['+Ug', '+Vd', '/path/input.xml', '/path/output.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await xml2dsr('/path/input.xml', '/path/output.dcm');

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

        const result = await xml2dsr('/path/input.xml', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('xml2dsr failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await xml2dsr('/path/input.xml', '/path/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await xml2dsr('/path/input.xml', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await xml2dsr('/path/input.xml', '/path/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/xml2dsr', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
