import { describe, it, expect } from 'vitest';
import { dcm2json } from '../../../src/tools/dcm2json';
import { DicomDataset } from '../../../src/dicom/DicomDataset';
import { dcmtkAvailable, SAMPLES } from '../helpers';

describe.skipIf(!dcmtkAvailable)('DicomDataset integration', () => {
    it('reads patient name from an MR file', async () => {
        const jsonResult = await dcm2json(SAMPLES.MR_BRAIN);
        expect(jsonResult.ok).toBe(true);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        expect(dsResult.ok).toBe(true);
        if (!dsResult.ok) return;

        const ds = dsResult.value;
        expect(ds.patientName.length).toBeGreaterThan(0);
    });

    it('reads all convenience getters on MR file', async () => {
        const jsonResult = await dcm2json(SAMPLES.MR_BRAIN);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        if (!dsResult.ok) return;

        const ds = dsResult.value;

        // These should all return non-empty strings for a real MR file
        expect(ds.patientName.length).toBeGreaterThan(0);
        expect(ds.patientID.length).toBeGreaterThan(0);
        expect(ds.modality).toBe('MR');
        expect(ds.studyInstanceUID.length).toBeGreaterThan(0);
        expect(ds.seriesInstanceUID.length).toBeGreaterThan(0);
        expect(ds.sopInstanceUID.length).toBeGreaterThan(0);
        expect(ds.sopClassUID).toBeDefined();
    });

    it('getElement returns real VR and Value', async () => {
        const jsonResult = await dcm2json(SAMPLES.MR_BRAIN);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        if (!dsResult.ok) return;

        const ds = dsResult.value;
        const elemResult = ds.getElement('00100010');
        expect(elemResult.ok).toBe(true);
        if (elemResult.ok) {
            expect(elemResult.value.vr).toBe('PN');
            expect(elemResult.value.Value).toBeDefined();
        }
    });

    it('getString with fallback for missing tag', async () => {
        const jsonResult = await dcm2json(SAMPLES.MR_BRAIN);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        if (!dsResult.ok) return;

        const ds = dsResult.value;
        const missing = ds.getString('99999999', 'FALLBACK');
        expect(missing).toBe('FALLBACK');
    });

    it('hasTag returns true for existing tag', async () => {
        const jsonResult = await dcm2json(SAMPLES.MR_BRAIN);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        if (!dsResult.ok) return;

        const ds = dsResult.value;
        expect(ds.hasTag('00100010')).toBe(true);
        expect(ds.hasTag('99999999')).toBe(false);
    });

    it('reads nested sequence data from file with nested tags', async () => {
        const jsonResult = await dcm2json(SAMPLES.NESTED_TAGS);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        expect(dsResult.ok).toBe(true);
        if (!dsResult.ok) return;

        // The file should parse and have data
        const ds = dsResult.value;
        expect(ds.sopInstanceUID.length).toBeGreaterThan(0);
    });

    it('creates dataset from another DICOM file', async () => {
        const jsonResult = await dcm2json(SAMPLES.OTHER_0002);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        expect(dsResult.ok).toBe(true);
        if (!dsResult.ok) return;

        const ds = dsResult.value;
        expect(ds.sopInstanceUID.length).toBeGreaterThan(0);
    });

    it('gets study date', async () => {
        const jsonResult = await dcm2json(SAMPLES.MR_BRAIN);
        if (!jsonResult.ok) return;

        const dsResult = DicomDataset.fromJson(jsonResult.value.data);
        if (!dsResult.ok) return;

        const ds = dsResult.value;
        // Study date should be a valid date string (YYYYMMDD format)
        const studyDate = ds.studyDate;
        if (studyDate.length > 0) {
            expect(studyDate).toMatch(/^\d{8}$/);
        }
    });
});
