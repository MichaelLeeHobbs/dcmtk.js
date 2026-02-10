import { describe, it, expect } from 'vitest';
import { tagPathToSegments, segmentsToModifyPath, segmentsToString } from './tagPath';
import type { TagSegment } from './tagPath';
import type { DicomTagPath } from '../brands';

/** Helper to cast string to DicomTagPath for tests. */
function tp(s: string): DicomTagPath {
    return s as DicomTagPath;
}

describe('Tag Path Utilities', () => {
    describe('tagPathToSegments()', () => {
        it('parses a simple single tag', () => {
            const segments = tagPathToSegments(tp('(0010,0010)'));
            expect(segments).toHaveLength(1);
            expect(segments[0]?.tag).toBe('(0010,0010)');
            expect(segments[0]?.index).toBeUndefined();
            expect(segments[0]?.isWildcard).toBeUndefined();
        });

        it('parses a single tag with index', () => {
            const segments = tagPathToSegments(tp('(0040,A730)[0]'));
            expect(segments).toHaveLength(1);
            expect(segments[0]?.tag).toBe('(0040,A730)');
            expect(segments[0]?.index).toBe(0);
        });

        it('parses a nested path without indices', () => {
            const segments = tagPathToSegments(tp('(0040,A730).(0040,A160)'));
            expect(segments).toHaveLength(2);
            expect(segments[0]?.tag).toBe('(0040,A730)');
            expect(segments[1]?.tag).toBe('(0040,A160)');
        });

        it('parses a nested path with indices', () => {
            const segments = tagPathToSegments(tp('(0040,A730)[0].(0040,A160)'));
            expect(segments).toHaveLength(2);
            expect(segments[0]?.tag).toBe('(0040,A730)');
            expect(segments[0]?.index).toBe(0);
            expect(segments[1]?.tag).toBe('(0040,A160)');
            expect(segments[1]?.index).toBeUndefined();
        });

        it('parses deeply nested paths', () => {
            const segments = tagPathToSegments(tp('(0040,A730)[0].(0040,A730)[1].(0040,A160)'));
            expect(segments).toHaveLength(3);
            expect(segments[0]?.index).toBe(0);
            expect(segments[1]?.index).toBe(1);
            expect(segments[2]?.index).toBeUndefined();
        });

        it('parses wildcard indices', () => {
            const segments = tagPathToSegments(tp('(0040,A730)[*].(0040,A160)'));
            expect(segments).toHaveLength(2);
            expect(segments[0]?.isWildcard).toBe(true);
            expect(segments[0]?.index).toBeUndefined();
            expect(segments[1]?.isWildcard).toBeUndefined();
        });

        it('parses multi-digit indices', () => {
            const segments = tagPathToSegments(tp('(0040,A730)[42]'));
            expect(segments).toHaveLength(1);
            expect(segments[0]?.index).toBe(42);
        });

        it('handles lowercase hex digits', () => {
            const segments = tagPathToSegments(tp('(00ff,00ab)'));
            expect(segments).toHaveLength(1);
            expect(segments[0]?.tag).toBe('(00ff,00ab)');
        });

        it('throws on empty path', () => {
            expect(() => tagPathToSegments(tp(''))).toThrow('Tag path is empty');
        });

        it('throws on invalid segment', () => {
            expect(() => tagPathToSegments(tp('not-a-tag'))).toThrow('Invalid tag path segment');
        });

        it('throws on trailing dot', () => {
            expect(() => tagPathToSegments(tp('(0010,0010).'))).toThrow('cannot end with a dot');
        });

        it('throws on malformed tag in middle of path', () => {
            expect(() => tagPathToSegments(tp('(0010,0010).garbage'))).toThrow('Invalid tag path segment');
        });
    });

    describe('segmentsToModifyPath()', () => {
        it('serializes a single tag', () => {
            const segments: TagSegment[] = [{ tag: '(0010,0010)' as never }];
            expect(segmentsToModifyPath(segments)).toBe('(0010,0010)');
        });

        it('serializes a tag with index', () => {
            const segments: TagSegment[] = [{ tag: '(0040,A730)' as never, index: 0 }];
            expect(segmentsToModifyPath(segments)).toBe('(0040,A730)[0]');
        });

        it('serializes a nested path', () => {
            const segments: TagSegment[] = [{ tag: '(0040,A730)' as never, index: 0 }, { tag: '(0040,A160)' as never }];
            expect(segmentsToModifyPath(segments)).toBe('(0040,A730)[0].(0040,A160)');
        });

        it('serializes wildcard indices', () => {
            const segments: TagSegment[] = [{ tag: '(0040,A730)' as never, isWildcard: true }, { tag: '(0040,A160)' as never }];
            expect(segmentsToModifyPath(segments)).toBe('(0040,A730)[*].(0040,A160)');
        });

        it('serializes an empty array', () => {
            expect(segmentsToModifyPath([])).toBe('');
        });
    });

    describe('segmentsToString()', () => {
        it('produces the same output as segmentsToModifyPath', () => {
            const segments: TagSegment[] = [{ tag: '(0040,A730)' as never, index: 0 }, { tag: '(0040,A160)' as never }];
            expect(segmentsToString(segments)).toBe(segmentsToModifyPath(segments));
        });
    });

    describe('round-trip', () => {
        it('parse → serialize → parse produces same segments for simple tag', () => {
            const original = tp('(0010,0010)');
            const segments = tagPathToSegments(original);
            const serialized = segmentsToModifyPath(segments);
            expect(serialized).toBe('(0010,0010)');
            const reparsed = tagPathToSegments(tp(serialized));
            expect(reparsed).toEqual(segments);
        });

        it('parse → serialize → parse for nested path with indices', () => {
            const original = tp('(0040,A730)[0].(0040,A730)[1].(0040,A160)');
            const segments = tagPathToSegments(original);
            const serialized = segmentsToModifyPath(segments);
            expect(serialized).toBe('(0040,A730)[0].(0040,A730)[1].(0040,A160)');
            const reparsed = tagPathToSegments(tp(serialized));
            expect(reparsed).toEqual(segments);
        });

        it('parse → serialize → parse for wildcard path', () => {
            const original = tp('(0040,A730)[*].(0040,A160)');
            const segments = tagPathToSegments(original);
            const serialized = segmentsToModifyPath(segments);
            expect(serialized).toBe('(0040,A730)[*].(0040,A160)');
            const reparsed = tagPathToSegments(tp(serialized));
            expect(reparsed).toEqual(segments);
        });
    });
});
