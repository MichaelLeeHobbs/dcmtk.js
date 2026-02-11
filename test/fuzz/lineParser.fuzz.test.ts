/**
 * Property-based fuzz tests for LineParser.
 *
 * Exercises the parser with random strings, unicode, and combinations
 * of registered patterns to ensure it never crashes or leaks resources.
 *
 * @module fuzz/lineParser
 */
import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { LineParser } from '../../src/parsers/LineParser';
import type { EventPattern } from '../../src/parsers/EventPattern';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A simple single-line pattern for testing. */
function simplePattern(event: string, regex: RegExp): EventPattern {
    return {
        event,
        pattern: regex,
        processor: match => ({ raw: match[0] }),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lineParser fuzz tests', () => {
    let parser: LineParser;

    afterEach(() => {
        parser[Symbol.dispose]();
    });

    it('never throws when fed arbitrary strings', () => {
        parser = new LineParser();
        parser.addPattern(simplePattern('TEST', /test/i));

        fc.assert(
            fc.property(fc.string(), line => {
                expect(() => parser.feed(line)).not.toThrow();
            }),
            { numRuns: 1000 }
        );
    });

    it('never throws when fed arbitrary unicode', () => {
        parser = new LineParser();
        parser.addPattern(simplePattern('UNICODE', /[\u{1F600}-\u{1F64F}]/u));

        fc.assert(
            fc.property(fc.string(), line => {
                expect(() => parser.feed(line)).not.toThrow();
            }),
            { numRuns: 500 }
        );
    });

    it('never throws when fed arbitrary arrays of lines', () => {
        parser = new LineParser();
        parser.addPattern(simplePattern('LINE', /line/));

        fc.assert(
            fc.property(fc.array(fc.string(), { maxLength: 50 }), lines => {
                expect(() => parser.feedLines(lines)).not.toThrow();
            }),
            { numRuns: 200 }
        );
    });

    it('emits match for every matching line and nothing more', () => {
        parser = new LineParser();
        parser.addPattern(simplePattern('KEYWORD', /^KEYWORD_(\d+)$/));

        fc.assert(
            fc.property(
                fc.array(
                    fc.oneof(
                        fc.integer({ min: 0, max: 999 }).map(n => `KEYWORD_${n}`),
                        fc.string().filter(s => !s.startsWith('KEYWORD_'))
                    ),
                    { maxLength: 20 }
                ),
                lines => {
                    const matches: string[] = [];
                    parser.removeAllListeners();
                    parser.on('match', ({ event }) => matches.push(event));

                    parser.feedLines(lines);

                    const expectedCount = lines.filter(l => /^KEYWORD_\d+$/.test(l)).length;
                    expect(matches.length).toBe(expectedCount);
                }
            ),
            { numRuns: 200 }
        );
    });

    it('reset clears block state safely under any conditions', () => {
        parser = new LineParser();
        const multiLinePattern: EventPattern = {
            event: 'BLOCK',
            pattern: /HEADER[\s\S]*FOOTER/,
            multiLine: {
                header: /^HEADER/,
                footer: /^FOOTER/,
                maxLines: 10,
                timeoutMs: 5000,
            },
            processor: match => ({ raw: match[0] }),
        };
        parser.addPattern(multiLinePattern);

        fc.assert(
            fc.property(fc.array(fc.string(), { maxLength: 15 }), lines => {
                parser.feedLines(lines);
                // Reset should never throw regardless of state
                expect(() => parser.reset()).not.toThrow();
            }),
            { numRuns: 200 }
        );
    });

    it('first-match-wins: only one event per line', () => {
        parser = new LineParser();
        parser.addPattern(simplePattern('FIRST', /port/));
        parser.addPattern(simplePattern('SECOND', /port \d+/));

        fc.assert(
            fc.property(fc.integer({ min: 1, max: 65535 }), port => {
                const matches: string[] = [];
                parser.removeAllListeners();
                parser.on('match', ({ event }) => matches.push(event));

                parser.feed(`listening on port ${port}`);

                // Should get exactly one match (first-match-wins)
                expect(matches.length).toBe(1);
                expect(matches[0]).toBe('FIRST');
            }),
            { numRuns: 100 }
        );
    });

    it('multi-line blocks enforce maxLines bound', () => {
        parser = new LineParser();
        const blockPattern: EventPattern = {
            event: 'BIG_BLOCK',
            pattern: /START[\s\S]*END/,
            multiLine: {
                header: /^START/,
                footer: /^END/,
                maxLines: 5,
                timeoutMs: 60000,
            },
            processor: match => ({ raw: match[0] }),
        };
        parser.addPattern(blockPattern);

        fc.assert(
            fc.property(fc.integer({ min: 6, max: 20 }), lineCount => {
                const timeoutEvents: unknown[] = [];
                parser.removeAllListeners();
                parser.on('blockTimeout', data => timeoutEvents.push(data));

                parser.reset();
                parser.feed('START');
                for (let i = 0; i < lineCount; i++) {
                    parser.feed(`line ${i}`);
                }

                // Should have triggered a blockTimeout due to maxLines
                expect(timeoutEvents.length).toBeGreaterThanOrEqual(1);
            }),
            { numRuns: 50 }
        );
    });
});
