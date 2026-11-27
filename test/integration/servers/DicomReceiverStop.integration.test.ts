import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DicomReceiver, dump2dcm } from '../../../src';
import { resolveBinary } from '../../../src/tools/_resolveBinary';
import { createTempDir, dcmtkAvailable, getAvailablePort, removeTempDir } from '../helpers';

const CONFIG_FILE = resolve(__dirname, '../../../src/data/storescp.cfg');
const INSTANCE_COUNT = 300;
const STOP_AFTER_ACKS = 20;
const WORKER_WARMUP_MS = 3000;

const DUMP = ['(0008,0016) UI [1.2.840.10008.5.1.4.1.1.7]', '(0008,0060) CS [OT]', '(0010,0010) PN [STOP^TEST]', '(0010,0020) LO [ISSUE53]', ''].join('\n');

interface SendRun {
    readonly acks: () => number;
    readonly output: () => string;
    readonly exited: Promise<void>;
}

/** Runs storescu over a folder, counting successful C-STORE-RSPs as they are logged. */
function sendFolder(port: number, folder: string, onAck: (count: number) => void): SendRun {
    const binary = resolveBinary('storescu');
    if (!binary.ok) throw binary.error;
    const child = spawn(binary.value, ['-v', '-aec', 'DCMRECV', '+sd', '127.0.0.1', String(port), folder]);
    let acks = 0;
    let pending = '';
    const tail: string[] = [];
    const onData = (chunk: Buffer): void => {
        pending += chunk.toString();
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        for (const line of lines) {
            tail.push(line);
            if (tail.length > 20) tail.shift();
            if (/Received Store Response \(Success\)/.test(line)) {
                acks++;
                onAck(acks);
            }
        }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const exited = new Promise<void>(res => child.once('close', () => res()));
    return { acks: () => acks, output: () => tail.join('\n'), exited };
}

async function countFiles(storageDir: string): Promise<number> {
    let total = 0;
    for (const name of await readdir(storageDir)) {
        total += (await readdir(join(storageDir, name))).length;
    }
    return total;
}

describe.skipIf(!dcmtkAvailable)('DicomReceiver.stop() mid-association (#53)', () => {
    let workDir: string | undefined;
    let receiver: DicomReceiver | undefined;

    afterEach(async () => {
        await receiver?.stop();
        receiver = undefined;
        if (workDir !== undefined) await removeTempDir(workDir);
        workDir = undefined;
    });

    it('emits and keeps every instance storescu was told was stored', async () => {
        workDir = await createTempDir('recv-stop53-');
        const sendDir = join(workDir, 'send');
        const storageDir = join(workDir, 'storage');
        await mkdir(sendDir);
        await writeFile(join(workDir, 'one.dump'), DUMP, 'utf8');
        const seed = join(workDir, 'one.dcm');
        const written = await dump2dcm(join(workDir, 'one.dump'), seed, { generateNewUIDs: true, writeFileFormat: true });
        expect(written.ok).toBe(true);
        for (let i = 0; i < INSTANCE_COUNT; i++) {
            await copyFile(seed, join(sendDir, `img${String(i).padStart(4, '0')}.dcm`));
        }

        const port = await getAvailablePort();
        const created = DicomReceiver.create({ port, storageDir, minPoolSize: 1, maxPoolSize: 1, configFile: CONFIG_FILE, configProfile: 'Default' });
        if (!created.ok) throw created.error;
        receiver = created.value;
        let stored = 0;
        let instances = 0;
        const errors: string[] = [];
        receiver.onFileStored(() => stored++);
        receiver.onInstanceReceived(() => instances++);
        receiver.onEvent('INSTANCE_ERROR', () => instances++);
        receiver.onEvent('error', data => errors.push(data.error.message));
        expect((await receiver.start()).ok).toBe(true);
        await new Promise(r => setTimeout(r, WORKER_WARMUP_MS));

        let stopping: Promise<void> | undefined;
        const active = receiver;
        const run = sendFolder(port, sendDir, count => {
            if (count === STOP_AFTER_ACKS) stopping = active.stop();
        });
        await run.exited;
        expect(stopping, run.output()).toBeDefined();
        await stopping;

        const acked = run.acks();
        expect(acked).toBeGreaterThanOrEqual(STOP_AFTER_ACKS);
        expect(acked).toBeLessThan(INSTANCE_COUNT);
        expect(errors).toEqual([]);
        expect(stored).toBeGreaterThanOrEqual(acked);
        expect(instances).toBe(stored);
        expect(await countFiles(storageDir)).toBe(stored);
    }, 120_000);
});
