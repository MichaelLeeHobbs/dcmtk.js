/**
 * Event pattern definitions for DCMTK output parsing.
 *
 * An EventPattern describes a regex that matches a specific DCMTK output pattern,
 * along with a processor function that extracts structured data from the match.
 *
 * Supports both single-line and multi-line block matching.
 *
 * @module parsers/EventPattern
 */

/**
 * Configuration for multi-line block matching.
 *
 * When a line matches the header, the parser accumulates subsequent lines
 * until the footer is matched or limits are reached.
 */
interface MultiLineConfig {
    /** Regex that identifies the start of a multi-line block. */
    readonly header: RegExp;
    /** Regex that identifies the end of a multi-line block. */
    readonly footer: RegExp;
    /** Maximum lines to accumulate (Rule 8.1: bounded). */
    readonly maxLines: number;
    /** Timeout in ms for block completion (Rule 4.2: mandatory timeout). */
    readonly timeoutMs: number;
}

/**
 * Defines a pattern that can be matched against DCMTK process output lines.
 *
 * @typeParam T - The type of data extracted by the processor function
 */
interface EventPattern<T = unknown> {
    /** The event name emitted when this pattern matches. */
    readonly event: string;
    /** The regex pattern to match against individual lines. */
    readonly pattern: RegExp;
    /** Extracts structured data from the regex match. */
    readonly processor: (match: RegExpMatchArray) => T;
    /** Optional multi-line block configuration. */
    readonly multiLine?: MultiLineConfig | undefined;
}

export type { EventPattern, MultiLineConfig };
