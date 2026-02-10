import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcm2xml } from './dcm2xml';

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
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2xml' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_XML, stderr: '', exitCode: 0 },
    });
});

describe('dcm2xml()', () => {
    it('converts a DICOM file to XML', async () => {
        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toBe(SAMPLE_XML);
        }
    });

    it('passes input path as argument', async () => {
        await dcm2xml('/path/to/test.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['/path/to/test.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes +Xn flag when namespace is true', async () => {
        await dcm2xml('/path/to/test.dcm', { namespace: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['+Xn', '/path/to/test.dcm'], expect.any(Object));
    });

    it('passes charset flags', async () => {
        await dcm2xml('/path/to/test.dcm', { charset: 'latin1' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['+Cl', '/path/to/test.dcm'], expect.any(Object));
    });

    it('passes ASCII charset flag', async () => {
        await dcm2xml('/path/to/test.dcm', { charset: 'ascii' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['+Ca', '/path/to/test.dcm'], expect.any(Object));
    });

    it('passes binary data flags', async () => {
        await dcm2xml('/path/to/test.dcm', { writeBinaryData: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['+Wb', '+Eb', '/path/to/test.dcm'], expect.any(Object));
    });

    it('respects custom timeout', async () => {
        await dcm2xml('/path/to/test.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['/path/to/test.dcm'], expect.objectContaining({ timeoutMs: 5000 }));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot open file', exitCode: 1 },
        });

        const result = await dcm2xml('/path/to/nonexistent.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcm2xml failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot open file');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcm2xml('/path/to/test.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcm2xml('/path/to/test.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcm2xml', ['/path/to/test.dcm'], expect.objectContaining({ signal: controller.signal }));
    });
});
