import { describe, it, expect, afterEach } from 'vitest';
import { StoreSCP } from '../../../src/servers/StoreSCP';
import { Dcmrecv } from '../../../src/servers/Dcmrecv';
import { echoscu } from '../../../src/tools/echoscu';
import { dcmtkAvailable, getAvailablePort, createTempDir, removeTempDir, withServer } from '../helpers';
import type { DcmtkProcess } from '../../../src/DcmtkProcess';

describe.skipIf(!dcmtkAvailable)('echoscu integration', () => {
    const servers: DcmtkProcess[] = [];
    let tempDir: string;

    afterEach(async () => {
        for (const server of servers) {
            try {
                await server.stop();
            } catch {
                /* already stopped */
            }
        }
        servers.length = 0;
        if (tempDir !== undefined) {
            await removeTempDir(tempDir);
        }
    });

    it('succeeds against StoreSCP', async () => {
        tempDir = await createTempDir('echo-storescp-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await echoscu({ host: '127.0.0.1', port, timeoutMs: 10_000 });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.success).toBe(true);
            }
        });
    });

    it('succeeds against Dcmrecv', async () => {
        tempDir = await createTempDir('echo-dcmrecv-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            const result = await echoscu({ host: '127.0.0.1', port, timeoutMs: 10_000 });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.success).toBe(true);
            }
        });
    });

    it('fails when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await echoscu({ host: '127.0.0.1', port, timeoutMs: 5_000 });
        expect(result.ok).toBe(false);
    });

    it('works with custom AE titles', async () => {
        tempDir = await createTempDir('echo-ae-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir, aeTitle: 'TESTAE' });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await echoscu({
                host: '127.0.0.1',
                port,
                callingAETitle: 'MYAE',
                calledAETitle: 'TESTAE',
                timeoutMs: 10_000,
            });
            expect(result.ok).toBe(true);
        });
    });
});
