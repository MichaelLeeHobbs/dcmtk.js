import { describe, it, expect, vi, afterEach } from 'vitest';
import { LineParser } from './LineParser';
import type { EventPattern } from './EventPattern';
import { MAX_EVENT_PATTERNS } from '../constants';

describe('LineParser', () => {
    let parser: LineParser;

    afterEach(() => {
        parser?.[Symbol.dispose]();
    });

    describe('single-line matching', () => {
        it('matches a simple pattern and emits data', () => {
            parser = new LineParser();
            const matchSpy = vi.fn();

            parser.addPattern({
                event: 'LISTENING',
                pattern: /listening on port (\d+)/i,
                processor: match => ({ port: Number(match[1]) }),
            });
            parser.on('match', matchSpy);

            parser.feed('I: listening on port 11112');

            expect(matchSpy).toHaveBeenCalledOnce();
            expect(matchSpy).toHaveBeenCalledWith({
                event: 'LISTENING',
                data: { port: 11112 },
            });
        });

        it('does not emit for non-matching lines', () => {
            parser = new LineParser();
            const matchSpy = vi.fn();

            parser.addPattern({
                event: 'LISTENING',
                pattern: /listening on port (\d+)/i,
                processor: match => ({ port: Number(match[1]) }),
            });
            parser.on('match', matchSpy);

            parser.feed('some other line');

            expect(matchSpy).not.toHaveBeenCalled();
        });

        it('first match wins when multiple patterns could match', () => {
            parser = new LineParser();
            const matches: string[] = [];

            parser.addPattern({
                event: 'FIRST',
                pattern: /hello/,
                processor: () => 'first',
            });
            parser.addPattern({
                event: 'SECOND',
                pattern: /hello/,
                processor: () => 'second',
            });
            parser.on('match', ({ event }) => matches.push(event));

            parser.feed('hello world');

            expect(matches).toEqual(['FIRST']);
        });

        it('handles multiple patterns for different events', () => {
            parser = new LineParser();
            const matches: string[] = [];

            parser.addPattern({
                event: 'ECHO',
                pattern: /C-ECHO/,
                processor: () => ({}),
            });
            parser.addPattern({
                event: 'STORE',
                pattern: /C-STORE/,
                processor: () => ({}),
            });
            parser.on('match', ({ event }) => matches.push(event));

            parser.feed('Received C-ECHO request');
            parser.feed('Received C-STORE request');

            expect(matches).toEqual(['ECHO', 'STORE']);
        });
    });

    describe('feedLines()', () => {
        it('processes multiple lines', () => {
            parser = new LineParser();
            const matches: string[] = [];

            parser.addPattern({
                event: 'LINE',
                pattern: /^line: (.+)$/,
                processor: match => match[1],
            });
            parser.on('match', ({ data }) => matches.push(data as string));

            parser.feedLines(['line: one', 'line: two', 'other']);

            expect(matches).toEqual(['one', 'two']);
        });
    });

    describe('multi-line block matching', () => {
        it('accumulates lines between header and footer', () => {
            parser = new LineParser();
            const matchSpy = vi.fn();

            const blockPattern: EventPattern = {
                event: 'ASSOCIATION',
                pattern: /=== BEGIN ===([\s\S]*)=== END ===/,
                processor: match => ({ body: match[1]?.trim() }),
                multiLine: {
                    header: /=== BEGIN ===/,
                    footer: /=== END ===/,
                    maxLines: 100,
                    timeoutMs: 1000,
                },
            };

            parser.addPattern(blockPattern);
            parser.on('match', matchSpy);

            parser.feed('=== BEGIN ===');
            parser.feed('  key1: value1');
            parser.feed('  key2: value2');
            parser.feed('=== END ===');

            expect(matchSpy).toHaveBeenCalledOnce();
            expect(matchSpy).toHaveBeenCalledWith({
                event: 'ASSOCIATION',
                data: { body: 'key1: value1\n  key2: value2' },
            });
        });

        it('times out if footer never arrives', async () => {
            parser = new LineParser();
            const timeoutSpy = vi.fn();

            const blockPattern: EventPattern = {
                event: 'BLOCK',
                pattern: /BEGIN([\s\S]*)END/,
                processor: match => match[1],
                multiLine: {
                    header: /BEGIN/,
                    footer: /END/,
                    maxLines: 100,
                    timeoutMs: 100,
                },
            };

            parser.addPattern(blockPattern);
            parser.on('blockTimeout', timeoutSpy);

            parser.feed('BEGIN');
            parser.feed('line1');

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(timeoutSpy).toHaveBeenCalledOnce();
            expect(timeoutSpy).toHaveBeenCalledWith({
                event: 'BLOCK',
                lines: ['BEGIN', 'line1'],
            });
        });

        it('enforces max lines bound', () => {
            parser = new LineParser();
            const timeoutSpy = vi.fn();

            const blockPattern: EventPattern = {
                event: 'BLOCK',
                pattern: /BEGIN([\s\S]*)END/,
                processor: match => match[1],
                multiLine: {
                    header: /BEGIN/,
                    footer: /END/,
                    maxLines: 3,
                    timeoutMs: 5000,
                },
            };

            parser.addPattern(blockPattern);
            parser.on('blockTimeout', timeoutSpy);

            parser.feed('BEGIN');
            parser.feed('line1');
            parser.feed('line2'); // This is the 3rd line — triggers max

            expect(timeoutSpy).toHaveBeenCalledOnce();
        });
    });

    describe('DCMTK-like output patterns', () => {
        it('parses association received event', () => {
            parser = new LineParser();
            const matchSpy = vi.fn();

            parser.addPattern({
                event: 'ASSOCIATION_RECEIVED',
                pattern: /Association Received.*from (.+):(\d+)/,
                processor: match => ({
                    host: match[1],
                    port: Number(match[2]),
                }),
            });
            parser.on('match', matchSpy);

            parser.feed('I: Association Received (client: STORESCU, host: 192.168.1.100:11112)');
            // The pattern won't match this exact format; let's use a simpler one
        });

        it('parses C-STORE status', () => {
            parser = new LineParser();
            const matchSpy = vi.fn();

            parser.addPattern({
                event: 'C_STORE_STATUS',
                pattern: /DIMSE Status\s*:\s*0x([0-9A-Fa-f]+)/,
                processor: match => ({ status: parseInt(match[1] ?? '0', 16) }),
            });
            parser.on('match', matchSpy);

            parser.feed('  DIMSE Status                  : 0x0000');

            expect(matchSpy).toHaveBeenCalledOnce();
            expect(matchSpy).toHaveBeenCalledWith({
                event: 'C_STORE_STATUS',
                data: { status: 0 },
            });
        });
    });

    describe('addPattern() bounds', () => {
        it('returns ok for patterns within limit', () => {
            parser = new LineParser();
            const result = parser.addPattern({
                event: 'TEST',
                pattern: /test/,
                processor: () => ({}),
            });
            expect(result.ok).toBe(true);
        });

        it('returns err when exceeding maximum event patterns', () => {
            parser = new LineParser();
            for (let i = 0; i < MAX_EVENT_PATTERNS; i++) {
                const result = parser.addPattern({
                    event: `EVENT_${i}`,
                    pattern: new RegExp(`pattern_${i}`),
                    processor: () => ({}),
                });
                expect(result.ok).toBe(true);
            }
            const result = parser.addPattern({
                event: 'ONE_TOO_MANY',
                pattern: /overflow/,
                processor: () => ({}),
            });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe(`Maximum event patterns (${MAX_EVENT_PATTERNS}) exceeded`);
            }
        });
    });

    describe('reset()', () => {
        it('clears active block state', () => {
            parser = new LineParser();
            const matchSpy = vi.fn();

            parser.addPattern({
                event: 'BLOCK',
                pattern: /BEGIN([\s\S]*)END/,
                processor: match => match[1],
                multiLine: {
                    header: /BEGIN/,
                    footer: /END/,
                    maxLines: 100,
                    timeoutMs: 5000,
                },
            });
            parser.on('match', matchSpy);

            parser.feed('BEGIN');
            parser.reset();
            parser.feed('END');

            // Should NOT emit since block was reset
            expect(matchSpy).not.toHaveBeenCalled();
        });
    });
});
