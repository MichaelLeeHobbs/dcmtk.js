import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dcmpsrcv } from './Dcmpsrcv';

vi.mock('../tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { resolveBinary } from '../tools/_resolveBinary';

const mockedResolveBinary = vi.mocked(resolveBinary);

describe('Dcmpsrcv', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmpsrcv' });
    });

    describe('create()', () => {
        it('returns ok with valid options', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });

            expect(result.ok).toBe(true);
        });

        it('returns error for empty configFile', () => {
            const result = Dcmpsrcv.create({ configFile: '' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error when binary not found', () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('rejects unknown options via strict schema', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg', unknownOption: true } as never);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('accepts all optional parameters', () => {
            const result = Dcmpsrcv.create({
                configFile: '/etc/dcmpstat.cfg',
                receiverId: 'RECEIVE_1',
                logLevel: 'debug',
                logConfig: '/etc/logger.cfg',
                startTimeoutMs: 5000,
                drainTimeoutMs: 3000,
            });

            expect(result.ok).toBe(true);
        });

        it('accepts each log level', () => {
            const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
            for (const logLevel of levels) {
                const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg', logLevel });
                expect(result.ok).toBe(true);
            }
        });

        it('accepts AbortSignal', () => {
            const controller = new AbortController();
            const result = Dcmpsrcv.create({
                configFile: '/etc/dcmpstat.cfg',
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

            const result = Dcmpsrcv.create({
                configFile: '/etc/dcmpstat.cfg',
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });
    });

    describe('event emission via parser', () => {
        it('emits LISTENING when parser matches receiver startup', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('LISTENING', spy);

            server.emit('line', { source: 'stderr', text: 'I: Receiver STORESCP1 on port 10004' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ receiverId: 'STORESCP1', port: 10004 });
            server[Symbol.dispose]();
        });

        it('emits DATABASE_READY when parser matches database output', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('DATABASE_READY', spy);

            server.emit('line', { source: 'stderr', text: "I: Using database in directory '/var/lib/dcmtk/db'" });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ directory: '/var/lib/dcmtk/db' });
            server[Symbol.dispose]();
        });

        it('onListening convenience method delegates to onEvent', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onListening(spy);

            server.emit('line', { source: 'stderr', text: 'I: Receiver STORESCP1 on port 10004' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ receiverId: 'STORESCP1', port: 10004 });
            server[Symbol.dispose]();
        });

        it('onCStoreRequest convenience method delegates to onEvent', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onCStoreRequest(spy);

            server.emit('line', { source: 'stderr', text: 'I: Received Store SCP RQ: MsgID 1' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits ECHO_REQUEST with message ID', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ECHO_REQUEST', spy);

            server.emit('line', { source: 'stderr', text: 'I: Received Echo SCP RQ: MsgID 42' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ messageId: 42 });
            server[Symbol.dispose]();
        });

        it('emits FILE_DELETED with file path', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('FILE_DELETED', spy);

            server.emit('line', { source: 'stderr', text: 'I: Store SCP: Deleting Image File: /tmp/rejected.dcm' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ filePath: '/tmp/rejected.dcm' });
            server[Symbol.dispose]();
        });

        it('emits TERMINATING', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('TERMINATING', spy);

            server.emit('line', { source: 'stderr', text: 'I: Terminating all receivers' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits error for fatal CONFIG_ERROR events', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', {
                source: 'stderr',
                text: "F: can't open configuration file '/etc/dcmpstat.cfg'",
            });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });

        it('emits error for fatal CANNOT_START_LISTENER events', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', {
                source: 'stderr',
                text: 'F: cannot listen on port 10004, insufficient privileges',
            });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_RECEIVED with parsed data', () => {
            const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_RECEIVED', spy);

            server.emit('line', {
                source: 'stderr',
                text: 'I: Association Received ("192.168.1.100:STORESCU -> STORESCP1")',
            });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });
    });
});
