import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dcmrecv } from './Dcmrecv';

vi.mock('../tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { resolveBinary } from '../tools/_resolveBinary';

const mockedResolveBinary = vi.mocked(resolveBinary);

describe('Dcmrecv', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmrecv' });
    });

    describe('create()', () => {
        it('returns ok with valid options', () => {
            const result = Dcmrecv.create({ port: 11112 });

            expect(result.ok).toBe(true);
        });

        it('returns error for invalid port', () => {
            const result = Dcmrecv.create({ port: 0 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error for port out of range', () => {
            const result = Dcmrecv.create({ port: 70000 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error when binary not found', () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = Dcmrecv.create({ port: 11112 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('rejects unknown options via strict schema', () => {
            const result = Dcmrecv.create({ port: 11112, unknownOption: true } as never);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('accepts all optional parameters', () => {
            const result = Dcmrecv.create({
                port: 11112,
                aeTitle: 'DCMRECV',
                outputDirectory: '/tmp/received',
                configFile: '/etc/dcmrecv.cfg',
                configProfile: 'Default',
                subdirectory: 'series-date',
                filenameMode: 'unique',
                filenameExtension: '.dcm',
                storageMode: 'normal',
                acseTimeout: 30,
                dimseTimeout: 30,
                maxPdu: 16384,
                startTimeoutMs: 5000,
                drainTimeoutMs: 3000,
            });

            expect(result.ok).toBe(true);
        });

        it('accepts short-unique filename mode', () => {
            const result = Dcmrecv.create({
                port: 11112,
                filenameMode: 'short-unique',
            });

            expect(result.ok).toBe(true);
        });

        it('accepts system-time filename mode', () => {
            const result = Dcmrecv.create({
                port: 11112,
                filenameMode: 'system-time',
            });

            expect(result.ok).toBe(true);
        });

        it('accepts bit-preserving storage mode', () => {
            const result = Dcmrecv.create({
                port: 11112,
                storageMode: 'bit-preserving',
            });

            expect(result.ok).toBe(true);
        });

        it('accepts ignore storage mode', () => {
            const result = Dcmrecv.create({
                port: 11112,
                storageMode: 'ignore',
            });

            expect(result.ok).toBe(true);
        });

        it('rejects invalid maxPdu below minimum', () => {
            const result = Dcmrecv.create({ port: 11112, maxPdu: 1024 });

            expect(result.ok).toBe(false);
        });

        it('rejects invalid maxPdu above maximum', () => {
            const result = Dcmrecv.create({ port: 11112, maxPdu: 200000 });

            expect(result.ok).toBe(false);
        });

        it('rejects aeTitle exceeding 16 characters', () => {
            const result = Dcmrecv.create({ port: 11112, aeTitle: 'A'.repeat(17) });

            expect(result.ok).toBe(false);
        });

        it('accepts AbortSignal', () => {
            const controller = new AbortController();
            const result = Dcmrecv.create({
                port: 11112,
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });

        it('handles already-aborted signal', () => {
            const controller = new AbortController();
            controller.abort();

            const result = Dcmrecv.create({
                port: 11112,
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });
    });

    describe('event emission via parser', () => {
        it('emits LISTENING when parser matches listening output', () => {
            const result = Dcmrecv.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('LISTENING', spy);

            // Simulate line output from the process
            server.emit('line', { source: 'stderr', text: 'I: listening on port 11112' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits STORED_FILE with file path data', () => {
            const result = Dcmrecv.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('STORED_FILE', spy);

            server.emit('line', { source: 'stderr', text: 'I: Stored received object to file: /tmp/image.dcm' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ filePath: '/tmp/image.dcm' });
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_RECEIVED with parsed data', () => {
            const result = Dcmrecv.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_RECEIVED', spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Received 10.0.0.1: "SCU" -> "SCP"' });

            expect(spy).toHaveBeenCalledOnce();
            const data = spy.mock.calls[0]?.[0] as { callingAE: string; calledAE: string };
            expect(data.callingAE).toBe('SCU');
            expect(data.calledAE).toBe('SCP');
            server[Symbol.dispose]();
        });

        it('emits error for fatal events', () => {
            const result = Dcmrecv.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            // Replace default error handler
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', { source: 'stderr', text: 'E: cannot listen on port 11112' });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });
    });
});
