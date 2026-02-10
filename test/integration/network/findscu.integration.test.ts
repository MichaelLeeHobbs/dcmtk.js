import { describe, it, expect } from 'vitest';
import { findscu } from '../../../src/tools/findscu';
import { dcmtkAvailable, getAvailablePort } from '../helpers';

describe.skipIf(!dcmtkAvailable)('findscu integration', () => {
    it('returns error when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await findscu({
            host: '127.0.0.1',
            port,
            queryModel: 'study',
            keys: ['0008,0050='],
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid host', async () => {
        const result = await findscu({
            host: '192.0.2.1', // TEST-NET, should be unreachable
            port: 104,
            queryModel: 'study',
            keys: ['0008,0050='],
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });
});
