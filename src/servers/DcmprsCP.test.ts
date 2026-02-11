import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DcmprsCP } from './DcmprsCP';

vi.mock('../tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { resolveBinary } from '../tools/_resolveBinary';

const mockedResolveBinary = vi.mocked(resolveBinary);

describe('DcmprsCP', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmprscp' });
    });

    describe('create()', () => {
        it('returns ok with valid options', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });

            expect(result.ok).toBe(true);
        });

        it('returns error for empty configFile', () => {
            const result = DcmprsCP.create({ configFile: '' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error when binary not found', () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('rejects unknown options via strict schema', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg', unknownOption: true } as never);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('accepts all optional parameters', () => {
            const result = DcmprsCP.create({
                configFile: '/etc/dcmpstat.cfg',
                printer: 'IHEFULL',
                dump: true,
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
                const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg', logLevel });
                expect(result.ok).toBe(true);
            }
        });

        it('accepts AbortSignal', () => {
            const controller = new AbortController();
            const result = DcmprsCP.create({
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

            const result = DcmprsCP.create({
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
        it('emits DATABASE_READY when parser matches database output', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
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

        it('emits ASSOCIATION_RECEIVED with parsed data', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_RECEIVED', spy);

            server.emit('line', {
                source: 'stderr',
                text: 'I: Association Received ("192.168.1.50:PRINTSCU -> IHEFULL")',
            });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('onDatabaseReady convenience method delegates to onEvent', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onDatabaseReady(spy);

            server.emit('line', { source: 'stderr', text: "I: Using database in directory '/var/lib/dcmtk/db'" });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ directory: '/var/lib/dcmtk/db' });
            server[Symbol.dispose]();
        });

        it('onAssociationReceived convenience method delegates to onEvent', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onAssociationReceived(spy);

            server.emit('line', {
                source: 'stderr',
                text: 'I: Association Received ("192.168.1.50:PRINTSCU -> IHEFULL")',
            });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_ACKNOWLEDGED with maxSendPDV', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_ACKNOWLEDGED', spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Acknowledged (Max Send PDV: 16372)' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ maxSendPDV: 16372 });
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_RELEASE', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_RELEASE', spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Release' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits error for fatal CONFIG_ERROR events', () => {
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
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
            const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', { source: 'stderr', text: 'F: cannot initialise network' });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });
    });
});
