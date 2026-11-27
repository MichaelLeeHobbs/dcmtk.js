import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { join } from 'node:path';
import { DicomSend, StoreSCP, findDcmtkPath } from '../../../src';
import { createTempDir, dcmtkAvailable, getAvailablePort, removeTempDir, SAMPLES } from '../helpers';
import { killDcmtkProcessesOnPort, waitForDcmtkProcess, waitForNoDcmtkProcesses } from '../helpers/dcmtkProcesses';

const isWindows = process.platform === 'win32';
const chocolateyRoot = process.env['ChocolateyInstall'] ?? 'C:\\ProgramData\\chocolatey';
const chocolateyDcmtk = join(chocolateyRoot, 'lib', 'dcmtk');

// Regression suite for #56: no DCMTK process may outlive the stop, abort or host exit that should end it.
describe.skipIf(!dcmtkAvailable)('no orphaned DCMTK processes', () => {
    const cleanups: (() => Promise<void> | void)[] = [];

    afterEach(async () => {
        for (const cleanup of cleanups.reverse()) await cleanup();
        cleanups.length = 0;
    });

    it.skipIf(!isWindows || !existsSync(chocolateyDcmtk))('resolves past the Chocolatey shim folder', () => {
        const found = findDcmtkPath({ noCache: true });

        expect(found.ok).toBe(true);
        if (found.ok) expect(found.value.toLowerCase()).not.toBe(join(chocolateyRoot, 'bin').toLowerCase());
    });

    it('StoreSCP.stop() leaves no storescp running', async () => {
        const port = await getAvailablePort();
        const dir = await createTempDir('orphans-stop-');
        cleanups.push(
            () => removeTempDir(dir),
            () => killDcmtkProcessesOnPort('storescp', port)
        );
        const created = StoreSCP.create({ port, outputDirectory: dir });
        if (!created.ok) throw created.error;

        expect((await created.value.start()).ok).toBe(true);
        await created.value.stop();

        expect(await waitForNoDcmtkProcesses('storescp', port)).toEqual([]);
    });

    it('DicomSend.stop() during an in-flight send leaves no dcmsend running', async () => {
        const port = await getAvailablePort();
        cleanups.push(() => killDcmtkProcessesOnPort('dcmsend', port));
        const silentPeer = await listenWithoutAnswering(port);
        cleanups.push(() => silentPeer.close());
        const created = DicomSend.create({ host: '127.0.0.1', port, calledAETitle: 'SILENT', associationTimeout: 60, acseTimeout: 60 });
        if (!created.ok) throw created.error;

        const sending = created.value.send([SAMPLES.MR_BRAIN], { timeoutMs: 60_000, maxRetries: 0 });
        await silentPeer.connected;
        await created.value.stop();
        await sending;

        expect(await waitForNoDcmtkProcesses('dcmsend', port)).toEqual([]);
    });

    // POSIX has no equivalent of the Windows job object Node puts children in, so a child outliving a killed
    // parent there is expected and out of scope.
    it.skipIf(!isWindows)('killing the host process leaves no storescp running', async () => {
        const port = await getAvailablePort();
        const dir = await createTempDir('orphans-host-');
        cleanups.push(
            () => removeTempDir(dir),
            () => killDcmtkProcessesOnPort('storescp', port)
        );
        const host = spawn(process.execPath, ['--import', 'tsx', join(__dirname, '../fixtures/storescpHost.ts'), String(port), dir], {
            stdio: ['ignore', 'pipe', 'inherit'],
            windowsHide: true,
        });
        cleanups.push(() => void host.kill());

        await new Promise<void>((resolve, reject) => {
            host.stdout.on('data', (chunk: Buffer) => {
                if (chunk.toString().includes('ready')) resolve();
            });
            host.once('exit', code => reject(new Error(`host exited early with code ${String(code)}`)));
        });
        // start() resolves when the process spawns; behind a launcher the real storescp appears a moment later,
        // and killing the host before then would pass without testing anything.
        expect(await waitForDcmtkProcess('storescp', port)).not.toEqual([]);
        host.kill();

        expect(await waitForNoDcmtkProcesses('storescp', port)).toEqual([]);
    });
});

/** A TCP listener that accepts connections and never speaks DICOM, so a sender stays mid-association. */
async function listenWithoutAnswering(port: number): Promise<{ connected: Promise<void>; close: () => Promise<void> }> {
    const sockets: Socket[] = [];
    let onConnect: () => void = () => {};
    const connected = new Promise<void>(resolve => {
        onConnect = resolve;
    });
    const server = createServer(socket => {
        socket.on('error', () => {});
        sockets.push(socket);
        onConnect();
    });
    await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
    const close = (): Promise<void> => {
        for (const socket of sockets) socket.destroy();
        return new Promise(resolve => server.close(() => resolve()));
    };
    return { connected, close };
}
