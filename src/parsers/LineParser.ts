/**
 * Line-by-line parser for DCMTK process output.
 *
 * Matches output lines against registered EventPattern objects and emits
 * structured events. Supports both single-line and multi-line block matching.
 *
 * All algorithms are iterative (Rule 8.2: no recursion).
 * All buffers are bounded (Rule 8.1).
 *
 * @module parsers/LineParser
 */

import { EventEmitter } from 'node:events';
import type { EventPattern } from './EventPattern';
import { MAX_BLOCK_LINES, MAX_EVENT_PATTERNS, DEFAULT_BLOCK_TIMEOUT_MS } from '../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Events emitted by the LineParser. */
interface LineParserEventMap {
    /** Emitted when a pattern matches. Carries the event name and extracted data. */
    match: [{ readonly event: string; readonly data: unknown }];
    /** Emitted when a multi-line block times out before the footer is matched. */
    blockTimeout: [{ readonly event: string; readonly lines: readonly string[] }];
}

/** Tracks the state of an in-progress multi-line block. */
interface BlockState {
    readonly pattern: EventPattern;
    readonly lines: string[];
    readonly timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// LineParser class
// ---------------------------------------------------------------------------

/**
 * Parses DCMTK output lines against registered event patterns.
 *
 * @example
 * ```ts
 * const parser = new LineParser();
 * parser.addPattern({
 *     event: 'LISTENING',
 *     pattern: /listening on port (\d+)/i,
 *     processor: match => ({ port: Number(match[1]) }),
 * });
 *
 * parser.on('match', ({ event, data }) => {
 *     console.log(`${event}:`, data);
 * });
 *
 * parser.feed('I: listening on port 11112');
 * // Emits: match { event: 'LISTENING', data: { port: 11112 } }
 * ```
 */
class LineParser extends EventEmitter<LineParserEventMap> {
    private readonly patterns: EventPattern[] = [];
    private activeBlock: BlockState | null = null;

    /**
     * Registers an event pattern.
     *
     * @param pattern - The pattern to register
     * @throws Error if maximum pattern count exceeded (Rule 8.1)
     */
    addPattern(pattern: EventPattern): void {
        if (this.patterns.length >= MAX_EVENT_PATTERNS) {
            throw new Error(`Maximum event patterns (${MAX_EVENT_PATTERNS}) exceeded`);
        }
        this.patterns.push(pattern);
    }

    /**
     * Feeds a single line of output to the parser.
     *
     * The line is matched against all registered patterns (iteratively, Rule 8.2).
     * If a multi-line block is active, the line is accumulated until the footer matches.
     *
     * @param line - A single line of DCMTK output (without trailing newline)
     */
    feed(line: string): void {
        // If a multi-line block is active, accumulate lines
        if (this.activeBlock !== null) {
            this.feedToBlock(line);
            return;
        }

        // Check for multi-line block headers first
        for (let i = 0; i < this.patterns.length; i++) {
            const pattern = this.patterns[i];
            /* v8 ignore next -- safety guard for noUncheckedIndexedAccess */
            if (pattern === undefined) continue;

            if (pattern.multiLine) {
                const headerMatch = pattern.multiLine.header.exec(line);
                if (headerMatch) {
                    this.startBlock(pattern, line);
                    return;
                }
            }
        }

        // Check single-line patterns
        this.matchSingleLine(line);
    }

    /**
     * Feeds multiple lines of output (e.g., from a chunk split by newlines).
     *
     * @param lines - Array of lines to process
     */
    feedLines(lines: readonly string[]): void {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line !== undefined) {
                this.feed(line);
            }
        }
    }

    /**
     * Resets the parser state, clearing any active multi-line block.
     */
    reset(): void {
        if (this.activeBlock !== null) {
            clearTimeout(this.activeBlock.timer);
            this.activeBlock = null;
        }
    }

    /**
     * Implements Disposable for cleanup (Rule 5.1).
     */
    [Symbol.dispose](): void {
        this.reset();
        this.removeAllListeners();
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private matchSingleLine(line: string): void {
        for (let i = 0; i < this.patterns.length; i++) {
            const pattern = this.patterns[i];
            /* v8 ignore next -- safety guard for noUncheckedIndexedAccess */
            if (pattern === undefined) continue;

            // Skip multi-line-only patterns for single-line matching
            if (pattern.multiLine) continue;

            const match = pattern.pattern.exec(line);
            if (match) {
                const data = pattern.processor(match);
                this.emit('match', { event: pattern.event, data });
                return; // First match wins
            }
        }
    }

    private startBlock(pattern: EventPattern, headerLine: string): void {
        /* v8 ignore next -- multiLine is always defined when startBlock is called */
        const timeoutMs = pattern.multiLine?.timeoutMs ?? DEFAULT_BLOCK_TIMEOUT_MS;

        const timer = setTimeout(() => {
            if (this.activeBlock !== null) {
                const lines = [...this.activeBlock.lines];
                const evt = this.activeBlock.pattern.event;
                this.activeBlock = null;
                this.emit('blockTimeout', { event: evt, lines });
            }
        }, timeoutMs);

        this.activeBlock = {
            pattern,
            lines: [headerLine],
            timer,
        };
    }

    private feedToBlock(line: string): void {
        /* v8 ignore next -- safety guard: activeBlock is always set when feedToBlock is called */
        if (this.activeBlock === null) return;

        const { pattern, lines, timer } = this.activeBlock;
        /* v8 ignore next -- multiLine is always defined for block patterns */
        const maxLines = pattern.multiLine?.maxLines ?? MAX_BLOCK_LINES;

        lines.push(line);

        // Check footer
        if (pattern.multiLine?.footer.test(line)) {
            clearTimeout(timer);
            const blockText = lines.join('\n');
            const match = pattern.pattern.exec(blockText);
            this.activeBlock = null;

            if (match) {
                const data = pattern.processor(match);
                this.emit('match', { event: pattern.event, data });
            }
            return;
        }

        // Enforce bounded accumulation (Rule 8.1)
        if (lines.length >= maxLines) {
            clearTimeout(timer);
            const evt = pattern.event;
            const accumulated = [...lines];
            this.activeBlock = null;
            this.emit('blockTimeout', { event: evt, lines: accumulated });
        }
    }
}

export { LineParser };
export type { LineParserEventMap };
