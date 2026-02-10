/**
 * DICOM tag path parser and serializer.
 *
 * Provides iterative (no recursion) parsing of DICOM tag paths like
 * `(0040,A730)[0].(0040,A160)` into structured segments, and conversion
 * back to dcmodify-compatible strings.
 *
 * Supports wildcard indices `[*]` for use with DicomDataset.findValues.
 *
 * @module dicom/tagPath
 */

import type { DicomTag, DicomTagPath } from '../brands';
import { createDicomTag } from '../brands';
import { MAX_TRAVERSAL_DEPTH } from '../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single segment of a parsed DICOM tag path. */
interface TagSegment {
    /** The DICOM tag for this segment. */
    readonly tag: DicomTag;
    /** The array index for sequence items, or undefined for non-sequence tags. */
    readonly index?: number | undefined;
    /** Whether this segment uses a wildcard index `[*]`. */
    readonly isWildcard?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

// Matches a tag segment: (XXXX,XXXX) optionally followed by [N] or [*]
const SEGMENT_PATTERN = /^\(([0-9A-Fa-f]{4}),([0-9A-Fa-f]{4})\)(?:\[(\d+|\*)\])?/;

// ---------------------------------------------------------------------------
// Internal helpers (extracted for complexity/line limits)
// ---------------------------------------------------------------------------

/** Parses a single regex match into a TagSegment. */
function matchToSegment(match: RegExpExecArray): TagSegment {
    const group = match[1];
    const element = match[2];
    const indexStr = match[3];

    /* v8 ignore next 3 */
    if (group === undefined || element === undefined) {
        throw new Error('Failed to parse tag group/element');
    }

    const tagResult = createDicomTag(`(${group},${element})`);
    /* v8 ignore next 2 */
    if (!tagResult.ok) throw new Error(`Invalid tag in path: (${group},${element})`);

    if (indexStr === '*') return { tag: tagResult.value, isWildcard: true };
    if (indexStr !== undefined) return { tag: tagResult.value, index: Number(indexStr) };
    return { tag: tagResult.value };
}

/** Advances past the current match and any dot separator. Returns the updated remaining string. */
function advancePastMatch(remaining: string, matchLength: number): string {
    const after = remaining.slice(matchLength);
    if (!after.startsWith('.')) return after;
    if (after.length === 1) throw new Error('Tag path cannot end with a dot separator');
    return after.slice(1);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses a DICOM tag path into an array of segments.
 *
 * Uses iterative parsing with bounded loop (Rule 8.2: no recursion).
 *
 * @param path - A branded DicomTagPath string
 * @returns An array of TagSegment objects
 * @throws Error if the path is malformed or exceeds MAX_TRAVERSAL_DEPTH
 *
 * @example
 * ```ts
 * tagPathToSegments('(0040,A730)[0].(0040,A160)' as DicomTagPath)
 * // => [
 * //   { tag: '(0040,A730)' as DicomTag, index: 0 },
 * //   { tag: '(0040,A160)' as DicomTag }
 * // ]
 * ```
 */
function tagPathToSegments(path: DicomTagPath): ReadonlyArray<TagSegment> {
    const segments: TagSegment[] = [];
    let remaining: string = path;

    for (let i = 0; i < MAX_TRAVERSAL_DEPTH && remaining.length > 0; i++) {
        const match = SEGMENT_PATTERN.exec(remaining);
        if (match === null) {
            throw new Error(`Invalid tag path segment at position ${path.length - remaining.length}: "${remaining}"`);
        }
        segments.push(matchToSegment(match));
        remaining = advancePastMatch(remaining, match[0].length);
    }

    if (remaining.length > 0) throw new Error(`Tag path exceeds maximum depth of ${MAX_TRAVERSAL_DEPTH}`);
    if (segments.length === 0) throw new Error('Tag path is empty');
    return segments;
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

/**
 * Converts tag segments back to a dcmodify-compatible path string.
 *
 * Format: `(0040,A730)[0].(0040,A160)`
 *
 * @param segments - An array of TagSegment objects
 * @returns A dcmodify-compatible path string
 */
function segmentsToModifyPath(segments: ReadonlyArray<TagSegment>): string {
    const parts: string[] = [];
    for (const seg of segments) {
        let part: string = seg.tag;
        if (seg.isWildcard === true) {
            part += '[*]';
        } else if (seg.index !== undefined) {
            part += `[${seg.index}]`;
        }
        parts.push(part);
    }
    return parts.join('.');
}

/**
 * Converts tag segments to a canonical display string.
 *
 * Same format as dcmodify path: `(0040,A730)[0].(0040,A160)`
 *
 * @param segments - An array of TagSegment objects
 * @returns A human-readable path string
 */
function segmentsToString(segments: ReadonlyArray<TagSegment>): string {
    return segmentsToModifyPath(segments);
}

export { tagPathToSegments, segmentsToModifyPath, segmentsToString };
export type { TagSegment };
