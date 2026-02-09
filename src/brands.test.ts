import { describe, it, expect } from 'vitest';
import { createDicomTag, createAETitle, createDicomTagPath, createSOPClassUID, createTransferSyntaxUID, createDicomFilePath, createPort } from './brands';

describe('Branded type factories', () => {
    describe('createDicomTag()', () => {
        it('accepts valid DICOM tags', () => {
            const result = createDicomTag('(0010,0010)');
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('(0010,0010)');
        });

        it('accepts lowercase hex digits', () => {
            const result = createDicomTag('(00ff,00ab)');
            expect(result.ok).toBe(true);
        });

        it('accepts uppercase hex digits', () => {
            const result = createDicomTag('(00FF,00AB)');
            expect(result.ok).toBe(true);
        });

        it('rejects missing parentheses', () => {
            const result = createDicomTag('0010,0010');
            expect(result.ok).toBe(false);
        });

        it('rejects wrong length', () => {
            const result = createDicomTag('(001,0010)');
            expect(result.ok).toBe(false);
        });

        it('rejects non-hex characters', () => {
            const result = createDicomTag('(ZZZZ,0010)');
            expect(result.ok).toBe(false);
        });

        it('rejects empty string', () => {
            const result = createDicomTag('');
            expect(result.ok).toBe(false);
        });
    });

    describe('createAETitle()', () => {
        it('accepts valid AE titles', () => {
            const result = createAETitle('STORESCU');
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('STORESCU');
        });

        it('accepts titles with digits', () => {
            const result = createAETitle('PACS01');
            expect(result.ok).toBe(true);
        });

        it('accepts titles with hyphens', () => {
            const result = createAETitle('MY-PACS');
            expect(result.ok).toBe(true);
        });

        it('accepts titles with spaces', () => {
            const result = createAETitle('MY PACS');
            expect(result.ok).toBe(true);
        });

        it('accepts single character', () => {
            const result = createAETitle('A');
            expect(result.ok).toBe(true);
        });

        it('accepts 16-character maximum', () => {
            const result = createAETitle('1234567890123456');
            expect(result.ok).toBe(true);
        });

        it('rejects empty string', () => {
            const result = createAETitle('');
            expect(result.ok).toBe(false);
        });

        it('rejects over 16 characters', () => {
            const result = createAETitle('12345678901234567');
            expect(result.ok).toBe(false);
        });

        it('rejects special characters', () => {
            const result = createAETitle('PACS@01');
            expect(result.ok).toBe(false);
        });
    });

    describe('createDicomTagPath()', () => {
        it('accepts single tag', () => {
            const result = createDicomTagPath('(0010,0010)');
            expect(result.ok).toBe(true);
        });

        it('accepts dot-separated path', () => {
            const result = createDicomTagPath('(0040,0275).(0008,1110)');
            expect(result.ok).toBe(true);
        });

        it('accepts path with array index', () => {
            const result = createDicomTagPath('(0040,0275)[0].(0008,1155)');
            expect(result.ok).toBe(true);
        });

        it('rejects empty string', () => {
            const result = createDicomTagPath('');
            expect(result.ok).toBe(false);
        });

        it('rejects invalid format', () => {
            const result = createDicomTagPath('not-a-tag');
            expect(result.ok).toBe(false);
        });
    });

    describe('createSOPClassUID()', () => {
        it('accepts valid UID', () => {
            const result = createSOPClassUID('1.2.840.10008.5.1.4.1.1.2');
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('1.2.840.10008.5.1.4.1.1.2');
        });

        it('accepts simple numeric UID', () => {
            const result = createSOPClassUID('1.2.3');
            expect(result.ok).toBe(true);
        });

        it('rejects empty string', () => {
            const result = createSOPClassUID('');
            expect(result.ok).toBe(false);
        });

        it('rejects non-numeric UID', () => {
            const result = createSOPClassUID('1.2.abc.3');
            expect(result.ok).toBe(false);
        });

        it('rejects UID over 64 characters', () => {
            const result = createSOPClassUID('1.' + '2.'.repeat(32) + '3');
            expect(result.ok).toBe(false);
        });
    });

    describe('createTransferSyntaxUID()', () => {
        it('accepts valid Transfer Syntax UID', () => {
            const result = createTransferSyntaxUID('1.2.840.10008.1.2');
            expect(result.ok).toBe(true);
        });

        it('rejects empty string', () => {
            const result = createTransferSyntaxUID('');
            expect(result.ok).toBe(false);
        });

        it('rejects non-numeric', () => {
            const result = createTransferSyntaxUID('not.a.uid');
            expect(result.ok).toBe(false);
        });
    });

    describe('createDicomFilePath()', () => {
        it('accepts a valid path', () => {
            const result = createDicomFilePath('/data/study/image.dcm');
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('/data/study/image.dcm');
        });

        it('accepts Windows paths', () => {
            const result = createDicomFilePath('C:\\data\\image.dcm');
            expect(result.ok).toBe(true);
        });

        it('rejects empty string', () => {
            const result = createDicomFilePath('');
            expect(result.ok).toBe(false);
        });
    });

    describe('createPort()', () => {
        it('accepts valid port numbers', () => {
            const result = createPort(11112);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe(11112);
        });

        it('accepts minimum port (1)', () => {
            const result = createPort(1);
            expect(result.ok).toBe(true);
        });

        it('accepts maximum port (65535)', () => {
            const result = createPort(65535);
            expect(result.ok).toBe(true);
        });

        it('rejects zero', () => {
            const result = createPort(0);
            expect(result.ok).toBe(false);
        });

        it('rejects negative', () => {
            const result = createPort(-1);
            expect(result.ok).toBe(false);
        });

        it('rejects over 65535', () => {
            const result = createPort(65536);
            expect(result.ok).toBe(false);
        });

        it('rejects non-integer', () => {
            const result = createPort(80.5);
            expect(result.ok).toBe(false);
        });

        it('rejects NaN', () => {
            const result = createPort(NaN);
            expect(result.ok).toBe(false);
        });
    });
});
