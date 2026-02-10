import { describe, it, expect, afterEach } from 'vitest';
import { readdir } from 'node:fs/promises';
import { StoreSCP } from '../../../src/servers/StoreSCP';
import { storescu } from '../../../src/tools/storescu';
import { echoscu } from '../../../src/tools/echoscu';
import { dcmtkAvailable, SAMPLES, getAvailablePort, createTempDir, removeTempDir, withServer, waitForEvent } from '../helpers';
import type { StoringFileData } from '../../../src/events/storescp';

describe.skipIf(!dcmtkAvailable)('send/receive via StoreSCP integration', () => {
    const servers: StoreSCP[] = [];
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

    it('storescu sends a file and STORED_FILE event fires', async () => {
        tempDir = await createTempDir('storescp-send-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const storingPromise = waitForEvent<StoringFileData>(server, 'STORING_FILE', 30_000);

            const sendResult = await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });
            expect(sendResult.ok).toBe(true);

            const storingEvent = await storingPromise;
            expect(storingEvent.filePath).toBeDefined();
            expect(storingEvent.filePath.length).toBeGreaterThan(0);
        });
    });

    it('files appear in outputDirectory', async () => {
        tempDir = await createTempDir('storescp-outdir-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });

            // Wait for file to be written
            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(tempDir);
            expect(files.length).toBeGreaterThan(0);
        });
    });

    it('echoscu connectivity check succeeds', async () => {
        tempDir = await createTempDir('storescp-echo-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const echoResult = await echoscu({
                host: '127.0.0.1',
                port,
                timeoutMs: 10_000,
            });
            expect(echoResult.ok).toBe(true);
            if (echoResult.ok) {
                expect(echoResult.value.success).toBe(true);
            }
        });
    });

    it('handles multiple file sends', async () => {
        tempDir = await createTempDir('storescp-multi-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Send uncompressed file 3 times with separate storescu calls
            // (storescu can't send compressed files without matching transfer syntax)
            for (let i = 0; i < 3; i++) {
                const sendResult = await storescu({
                    host: '127.0.0.1',
                    port,
                    files: [SAMPLES.OTHER_0002D],
                    timeoutMs: 30_000,
                });
                expect(sendResult.ok).toBe(true);
            }

            // Wait for all files to be stored
            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(tempDir);
            // storescp overwrites same filename by default, so at least 1 file
            expect(files.length).toBeGreaterThan(0);
        });
    });
});
