/**
 * Property-based fuzz tests for DICOM tag path parsing.
 *
 * Exercises tagPathToSegments, segmentsToModifyPath, and segmentsToString
 * with randomly generated inputs to find edge cases.
 *
 * @module fuzz/tagPath
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tagPathToSegments, segmentsToModifyPath, segmentsToString } from '../../src/dicom/tagPath';
import type { DicomTagPath } from '../../src/brands';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid hex digit (0-9, A-F). */
const hexDigit = fc.mapToConstant({ num: 10, build: v => String.fromCharCode(0x30 + v) }, { num: 6, build: v => String.fromCharCode(0x41 + v) });

/** Generates a 4-character hex string. */
const hexQuad = fc.tuple(hexDigit, hexDigit, hexDigit, hexDigit).map(ds => ds.join(''));

/** Generates a valid DICOM tag like `(ABCD,1234)`. */
const dicomTag = fc.tuple(hexQuad, hexQuad).map(([g, e]) => `(${g},${e})`);

/** Generates an optional array index like `[0]`, `[42]`, or empty. */
const optionalIndex = fc.oneof(
    fc.constant(''),
    fc.integer({ min: 0, max: 999 }).map(n => `[${n}]`)
);

/** Generates a single path segment like `(0040,A730)[0]`. */
const pathSegment = fc.tuple(dicomTag, optionalIndex).map(([tag, idx]) => `${tag}${idx}`);

/** Generates a valid full tag path with 1-5 segments. */
const validTagPath = fc.array(pathSegment, { minLength: 1, maxLength: 5 }).map(segs => segs.join('.'));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tagPath fuzz tests', () => {
    it('round-trips valid paths through parse → serialize', () => {
        fc.assert(
            fc.property(validTagPath, path => {
                const segments = tagPathToSegments(path as DicomTagPath);
                const serialized = segmentsToModifyPath(segments);
                // Re-parse the serialized output — should yield identical segments
                const reparsed = tagPathToSegments(serialized as DicomTagPath);
                expect(reparsed).toEqual(segments);
            }),
            { numRuns: 500 }
        );
    });

    it('segmentsToString matches segmentsToModifyPath', () => {
        fc.assert(
            fc.property(validTagPath, path => {
                const segments = tagPathToSegments(path as DicomTagPath);
                expect(segmentsToString(segments)).toBe(segmentsToModifyPath(segments));
            }),
            { numRuns: 200 }
        );
    });

    it('segment count matches number of dot-separated parts', () => {
        fc.assert(
            fc.property(validTagPath, path => {
                const segments = tagPathToSegments(path as DicomTagPath);
                const dotParts = path.split('.');
                expect(segments.length).toBe(dotParts.length);
            }),
            { numRuns: 200 }
        );
    });

    it('never throws for valid paths', () => {
        fc.assert(
            fc.property(validTagPath, path => {
                expect(() => tagPathToSegments(path as DicomTagPath)).not.toThrow();
            }),
            { numRuns: 500 }
        );
    });

    it('always throws for random non-path strings', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => s.length > 0 && !s.startsWith('(')),
                input => {
                    expect(() => tagPathToSegments(input as DicomTagPath)).toThrow();
                }
            ),
            { numRuns: 200 }
        );
    });

    it('always throws for empty string', () => {
        expect(() => tagPathToSegments('' as DicomTagPath)).toThrow('Tag path is empty');
    });

    it('every parsed segment has an uppercase hex tag', () => {
        fc.assert(
            fc.property(validTagPath, path => {
                const segments = tagPathToSegments(path as DicomTagPath);
                for (const seg of segments) {
                    expect(seg.tag).toMatch(/^\([0-9A-F]{4},[0-9A-F]{4}\)$/);
                }
            }),
            { numRuns: 300 }
        );
    });
});
