import { describe, it, expect, vi, beforeEach } from 'vitest';
import { killTree } from './killTree';

vi.mock('tree-kill', () => ({ default: vi.fn() }));

const treeKill = vi.mocked((await import('tree-kill')).default) as unknown as ReturnType<typeof vi.fn>;

describe('killTree()', () => {
    beforeEach(() => {
        treeKill.mockReset();
    });

    it('resolves ok when the kill command succeeds', async () => {
        treeKill.mockImplementation((_pid: number, cb: (error?: Error) => void) => cb());

        const result = await killTree(1234);

        expect(result.ok).toBe(true);
        expect(treeKill).toHaveBeenCalledWith(1234, expect.any(Function));
    });

    it('surfaces the kill command error so a leftover process is explained', async () => {
        treeKill.mockImplementation((_pid: number, cb: (error?: Error) => void) => cb(new Error('Access is denied')));

        const result = await killTree(1234);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toBe('Access is denied');
    });

    it.skipIf(process.platform !== 'win32')('treats taskkill reporting the root as not found as success, since it is already gone', async () => {
        treeKill.mockImplementation((_pid: number, cb: (error?: Error) => void) => cb(Object.assign(new Error('not found'), { code: 128 })));

        const result = await killTree(1234);

        expect(result.ok).toBe(true);
    });

    it('gives up after the timeout when the kill command never finishes', async () => {
        treeKill.mockImplementation(() => {});

        const result = await killTree(1234, 20);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/did not finish within 20ms/);
    });
});
