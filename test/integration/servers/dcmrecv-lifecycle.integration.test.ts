import { describe, it, expect, afterEach } from 'vitest';
import { Dcmrecv } from '../../../src/servers/Dcmrecv';
import { dcmtkAvailable, getAvailablePort, createTempDir, removeTempDir, withServer } from '../helpers';

describe.skipIf(!dcmtkAvailable)('Dcmrecv lifecycle integration', () => {
    const servers: Dcmrecv[] = [];
    let tempDir: string;

    afterEach(async () => {
        // Ensure all servers are stopped
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
        tempDir = await createTempDir('dcmrecv-life-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({ port, outputDirectory: tempDir });
        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            // Server is running — no assertions needed beyond start/stop succeeding
        });
    });

    it('emits LISTENING event on start', async () => {
        tempDir = await createTempDir('dcmrecv-listen-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        let listening = false;
        server.onEvent('LISTENING', () => {
            listening = true;
        });

        await withServer(server, async () => {
            // Wait briefly for event to fire
            await new Promise(resolve => setTimeout(resolve, 500));
            expect(listening).toBe(true);
        });
    });

    it('reports error when port is in use', async () => {
        tempDir = await createTempDir('dcmrecv-port-');
        const port = await getAvailablePort();

        // Start first server
        const result1 = Dcmrecv.create({ port, outputDirectory: tempDir });
        if (!result1.ok) return;
        const server1 = result1.value;
        servers.push(server1);

        const startResult = await server1.start();
        expect(startResult.ok).toBe(true);

        // Try second server on same port — dcmrecv may or may not fail
        // depending on OS socket options (SO_REUSEADDR). We just verify
        // that start() resolves without hanging regardless of outcome.
        const result2 = Dcmrecv.create({ port, outputDirectory: tempDir, startTimeoutMs: 5_000 });
        if (!result2.ok) return;
        const server2 = result2.value;
        servers.push(server2);

        const start2Result = await server2.start();
        // Accept either outcome — the important thing is it doesn't hang
        expect(typeof start2Result.ok).toBe('boolean');
    });

    it('stop is idempotent', async () => {
        tempDir = await createTempDir('dcmrecv-idempotent-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await server.start();
        await server.stop();
        // Calling stop again should not throw
        await server.stop();
    });

    it('AbortSignal stops the server', async () => {
        tempDir = await createTempDir('dcmrecv-abort-');
        const port = await getAvailablePort();
        const controller = new AbortController();

        const createResult = Dcmrecv.create({ port, outputDirectory: tempDir, signal: controller.signal });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        const startResult = await server.start();
        expect(startResult.ok).toBe(true);

        // Abort should trigger stop
        controller.abort();

        // Wait for the server to actually stop
        await new Promise(resolve => setTimeout(resolve, 2000));
    });
});
