import { describe, it, expect } from 'vitest';
import {
    DICOM_TAG_PATTERN,
    AE_TITLE_PATTERN,
    UID_PATTERN,
    TAG_PATH_SEGMENT,
    DICOM_TAG_PATH_PATTERN,
    AE_TITLE_MIN_LENGTH,
    AE_TITLE_MAX_LENGTH,
    UID_MAX_LENGTH,
    PORT_MIN,
    PORT_MAX,
    PATH_TRAVERSAL_PATTERN,
    isSafePath,
} from './patterns';

describe('patterns', () => {
    describe('DICOM_TAG_PATTERN', () => {
        it('matches valid DICOM tags', () => {
            expect(DICOM_TAG_PATTERN.test('(0010,0010)')).toBe(true);
            expect(DICOM_TAG_PATTERN.test('(00FF,00AB)')).toBe(true);
            expect(DICOM_TAG_PATTERN.test('(00ff,00ab)')).toBe(true);
        });

        it('rejects invalid DICOM tags', () => {
            expect(DICOM_TAG_PATTERN.test('0010,0010')).toBe(false);
            expect(DICOM_TAG_PATTERN.test('(001,0010)')).toBe(false);
            expect(DICOM_TAG_PATTERN.test('(ZZZZ,0010)')).toBe(false);
            expect(DICOM_TAG_PATTERN.test('')).toBe(false);
        });
    });

    describe('AE_TITLE_PATTERN', () => {
        it('matches valid AE titles', () => {
            expect(AE_TITLE_PATTERN.test('MY-AE')).toBe(true);
            expect(AE_TITLE_PATTERN.test('AE TITLE')).toBe(true);
            expect(AE_TITLE_PATTERN.test('A')).toBe(true);
        });

        it('rejects invalid AE titles', () => {
            expect(AE_TITLE_PATTERN.test('AE@TITLE')).toBe(false);
            expect(AE_TITLE_PATTERN.test('')).toBe(false);
        });
    });

    describe('UID_PATTERN', () => {
        it('matches valid UIDs', () => {
            expect(UID_PATTERN.test('1.2.840.10008')).toBe(true);
            expect(UID_PATTERN.test('1')).toBe(true);
        });

        it('rejects invalid UIDs', () => {
            expect(UID_PATTERN.test('1.2.abc')).toBe(false);
            expect(UID_PATTERN.test('')).toBe(false);
            expect(UID_PATTERN.test('.1.2')).toBe(false);
        });
    });

    describe('TAG_PATH_SEGMENT', () => {
        it('matches tag without index', () => {
            expect(TAG_PATH_SEGMENT.test('(0010,0010)')).toBe(true);
        });

        it('matches tag with index', () => {
            expect(TAG_PATH_SEGMENT.test('(0040,A730)[0]')).toBe(true);
        });
    });

    describe('DICOM_TAG_PATH_PATTERN', () => {
        it('matches single tag paths', () => {
            expect(DICOM_TAG_PATH_PATTERN.test('(0010,0010)')).toBe(true);
        });

        it('matches multi-segment tag paths', () => {
            expect(DICOM_TAG_PATH_PATTERN.test('(0040,A730)[0].(0010,0010)')).toBe(true);
        });

        it('rejects invalid tag paths', () => {
            expect(DICOM_TAG_PATH_PATTERN.test('')).toBe(false);
            expect(DICOM_TAG_PATH_PATTERN.test('invalid')).toBe(false);
        });
    });

    describe('validation constants', () => {
        it('has correct AE Title length bounds', () => {
            expect(AE_TITLE_MIN_LENGTH).toBe(1);
            expect(AE_TITLE_MAX_LENGTH).toBe(16);
        });

        it('has correct UID max length', () => {
            expect(UID_MAX_LENGTH).toBe(64);
        });

        it('has correct port bounds', () => {
            expect(PORT_MIN).toBe(1);
            expect(PORT_MAX).toBe(65535);
        });
    });

    describe('PATH_TRAVERSAL_PATTERN', () => {
        it('detects traversal at start', () => {
            expect(PATH_TRAVERSAL_PATTERN.test('../etc')).toBe(true);
        });

        it('detects traversal in middle', () => {
            expect(PATH_TRAVERSAL_PATTERN.test('/foo/../bar')).toBe(true);
            expect(PATH_TRAVERSAL_PATTERN.test('foo\\..\\bar')).toBe(true);
        });

        it('detects traversal at end', () => {
            expect(PATH_TRAVERSAL_PATTERN.test('/foo/..')).toBe(true);
        });

        it('allows safe paths', () => {
            expect(PATH_TRAVERSAL_PATTERN.test('/foo/bar')).toBe(false);
            expect(PATH_TRAVERSAL_PATTERN.test('foo..bar')).toBe(false);
        });
    });

    describe('isSafePath()', () => {
        it('returns true for safe paths', () => {
            expect(isSafePath('/tmp/received')).toBe(true);
            expect(isSafePath('C:\\data\\files')).toBe(true);
            expect(isSafePath('relative/path')).toBe(true);
        });

        it('returns false for paths with traversal', () => {
            expect(isSafePath('../etc/passwd')).toBe(false);
            expect(isSafePath('/foo/../bar')).toBe(false);
            expect(isSafePath('foo\\..\\bar')).toBe(false);
        });
    });
});
