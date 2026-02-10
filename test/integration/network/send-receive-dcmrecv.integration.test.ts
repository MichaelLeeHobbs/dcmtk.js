import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { Dcmrecv } from '../../../src/servers/Dcmrecv';
import { storescu } from '../../../src/tools/storescu';
import { dcmsend } from '../../../src/tools/dcmsend';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, getAvailablePort, createTempDir, removeTempDir, withServer, waitForEvent } from '../helpers';
import type { StoredFileData } from '../../../src/events/dcmrecv';

const CONFIG_FILE = resolve(__dirname, '../../../_configs/storescp.cfg');
const CONFIG_PROFILE = 'Default';

describe.skipIf(!dcmtkAvailable)('send/receive via Dcmrecv integration', () => {
    const servers: Dcmrecv[] = [];
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
        tempDir = await createTempDir('dcmrecv-send-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({
            port,
            outputDirectory: tempDir,
            configFile: CONFIG_FILE,
            configProfile: CONFIG_PROFILE,
        });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            const storedPromise = waitForEvent<StoredFileData>(server, 'STORED_FILE', 30_000);

            const sendResult = await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });
            expect(sendResult.ok).toBe(true);

            const storedEvent = await storedPromise;
            expect(storedEvent.filePath).toBeDefined();
            expect(storedEvent.filePath.length).toBeGreaterThan(0);
        });
    });

    it('dcmsend sends a file successfully', async () => {
        tempDir = await createTempDir('dcmrecv-dcmsend-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({
            port,
            outputDirectory: tempDir,
            configFile: CONFIG_FILE,
            configProfile: CONFIG_PROFILE,
        });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            const storedPromise = waitForEvent<StoredFileData>(server, 'STORED_FILE', 30_000);

            const sendResult = await dcmsend({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });
            expect(sendResult.ok).toBe(true);

            const storedEvent = await storedPromise;
            expect(storedEvent.filePath.length).toBeGreaterThan(0);
        });
    });

    it('ASSOCIATION_RELEASE event fires after transfer', async () => {
        tempDir = await createTempDir('dcmrecv-release-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({
            port,
            outputDirectory: tempDir,
            configFile: CONFIG_FILE,
            configProfile: CONFIG_PROFILE,
        });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            const releasePromise = waitForEvent(server, 'ASSOCIATION_RELEASE', 30_000);

            await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });

            await releasePromise;
        });
    });

    it('received file metadata matches original', async () => {
        tempDir = await createTempDir('dcmrecv-metadata-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({
            port,
            outputDirectory: tempDir,
            configFile: CONFIG_FILE,
            configProfile: CONFIG_PROFILE,
        });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            const storedPromise = waitForEvent<StoredFileData>(server, 'STORED_FILE', 30_000);

            await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 30_000,
            });

            const storedEvent = await storedPromise;

            // Read metadata from received file
            const receivedJson = await dcm2json(storedEvent.filePath);
            const originalJson = await dcm2json(SAMPLES.OTHER_0002D);

            expect(receivedJson.ok).toBe(true);
            expect(originalJson.ok).toBe(true);

            if (receivedJson.ok && originalJson.ok) {
                // SOP Instance UID should match
                const origUID = originalJson.value.data['00080018'];
                const recvUID = receivedJson.value.data['00080018'];
                expect(recvUID).toBeDefined();
                if (origUID !== undefined && recvUID !== undefined) {
                    expect(recvUID.Value).toEqual(origUID.Value);
                }
            }
        });
    });
});
