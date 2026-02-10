import { describe, it, expect } from 'vitest';
import { getscu } from '../../../src/tools/getscu';
import { dcmtkAvailable, getAvailablePort } from '../helpers';

describe.skipIf(!dcmtkAvailable)('getscu integration', () => {
    it('returns error when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await getscu({
            host: '127.0.0.1',
            port,
            queryModel: 'study',
            keys: ['0020,000D=1.2.3.4'],
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });
});
