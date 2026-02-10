import { describe, it, expect } from 'vitest';
import { movescu } from '../../../src/tools/movescu';
import { dcmtkAvailable, getAvailablePort } from '../helpers';

describe.skipIf(!dcmtkAvailable)('movescu integration', () => {
    it('returns error when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await movescu({
            host: '127.0.0.1',
            port,
            queryModel: 'study',
            keys: ['0020,000D=1.2.3.4'],
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });
});
