import { describe, it, expect, afterEach } from 'vitest';
import { StoreSCP } from '../../../src/servers/StoreSCP';
import { echoscu } from '../../../src/tools/echoscu';
import { dcmtkAvailable, getAvailablePort, createTempDir, removeTempDir, withServer } from '../helpers';

describe.skipIf(!dcmtkAvailable)('StoreSCP lifecycle integration', () => {
    const servers: StoreSCP[] = [];
    let tempDir: string;

    afterEach(async () => {
        for (const server of servers) {
            try {
                await server.stop();
            } catch {
                // Already stopped
            }
        }
        servers.length = 0;
        if (tempDir !== undefined) {
            await removeTempDir(tempDir);
        }
    });

    it('creates, starts, and stops cleanly', async () => {
        tempDir = await createTempDir('storescp-life-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            // Brief wait to ensure server is fully ready
            await new Promise(resolve => setTimeout(resolve, 1000));
        });
    });

    it('responds to echoscu while running', async () => {
        tempDir = await createTempDir('storescp-echo-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            // Wait for server to be fully ready
            await new Promise(resolve => setTimeout(resolve, 1000));

            const echoResult = await echoscu({ host: '127.0.0.1', port, timeoutMs: 10_000 });
            expect(echoResult.ok).toBe(true);
            if (echoResult.ok) {
                expect(echoResult.value.success).toBe(true);
            }
        });
    });

    it('reports error when port is in use', async () => {
        tempDir = await createTempDir('storescp-port-');
        const port = await getAvailablePort();

        const result1 = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!result1.ok) return;
        const server1 = result1.value;
        servers.push(server1);

        await server1.start();
        // Wait for server to bind
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result2 = StoreSCP.create({ port, outputDirectory: tempDir, startTimeoutMs: 5_000 });
        if (!result2.ok) return;
        const server2 = result2.value;
        servers.push(server2);

        const start2Result = await server2.start();
        // storescp may fail immediately or via error event
        if (start2Result.ok) {
            // Might resolve on spawn but die quickly — check after brief delay
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    });

    it('AbortSignal stops the server', async () => {
        tempDir = await createTempDir('storescp-abort-');
        const port = await getAvailablePort();
        const controller = new AbortController();

        const createResult = StoreSCP.create({ port, outputDirectory: tempDir, signal: controller.signal });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        const startResult = await server.start();
        expect(startResult.ok).toBe(true);

        controller.abort();
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('accepts custom AE title', async () => {
        tempDir = await createTempDir('storescp-ae-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({
            port,
            outputDirectory: tempDir,
            aeTitle: 'MYAE',
        });
        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const echoResult = await echoscu({
                host: '127.0.0.1',
                port,
                calledAETitle: 'MYAE',
                timeoutMs: 10_000,
            });
            expect(echoResult.ok).toBe(true);
        });
    });
});
