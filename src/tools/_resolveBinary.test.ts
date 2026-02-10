import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveBinary } from './_resolveBinary';

vi.mock('../findDcmtkPath', () => ({
    findDcmtkPath: vi.fn(),
}));

import { findDcmtkPath } from '../findDcmtkPath';

const mockedFindDcmtkPath = vi.mocked(findDcmtkPath);
const isWindows = process.platform === 'win32';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('resolveBinary()', () => {
    it('returns full path to the binary when DCMTK is found', () => {
        mockedFindDcmtkPath.mockReturnValue({ ok: true, value: '/usr/local/bin' });

        const result = resolveBinary('dcm2xml');

        expect(result.ok).toBe(true);
        if (result.ok) {
            if (isWindows) {
                expect(result.value).toContain('dcm2xml.exe');
            } else {
                expect(result.value).toBe('/usr/local/bin/dcm2xml');
            }
        }
    });

    it('returns error when DCMTK is not found', () => {
        mockedFindDcmtkPath.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = resolveBinary('dcm2xml');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('appends .exe on Windows', () => {
        mockedFindDcmtkPath.mockReturnValue({ ok: true, value: 'C:\\Program Files\\DCMTK\\bin' });

        const result = resolveBinary('dcmdump');

        expect(result.ok).toBe(true);
        if (result.ok) {
            if (isWindows) {
                expect(result.value).toContain('dcmdump.exe');
            } else {
                expect(result.value).toContain('dcmdump');
                expect(result.value).not.toContain('.exe');
            }
        }
    });
});
