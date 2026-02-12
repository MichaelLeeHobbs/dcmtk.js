import { describe, it, expect, vi, afterEach } from 'vitest';
import { DcmtkProcess, ProcessState } from './DcmtkProcess';

// Use node itself as a cross-platform "binary" for testing

describe('DcmtkProcess', () => {
    const instances: DcmtkProcess[] = [];

    function createProcess(config: ConstructorParameters<typeof DcmtkProcess>[0]): DcmtkProcess {
        const proc = new DcmtkProcess(config);
        instances.push(proc);
        return proc;
    }

    afterEach(async () => {
        for (const proc of instances) {
            await proc.stop();
        }
        instances.length = 0;
    });

    describe('lifecycle', () => {
        it('starts in IDLE state', () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            expect(proc.currentState).toBe(ProcessState.IDLE);
            expect(proc.isRunning).toBe(false);
        });

        it('transitions to RUNNING after start', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            const result = await proc.start();

            expect(result.ok).toBe(true);
            expect(proc.isRunning).toBe(true);
            expect(proc.currentState).toBe(ProcessState.RUNNING);
        });

        it('transitions to STOPPED after stop', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            await proc.start();
            await proc.stop();

            expect(proc.isRunning).toBe(false);
            expect(proc.currentState).toBe(ProcessState.STOPPED);
        });

        it('rejects double start (single-use enforcement)', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            await proc.start();
            const result = await proc.start();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toMatch(/Cannot start/);
            }
        });

        it('stop() is safe to call multiple times', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            await proc.start();
            await proc.stop();
            await proc.stop(); // Should not throw
        });

        it('stop() is safe on idle process', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            await proc.stop(); // Should not throw
        });
    });

    describe('isStartedPredicate', () => {
        it('waits for predicate match before resolving start()', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>console.log("READY"),100);setTimeout(()=>{},5000)'],
                isStartedPredicate: line => line.includes('READY'),
                startTimeoutMs: 5000,
            });

            const result = await proc.start();

            expect(result.ok).toBe(true);
            expect(proc.isRunning).toBe(true);
        });

        it('times out if predicate never matches', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'console.log("NOT_THE_SIGNAL");setTimeout(()=>{},5000)'],
                isStartedPredicate: line => line.includes('READY'),
                startTimeoutMs: 300,
            });

            const result = await proc.start();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toMatch(/failed to start/);
            }
        });
    });

    describe('event emission', () => {
        it('emits "started" event on successful start', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            const startedSpy = vi.fn();
            proc.on('started', startedSpy);

            await proc.start();

            expect(startedSpy).toHaveBeenCalledOnce();
        });

        it('emits "stopped" event on stop', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            const stoppedSpy = vi.fn();
            proc.on('stopped', stoppedSpy);

            await proc.start();
            await proc.stop();

            expect(stoppedSpy).toHaveBeenCalledOnce();
        });

        it('emits "line" events for stdout output', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'console.log("LINE1");console.log("LINE2");setTimeout(()=>{},1000)'],
            });

            const lines: string[] = [];
            proc.on('line', ({ text }) => {
                lines.push(text);
            });

            await proc.start();

            // Wait for output to arrive (longer timeout for parallel test load)
            await new Promise(resolve => setTimeout(resolve, 1500));

            expect(lines).toContain('LINE1');
            expect(lines).toContain('LINE2');
        });

        it('emits "line" events for stderr output', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'console.error("ERR_LINE");setTimeout(()=>{},1000)'],
            });

            const lines: Array<{ source: string; text: string }> = [];
            proc.on('line', ({ source, text }) => {
                lines.push({ source, text });
            });

            await proc.start();
            await new Promise(resolve => setTimeout(resolve, 1500));

            const stderrLines = lines.filter(l => l.source === 'stderr');
            expect(stderrLines.some(l => l.text === 'ERR_LINE')).toBe(true);
        });
    });

    describe('error handling', () => {
        it('returns error for nonexistent binary', async () => {
            const proc = createProcess({
                binary: 'nonexistent_binary_xyz_12345',
                args: [],
                startTimeoutMs: 2000,
            });

            const result = await proc.start();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toMatch(/error/i);
            }
        });
    });

    describe('dispose', () => {
        it('cleans up via Symbol.dispose', async () => {
            const proc = createProcess({
                binary: process.execPath,
                args: ['-e', 'setTimeout(()=>{},5000)'],
            });

            await proc.start();
            expect(proc.isRunning).toBe(true);

            proc[Symbol.dispose]();

            expect(proc.currentState).toBe(ProcessState.STOPPED);
        });
    });
});
