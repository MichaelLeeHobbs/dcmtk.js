import { resolve } from 'node:path';

const SAMPLES_ROOT = resolve(__dirname, '../../../dicomSamples');

/**
 * Resolved absolute paths to sample DICOM files used in integration tests.
 */
const SAMPLES = {
    /** A standard uncompressed MR DICOM file. */
    MR_BRAIN: resolve(SAMPLES_ROOT, '1010_brain_mr_12_jpg/IM-0001-0001.dcm'),
    /** A second MR file from the same series. */
    MR_BRAIN_2: resolve(SAMPLES_ROOT, '1010_brain_mr_12_jpg/IM-0001-0002.dcm'),
    /** A third MR file for batch tests. */
    MR_BRAIN_3: resolve(SAMPLES_ROOT, '1010_brain_mr_12_jpg/IM-0001-0003.dcm'),
    /** A JPEG-compressed DICOM file (from other/ with .DCM extension). */
    OTHER_0002: resolve(SAMPLES_ROOT, 'other/0002.DCM'),
    /** A DICOM file with nested sequence tags. */
    NESTED_TAGS: resolve(SAMPLES_ROOT, 'other/nestedTags.dcm'),
    /** A DICOM file with non-standard encoding. */
    OTHER_0003: resolve(SAMPLES_ROOT, 'other/0003.DCM'),
    /** An uncompressed DICOM from other/ directory. */
    OTHER_0002D: resolve(SAMPLES_ROOT, 'other/0002d.DCM'),
    /** A TTFM DICOM file. */
    TTFM: resolve(SAMPLES_ROOT, 'other/ttfm.dcm'),
    /** An invalid/bad DICOM file. */
    BAD_0002: resolve(SAMPLES_ROOT, 'bad/0002.DCM'),
    /** Another bad DICOM file. */
    BAD_0003: resolve(SAMPLES_ROOT, 'bad/0003.DCM'),
} as const;

export { SAMPLES };
