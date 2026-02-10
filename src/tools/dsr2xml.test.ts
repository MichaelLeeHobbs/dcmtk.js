import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dsr2xml } from './dsr2xml';

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

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<report>
  <document>
    <title>Chest X-Ray Report</title>
  </document>
</report>`;

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dsr2xml' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_XML, stderr: '', exitCode: 0 },
    });
});

describe('dsr2xml()', () => {
    it('converts DICOM SR to XML', async () => {
        const result = await dsr2xml('/path/to/report.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe(SAMPLE_XML);
        }
    });

    it('passes input path as argument', async () => {
        await dsr2xml('/path/to/report.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsr2xml', ['/path/to/report.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes +Xn flag for useNamespace', async () => {
        await dsr2xml('/path/to/report.dcm', { useNamespace: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsr2xml', ['+Xn', '/path/to/report.dcm'], expect.any(Object));
    });

    it('passes +Xs flag for addSchemaRef', async () => {
        await dsr2xml('/path/to/report.dcm', { addSchemaRef: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsr2xml', ['+Xs', '/path/to/report.dcm'], expect.any(Object));
    });

    it('passes both flags together', async () => {
        await dsr2xml('/path/to/report.dcm', { useNamespace: true, addSchemaRef: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsr2xml', ['+Xn', '+Xs', '/path/to/report.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dsr2xml('/path/to/report.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read SR document', exitCode: 1 },
        });

        const result = await dsr2xml('/path/to/nonexistent.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dsr2xml failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dsr2xml('/path/to/report.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dsr2xml('/path/to/report.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dsr2xml('/path/to/report.dcm', { timeoutMs: 10000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsr2xml', expect.any(Array), expect.objectContaining({ timeoutMs: 10000 }));
    });
});
