import { describe, it, expect } from 'vitest';
import { termscu } from '../../../src/tools/termscu';
import { dcmtkAvailable, getAvailablePort } from '../helpers';

describe.skipIf(!dcmtkAvailable)('termscu integration', () => {
    it('returns error when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await termscu({
            host: '127.0.0.1',
            port,
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });

    it('returns error with custom AE titles when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await termscu({
            host: '127.0.0.1',
            port,
            callingAETitle: 'MYTERM',
            calledAETitle: 'REMOTE',
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid options', async () => {
        const result = await termscu({
            host: '',
            port: 104,
        });
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid port', async () => {
        const result = await termscu({
            host: '127.0.0.1',
            port: 0,
        });
        expect(result.ok).toBe(false);
    });

    it('returns error for port out of range', async () => {
        const result = await termscu({
            host: '127.0.0.1',
            port: 99999,
        });
        expect(result.ok).toBe(false);
    });
});
