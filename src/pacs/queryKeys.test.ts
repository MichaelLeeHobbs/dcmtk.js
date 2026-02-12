import { describe, it, expect } from 'vitest';
import { buildStudyKeys, buildSeriesKeys, buildImageKeys, buildWorklistKeys, STUDY_RETURN_KEYS, SERIES_RETURN_KEYS, IMAGE_RETURN_KEYS } from './queryKeys';

describe('buildStudyKeys', () => {
    it('includes QueryRetrieveLevel=STUDY', () => {
        const keys = buildStudyKeys({});
        expect(keys[0]).toBe('0008,0052=STUDY');
    });

    it('adds filter keys with values', () => {
        const keys = buildStudyKeys({ patientId: 'PAT001', modality: 'CT' });
        expect(keys).toContain('0010,0020=PAT001');
        expect(keys).toContain('0008,0060=CT');
    });

    it('adds all return keys with empty values', () => {
        const keys = buildStudyKeys({});
        for (const tag of STUDY_RETURN_KEYS) {
            expect(keys).toContain(`${tag}=`);
        }
    });

    it('deduplicates filter and return keys', () => {
        const keys = buildStudyKeys({ patientId: 'PAT001' });
        const patientIdKeys = keys.filter(k => k.startsWith('0010,0020'));
        expect(patientIdKeys).toHaveLength(1);
        expect(patientIdKeys[0]).toBe('0010,0020=PAT001');
    });

    it('handles empty filter', () => {
        const keys = buildStudyKeys({});
        expect(keys.length).toBeGreaterThan(1);
        expect(keys[0]).toBe('0008,0052=STUDY');
    });

    it('includes all optional study filter fields', () => {
        const keys = buildStudyKeys({
            patientId: 'P1',
            patientName: 'DOE^JOHN',
            studyDate: '20240101',
            accessionNumber: 'ACC001',
            modality: 'MR',
            studyInstanceUID: '1.2.3',
            studyDescription: 'Brain',
        });
        expect(keys).toContain('0010,0020=P1');
        expect(keys).toContain('0010,0010=DOE^JOHN');
        expect(keys).toContain('0008,0020=20240101');
        expect(keys).toContain('0008,0050=ACC001');
        expect(keys).toContain('0008,0060=MR');
        expect(keys).toContain('0020,000d=1.2.3');
        expect(keys).toContain('0008,1030=Brain');
    });
});

describe('buildSeriesKeys', () => {
    it('includes QueryRetrieveLevel=SERIES', () => {
        const keys = buildSeriesKeys({ studyInstanceUID: '1.2.3' });
        expect(keys[0]).toBe('0008,0052=SERIES');
    });

    it('includes required studyInstanceUID', () => {
        const keys = buildSeriesKeys({ studyInstanceUID: '1.2.3' });
        expect(keys).toContain('0020,000d=1.2.3');
    });

    it('adds series return keys', () => {
        const keys = buildSeriesKeys({ studyInstanceUID: '1.2.3' });
        for (const tag of SERIES_RETURN_KEYS) {
            const hasTag = keys.some(k => k.startsWith(tag));
            expect(hasTag).toBe(true);
        }
    });

    it('includes optional series filter fields', () => {
        const keys = buildSeriesKeys({
            studyInstanceUID: '1.2.3',
            modality: 'CT',
            seriesNumber: '1',
            seriesInstanceUID: '1.2.3.4',
            seriesDescription: 'Axial',
        });
        expect(keys).toContain('0008,0060=CT');
        expect(keys).toContain('0020,0011=1');
        expect(keys).toContain('0020,000e=1.2.3.4');
        expect(keys).toContain('0008,103e=Axial');
    });
});

describe('buildImageKeys', () => {
    it('includes QueryRetrieveLevel=IMAGE', () => {
        const keys = buildImageKeys({ studyInstanceUID: '1.2.3', seriesInstanceUID: '1.2.3.4' });
        expect(keys[0]).toBe('0008,0052=IMAGE');
    });

    it('includes required UIDs', () => {
        const keys = buildImageKeys({ studyInstanceUID: '1.2.3', seriesInstanceUID: '1.2.3.4' });
        expect(keys).toContain('0020,000d=1.2.3');
        expect(keys).toContain('0020,000e=1.2.3.4');
    });

    it('adds image return keys', () => {
        const keys = buildImageKeys({ studyInstanceUID: '1.2.3', seriesInstanceUID: '1.2.3.4' });
        for (const tag of IMAGE_RETURN_KEYS) {
            const hasTag = keys.some(k => k.startsWith(tag));
            expect(hasTag).toBe(true);
        }
    });

    it('includes optional image filter fields', () => {
        const keys = buildImageKeys({
            studyInstanceUID: '1.2.3',
            seriesInstanceUID: '1.2.3.4',
            instanceNumber: '5',
            sopInstanceUID: '1.2.3.4.5',
            sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
        });
        expect(keys).toContain('0020,0013=5');
        expect(keys).toContain('0008,0018=1.2.3.4.5');
        expect(keys).toContain('0008,0016=1.2.840.10008.5.1.4.1.1.2');
    });
});

describe('buildWorklistKeys', () => {
    it('returns raw keys as-is', () => {
        const rawKeys = ['0040,0100.0008,0060=CT', '0010,0010=DOE*'];
        const keys = buildWorklistKeys({ keys: rawKeys });
        expect(keys).toEqual(rawKeys);
    });

    it('handles empty keys array', () => {
        const keys = buildWorklistKeys({ keys: [] });
        expect(keys).toEqual([]);
    });
});
