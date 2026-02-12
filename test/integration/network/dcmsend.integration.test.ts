import { describe, it, expect, afterEach } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { StoreSCP } from '../../../src/servers/StoreSCP';
import { dcmsend } from '../../../src/tools/dcmsend';
import { dcmtkAvailable, SAMPLES, getAvailablePort, createTempDir, removeTempDir, withServer, waitForEvent, copyDicomToTemp } from '../helpers';
import type { StoringFileData } from '../../../src/events/storescp';

describe.skipIf(!dcmtkAvailable)('dcmsend integration', () => {
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

    it('sends a single file to StoreSCP', async () => {
        tempDir = await createTempDir('dcmsend-single-');
        const outputDir = join(tempDir, 'output');
        const { mkdir } = await import('node:fs/promises');
        await mkdir(outputDir);

        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: outputDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await dcmsend({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(outputDir);
            expect(files.length).toBeGreaterThan(0);
        });
    });

    it('fires STORING_FILE event on server side', async () => {
        tempDir = await createTempDir('dcmsend-event-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const storingPromise = waitForEvent<StoringFileData>(server, 'STORING_FILE', 30_000);

            const result = await dcmsend({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);

            const storingEvent = await storingPromise;
            expect(storingEvent.filePath).toBeDefined();
            expect(storingEvent.filePath.length).toBeGreaterThan(0);
        });
    });

    it('sends with custom AE titles', async () => {
        tempDir = await createTempDir('dcmsend-ae-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir, aeTitle: 'TESTSCP' });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await dcmsend({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                callingAETitle: 'MYSCU',
                calledAETitle: 'TESTSCP',
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
        });
    });

    it('sends with scanDirectory', async () => {
        tempDir = await createTempDir('dcmsend-scan-');
        const inputDir = join(tempDir, 'input');
        const outputDir = join(tempDir, 'output');
        const { mkdir } = await import('node:fs/promises');
        await mkdir(inputDir);
        await mkdir(outputDir);

        await copyDicomToTemp(SAMPLES.OTHER_0002D, inputDir, 'scan1.dcm');

        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: outputDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await dcmsend({
                host: '127.0.0.1',
                port,
                files: [inputDir],
                scanDirectory: true,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(outputDir);
            expect(files.length).toBeGreaterThan(0);
        });
    });

    it('returns error when no server is running', async () => {
        const port = await getAvailablePort();
        const result = await dcmsend({
            host: '127.0.0.1',
            port,
            files: [SAMPLES.OTHER_0002D],
            timeoutMs: 5_000,
        });
        expect(result.ok).toBe(false);
    });
});
