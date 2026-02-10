import { describe, it, expect } from 'vitest';
import { SOP_CLASSES, sopClassNameFromUID } from './sopClasses';
import type { SOPClassName } from './sopClasses';

describe('SOP Classes', () => {
    describe('SOP_CLASSES', () => {
        it('contains the Verification SOP Class', () => {
            expect(SOP_CLASSES.Verification).toBe('1.2.840.10008.1.1');
        });

        it('contains common storage SOP classes', () => {
            expect(SOP_CLASSES.CTImageStorage).toBe('1.2.840.10008.5.1.4.1.1.2');
            expect(SOP_CLASSES.MRImageStorage).toBe('1.2.840.10008.5.1.4.1.1.4');
            expect(SOP_CLASSES.UltrasoundImageStorage).toBe('1.2.840.10008.5.1.4.1.1.6.1');
            expect(SOP_CLASSES.SecondaryCaptureImageStorage).toBe('1.2.840.10008.5.1.4.1.1.7');
        });

        it('contains RT SOP classes', () => {
            expect(SOP_CLASSES.RTStructureSetStorage).toBe('1.2.840.10008.5.1.4.1.1.481.3');
            expect(SOP_CLASSES.RTPlanStorage).toBe('1.2.840.10008.5.1.4.1.1.481.5');
        });

        it('contains query/retrieve SOP classes', () => {
            expect(SOP_CLASSES.StudyRootQueryRetrieveInformationModelFind).toBe('1.2.840.10008.5.1.4.1.2.2.1');
            expect(SOP_CLASSES.PatientRootQueryRetrieveInformationModelMove).toBe('1.2.840.10008.5.1.4.1.2.1.2');
        });

        it('has no duplicate UIDs', () => {
            const values = Object.values(SOP_CLASSES);
            expect(new Set(values).size).toBe(values.length);
        });

        it('all UIDs start with 1.2.840.10008', () => {
            for (const uid of Object.values(SOP_CLASSES)) {
                expect(uid).toMatch(/^1\.2\.840\.10008\./);
            }
        });

        it('all UIDs are valid dotted-numeric format', () => {
            for (const uid of Object.values(SOP_CLASSES)) {
                expect(uid).toMatch(/^[0-9]+(\.[0-9]+)*$/);
            }
        });
    });

    describe('sopClassNameFromUID()', () => {
        it('returns the name for a known UID', () => {
            expect(sopClassNameFromUID('1.2.840.10008.1.1')).toBe('Verification');
            expect(sopClassNameFromUID('1.2.840.10008.5.1.4.1.1.2')).toBe('CTImageStorage');
            expect(sopClassNameFromUID('1.2.840.10008.5.1.4.1.1.4')).toBe('MRImageStorage');
        });

        it('returns undefined for an unknown UID', () => {
            expect(sopClassNameFromUID('1.2.3.4.5.6.7')).toBeUndefined();
            expect(sopClassNameFromUID('')).toBeUndefined();
        });

        it('is consistent with SOP_CLASSES forward lookup', () => {
            const entries = Object.entries(SOP_CLASSES) as ReadonlyArray<[SOPClassName, string]>;
            for (const [name, uid] of entries) {
                expect(sopClassNameFromUID(uid)).toBe(name);
            }
        });
    });
});
