import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { findDcmtkPath, clearDcmtkPathCache } from './findDcmtkPath';
import { REQUIRED_BINARIES, WINDOWS_SEARCH_PATHS, UNIX_SEARCH_PATHS } from './constants';

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
}));

const fs = await import('node:fs');

const cp = await import('node:child_process');

const mockExistsSync = vi.mocked(fs.existsSync);
const mockExecSync = vi.mocked(cp.execSync);

const isWindows = process.platform === 'win32';
const searchPaths = isWindows ? WINDOWS_SEARCH_PATHS : UNIX_SEARCH_PATHS;
const ext = isWindows ? '.exe' : '';

describe('findDcmtkPath', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        clearDcmtkPathCache();
        vi.clearAllMocks();
        delete process.env['DCMTK_PATH'];
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('DCMTK_PATH env override', () => {
        it('returns the env path when all binaries exist', () => {
            process.env['DCMTK_PATH'] = '/opt/dcmtk/bin';
            mockExistsSync.mockReturnValue(true);

            const result = findDcmtkPath({ noCache: true });

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('/opt/dcmtk/bin');
        });

        it('returns error when env path is set but binaries missing', () => {
            process.env['DCMTK_PATH'] = '/bad/path';
            mockExistsSync.mockReturnValue(false);

            const result = findDcmtkPath({ noCache: true });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toMatch(/DCMTK_PATH/);
        });
    });

    describe('platform search paths', () => {
        it('finds DCMTK in a known platform location', () => {
            const targetDir = searchPaths[0];

            mockExistsSync.mockImplementation((p: unknown) => {
                const pathStr = String(p);
                // Only return true for binaries in the first known search path
                return REQUIRED_BINARIES.some(bin => pathStr === join(targetDir, `${bin}${ext}`));
            });

            const result = findDcmtkPath({ noCache: true });

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe(targetDir);
        });
    });

    describe('system PATH lookup', () => {
        it('finds DCMTK via which/where', () => {
            const systemBinDir = isWindows ? 'C:\\dcmtk\\bin' : '/usr/local/dcmtk/bin';
            const firstBinary = `${REQUIRED_BINARIES[0]}${ext}`;

            // All known platform paths fail
            mockExistsSync.mockImplementation((p: unknown) => {
                const pathStr = String(p);
                return pathStr.startsWith(systemBinDir);
            });
            mockExecSync.mockReturnValue(`${join(systemBinDir, firstBinary)}\n`);

            const result = findDcmtkPath({ noCache: true });

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe(systemBinDir);
        });

        it('returns error when DCMTK not found anywhere', () => {
            mockExistsSync.mockReturnValue(false);
            mockExecSync.mockImplementation(() => {
                throw new Error('not found');
            });

            const result = findDcmtkPath({ noCache: true });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toMatch(/DCMTK binaries not found/);
        });
    });

    describe('REQUIRED_BINARIES constant', () => {
        it('is non-empty', () => {
            expect(REQUIRED_BINARIES.length).toBeGreaterThan(0);
        });

        it('first element is a known binary', () => {
            expect(REQUIRED_BINARIES[0]).toBeDefined();
            expect(typeof REQUIRED_BINARIES[0]).toBe('string');
        });
    });

    describe('caching', () => {
        it('caches the result after first successful call', () => {
            process.env['DCMTK_PATH'] = '/cached/path';
            mockExistsSync.mockReturnValue(true);

            const first = findDcmtkPath();
            expect(first.ok).toBe(true);

            mockExistsSync.mockReturnValue(false);
            delete process.env['DCMTK_PATH'];

            const second = findDcmtkPath();
            expect(second.ok).toBe(true);
            if (second.ok) expect(second.value).toBe('/cached/path');
        });

        it('bypasses cache with noCache option', () => {
            process.env['DCMTK_PATH'] = '/first/path';
            mockExistsSync.mockReturnValue(true);
            findDcmtkPath();

            process.env['DCMTK_PATH'] = '/second/path';
            const result = findDcmtkPath({ noCache: true });

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('/second/path');
        });
    });
});
