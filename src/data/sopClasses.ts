/**
 * Curated list of common DICOM SOP Class UIDs.
 *
 * This is not exhaustive — DICOM defines hundreds of SOP classes.
 * This file covers the ~70 most commonly encountered SOP classes
 * in clinical and research imaging workflows.
 *
 * @see DICOM PS3.4 Annex B — SOP Class definitions
 * @module data/sopClasses
 */

/**
 * Common DICOM SOP Class UIDs.
 *
 * Keys are PascalCase names matching the DICOM standard keyword.
 * Values are the dotted-numeric UID strings.
 */
const SOP_CLASSES = {
    // -----------------------------------------------------------------------
    // Verification
    // -----------------------------------------------------------------------
    Verification: '1.2.840.10008.1.1',

    // -----------------------------------------------------------------------
    // Storage — Image
    // -----------------------------------------------------------------------
    ComputedRadiographyImageStorage: '1.2.840.10008.5.1.4.1.1.1',
    DigitalXRayImageStorageForPresentation: '1.2.840.10008.5.1.4.1.1.1.1',
    DigitalXRayImageStorageForProcessing: '1.2.840.10008.5.1.4.1.1.1.1.1',
    DigitalMammographyXRayImageStorageForPresentation: '1.2.840.10008.5.1.4.1.1.1.2',
    DigitalMammographyXRayImageStorageForProcessing: '1.2.840.10008.5.1.4.1.1.1.2.1',
    CTImageStorage: '1.2.840.10008.5.1.4.1.1.2',
    EnhancedCTImageStorage: '1.2.840.10008.5.1.4.1.1.2.1',
    UltrasoundMultiFrameImageStorage: '1.2.840.10008.5.1.4.1.1.3.1',
    MRImageStorage: '1.2.840.10008.5.1.4.1.1.4',
    EnhancedMRImageStorage: '1.2.840.10008.5.1.4.1.1.4.1',
    MRSpectroscopyStorage: '1.2.840.10008.5.1.4.1.1.4.2',
    EnhancedMRColorImageStorage: '1.2.840.10008.5.1.4.1.1.4.3',
    UltrasoundImageStorage: '1.2.840.10008.5.1.4.1.1.6.1',
    EnhancedUSVolumeStorage: '1.2.840.10008.5.1.4.1.1.6.2',
    SecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7',
    MultiFrameSingleBitSecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7.1',
    MultiFrameGrayscaleByteSecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7.2',
    MultiFrameGrayscaleWordSecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7.3',
    MultiFrameTrueColorSecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7.4',
    XRayAngiographicImageStorage: '1.2.840.10008.5.1.4.1.1.12.1',
    EnhancedXAImageStorage: '1.2.840.10008.5.1.4.1.1.12.1.1',
    XRayRadiofluoroscopicImageStorage: '1.2.840.10008.5.1.4.1.1.12.2',
    EnhancedXRFImageStorage: '1.2.840.10008.5.1.4.1.1.12.2.1',
    NuclearMedicineImageStorage: '1.2.840.10008.5.1.4.1.1.20',
    VLEndoscopicImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.1',
    VLMicroscopicImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.2',
    VLSlideCoordinatesMicroscopicImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.3',
    VLPhotographicImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.4',
    OphthalmicPhotography8BitImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.5.1',
    OphthalmicPhotography16BitImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.5.2',
    VLWholeSlideMicroscopyImageStorage: '1.2.840.10008.5.1.4.1.1.77.1.6',
    PositronEmissionTomographyImageStorage: '1.2.840.10008.5.1.4.1.1.128',
    EnhancedPETImageStorage: '1.2.840.10008.5.1.4.1.1.130',

    // -----------------------------------------------------------------------
    // Storage — RT (Radiation Therapy)
    // -----------------------------------------------------------------------
    RTImageStorage: '1.2.840.10008.5.1.4.1.1.481.1',
    RTDoseStorage: '1.2.840.10008.5.1.4.1.1.481.2',
    RTStructureSetStorage: '1.2.840.10008.5.1.4.1.1.481.3',
    RTBeamsTreatmentRecordStorage: '1.2.840.10008.5.1.4.1.1.481.4',
    RTPlanStorage: '1.2.840.10008.5.1.4.1.1.481.5',
    RTBrachyTreatmentRecordStorage: '1.2.840.10008.5.1.4.1.1.481.6',
    RTTreatmentSummaryRecordStorage: '1.2.840.10008.5.1.4.1.1.481.7',
    RTIonPlanStorage: '1.2.840.10008.5.1.4.1.1.481.8',
    RTIonBeamsTreatmentRecordStorage: '1.2.840.10008.5.1.4.1.1.481.9',

    // -----------------------------------------------------------------------
    // Storage — Non-image
    // -----------------------------------------------------------------------
    BasicTextSRStorage: '1.2.840.10008.5.1.4.1.1.88.11',
    EnhancedSRStorage: '1.2.840.10008.5.1.4.1.1.88.22',
    ComprehensiveSRStorage: '1.2.840.10008.5.1.4.1.1.88.33',
    Comprehensive3DSRStorage: '1.2.840.10008.5.1.4.1.1.88.34',
    KeyObjectSelectionDocumentStorage: '1.2.840.10008.5.1.4.1.1.88.59',
    GrayscaleSoftcopyPresentationStateStorage: '1.2.840.10008.5.1.4.1.1.11.1',
    ColorSoftcopyPresentationStateStorage: '1.2.840.10008.5.1.4.1.1.11.2',
    EncapsulatedPDFStorage: '1.2.840.10008.5.1.4.1.1.104.1',
    EncapsulatedCDAStorage: '1.2.840.10008.5.1.4.1.1.104.2',
    RawDataStorage: '1.2.840.10008.5.1.4.1.1.66',
    SpatialRegistrationStorage: '1.2.840.10008.5.1.4.1.1.66.1',
    SpatialFiducialsStorage: '1.2.840.10008.5.1.4.1.1.66.2',
    DeformableSpatialRegistrationStorage: '1.2.840.10008.5.1.4.1.1.66.3',
    SegmentationStorage: '1.2.840.10008.5.1.4.1.1.66.4',
    SurfaceSegmentationStorage: '1.2.840.10008.5.1.4.1.1.66.5',

    // -----------------------------------------------------------------------
    // Storage — Waveform
    // -----------------------------------------------------------------------
    TwelveLeadECGWaveformStorage: '1.2.840.10008.5.1.4.1.1.9.1.1',
    GeneralECGWaveformStorage: '1.2.840.10008.5.1.4.1.1.9.1.2',
    AmbulatoryECGWaveformStorage: '1.2.840.10008.5.1.4.1.1.9.1.3',
    HemodynamicWaveformStorage: '1.2.840.10008.5.1.4.1.1.9.2.1',
    BasicVoiceAudioWaveformStorage: '1.2.840.10008.5.1.4.1.1.9.4.1',

    // -----------------------------------------------------------------------
    // Query/Retrieve
    // -----------------------------------------------------------------------
    PatientRootQueryRetrieveInformationModelFind: '1.2.840.10008.5.1.4.1.2.1.1',
    PatientRootQueryRetrieveInformationModelMove: '1.2.840.10008.5.1.4.1.2.1.2',
    PatientRootQueryRetrieveInformationModelGet: '1.2.840.10008.5.1.4.1.2.1.3',
    StudyRootQueryRetrieveInformationModelFind: '1.2.840.10008.5.1.4.1.2.2.1',
    StudyRootQueryRetrieveInformationModelMove: '1.2.840.10008.5.1.4.1.2.2.2',
    StudyRootQueryRetrieveInformationModelGet: '1.2.840.10008.5.1.4.1.2.2.3',

    // -----------------------------------------------------------------------
    // Worklist
    // -----------------------------------------------------------------------
    ModalityWorklistInformationModelFind: '1.2.840.10008.5.1.4.31',

    // -----------------------------------------------------------------------
    // Storage Commitment
    // -----------------------------------------------------------------------
    StorageCommitmentPushModel: '1.2.840.10008.1.20.1',
} as const;

/** A SOP class name key from the curated list. */
type SOPClassName = keyof typeof SOP_CLASSES;

// ---------------------------------------------------------------------------
// Reverse lookup (lazily built)
// ---------------------------------------------------------------------------

let uidToNameMap: ReadonlyMap<string, SOPClassName> | undefined;

function buildUidToNameMap(): ReadonlyMap<string, SOPClassName> {
    const map = new Map<string, SOPClassName>();
    const entries = Object.entries(SOP_CLASSES) as ReadonlyArray<[SOPClassName, string]>;
    for (const [name, uid] of entries) {
        map.set(uid, name);
    }
    return map;
}

/**
 * Looks up the SOP class name for a given UID string.
 *
 * @param uid - A DICOM SOP Class UID string
 * @returns The SOP class name, or undefined if not in the curated list
 */
function sopClassNameFromUID(uid: string): SOPClassName | undefined {
    if (uidToNameMap === undefined) {
        uidToNameMap = buildUidToNameMap();
    }
    return uidToNameMap.get(uid);
}

export { SOP_CLASSES, sopClassNameFromUID };
export type { SOPClassName };
