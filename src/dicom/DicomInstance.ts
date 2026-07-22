/**
 * Unified DICOM object composing DicomDataset + ChangeSet + file I/O.
 *
 * Every setter returns a new DicomInstance — the original is never modified.
 * Designed for ergonomic DICOM workflows that combine reading, modifying,
 * and writing DICOM data in a single fluent API.
 *
 * @module dicom/DicomInstance
 */

import type { DicomFilePath, DicomTag, DicomTagPath, SOPClassUID } from '../brands';
import { createDicomFilePath } from '../brands';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import type { Result } from '../types';
import { err, ok } from '../types';
import { ChangeSet } from './ChangeSet';
import { DicomDataset } from './DicomDataset';
import { dcm2json, dicom2json } from '../tools';
import type { DicomJsonModel } from '../tools';
import type { DicomOpenOptions, FileIOOptions } from './_fileHelpers';
import { applyModifications, copyFileSafe, statFileSize, unlinkFile } from './_fileHelpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads a DICOM file into the JSON Model using the engine selected in the options. */
async function readDicomJson(path: string, options?: DicomOpenOptions): Promise<Result<DicomJsonModel>> {
    const shared = {
        timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal: options?.signal,
        charsetAssume: options?.charsetAssume,
        charsetFallback: options?.charsetFallback,
    };
    const result = options?.engine === 'dcmtk' ? await dcm2json(path, shared) : await dicom2json(path, { ...shared, dcmtkFallback: true });
    if (!result.ok) return err(result.error);
    return ok(result.value.data);
}

// ---------------------------------------------------------------------------
// DicomInstance class
// ---------------------------------------------------------------------------

/**
 * Unified DICOM object composing dataset, change tracking, file path, and metadata.
 *
 * Every setter returns a new immutable instance — the original is never modified.
 * Use the static factories {@link DicomInstance.open} or {@link DicomInstance.fromDataset}
 * to create instances.
 *
 * @example
 * ```ts
 * const result = await DicomInstance.open('/path/to/file.dcm');
 * if (!result.ok) { console.error(result.error.message); return; }
 * const modified = result.value
 *     .setPatientName('DOE^JOHN')
 *     .setPatientID('PAT001')
 *     .erasePrivateTags();
 * await modified.writeAs('/path/to/output.dcm');
 * ```
 */
class DicomInstance {
    private readonly dicomDataset: DicomDataset;
    private readonly changeSet: ChangeSet;
    private readonly filepath: DicomFilePath | undefined;
    private readonly meta: ReadonlyMap<string, unknown>;

    private constructor(dataset: DicomDataset, changes: ChangeSet, filePath: DicomFilePath | undefined, metadata: ReadonlyMap<string, unknown>) {
        this.dicomDataset = dataset;
        this.changeSet = changes;
        this.filepath = filePath;
        this.meta = metadata;
    }

    // -----------------------------------------------------------------------
    // Factories
    // -----------------------------------------------------------------------

    /**
     * Opens a DICOM file and creates a DicomInstance.
     *
     * @param path - Filesystem path to the DICOM file
     * @param options - Timeout, abort, and charset options
     * @returns A Result containing the DicomInstance or an error
     */
    static async open(path: string, options?: DicomOpenOptions): Promise<Result<DicomInstance>> {
        const filePathResult = createDicomFilePath(path);
        if (!filePathResult.ok) return err(filePathResult.error);

        const jsonResult = await readDicomJson(path, options);
        if (!jsonResult.ok) return err(jsonResult.error);

        const datasetResult = DicomDataset.fromJson(jsonResult.value);
        if (!datasetResult.ok) return err(datasetResult.error);

        return ok(new DicomInstance(datasetResult.value, ChangeSet.empty(), filePathResult.value, new Map()));
    }

    /**
     * Creates a DicomInstance from an existing DicomDataset.
     *
     * @param dataset - The DicomDataset to wrap
     * @param filePath - Optional file path (e.g. if the dataset came from a file)
     * @returns A Result containing the DicomInstance
     */
    static fromDataset(dataset: DicomDataset, filePath?: string): Result<DicomInstance> {
        let fp: DicomFilePath | undefined;
        if (filePath !== undefined) {
            const fpResult = createDicomFilePath(filePath);
            if (!fpResult.ok) return err(fpResult.error);
            fp = fpResult.value;
        }
        return ok(new DicomInstance(dataset, ChangeSet.empty(), fp, new Map()));
    }

    // -----------------------------------------------------------------------
    // Read accessors (delegate to DicomDataset)
    // -----------------------------------------------------------------------

    /** The underlying immutable DICOM dataset. */
    get dataset(): DicomDataset {
        return this.dicomDataset;
    }

    /** The pending change set. */
    get changes(): ChangeSet {
        return this.changeSet;
    }

    /** Whether there are unsaved changes. */
    get hasUnsavedChanges(): boolean {
        return !this.changeSet.isEmpty;
    }

    /** The file path, or undefined if this instance has no associated file. */
    get filePath(): string | undefined {
        return this.filepath;
    }

    /** Patient's Name (0010,0010). */
    get patientName(): string {
        return this.dicomDataset.patientName;
    }

    /** Patient ID (0010,0020). */
    get patientID(): string {
        return this.dicomDataset.patientID;
    }

    /** Study Date (0008,0020). */
    get studyDate(): string {
        return this.dicomDataset.studyDate;
    }

    /** Modality (0008,0060). */
    get modality(): string {
        return this.dicomDataset.modality;
    }

    /** Accession Number (0008,0050). */
    get accession(): string {
        return this.dicomDataset.accession;
    }

    /** SOP Class UID (0008,0016). */
    get sopClassUID(): SOPClassUID | undefined {
        return this.dicomDataset.sopClassUID;
    }

    /** Study Instance UID (0020,000D). */
    get studyInstanceUID(): string {
        return this.dicomDataset.studyInstanceUID;
    }

    /** Series Instance UID (0020,000E). */
    get seriesInstanceUID(): string {
        return this.dicomDataset.seriesInstanceUID;
    }

    /** SOP Instance UID (0008,0018). */
    get sopInstanceUID(): string {
        return this.dicomDataset.sopInstanceUID;
    }

    /** Transfer Syntax UID (0002,0010). */
    get transferSyntaxUID(): string {
        return this.dicomDataset.transferSyntaxUID;
    }

    /**
     * Gets a tag value as a string with optional fallback.
     *
     * @param tag - A DICOM tag, e.g. `'(0010,0010)'` or `'00100010'`
     * @param fallback - Value to return if tag is missing (default: `''`)
     */
    getString(tag: DicomTag | string, fallback = ''): string {
        return this.dicomDataset.getString(tag, fallback);
    }

    /**
     * Gets a tag value as a number.
     *
     * @param tag - A DICOM tag, e.g. `'(0020,0013)'`
     */
    getNumber(tag: DicomTag | string): Result<number> {
        return this.dicomDataset.getNumber(tag);
    }

    /** Checks whether a tag exists in the dataset. */
    hasTag(tag: DicomTag | string): boolean {
        return this.dicomDataset.hasTag(tag);
    }

    /**
     * Finds all values matching a wildcard path.
     *
     * @param path - A DicomTagPath with optional wildcard indices
     */
    findValues(path: DicomTagPath): ReadonlyArray<unknown> {
        return this.dicomDataset.findValues(path);
    }

    // -----------------------------------------------------------------------
    // Write methods (return new instance)
    // -----------------------------------------------------------------------

    /**
     * Sets a tag value, returning a new DicomInstance.
     *
     * @param path - The DICOM tag path (e.g. `'(0010,0010)'`)
     * @param value - The new value
     */
    setTag(path: string, value: string): DicomInstance {
        return new DicomInstance(this.dicomDataset, this.changeSet.setTag(path, value), this.filepath, this.meta);
    }

    /**
     * Erases a tag, returning a new DicomInstance.
     *
     * @param path - The DICOM tag path to erase
     */
    eraseTag(path: string): DicomInstance {
        return new DicomInstance(this.dicomDataset, this.changeSet.eraseTag(path), this.filepath, this.meta);
    }

    /** Erases all private tags, returning a new DicomInstance. */
    erasePrivateTags(): DicomInstance {
        return new DicomInstance(this.dicomDataset, this.changeSet.erasePrivateTags(), this.filepath, this.meta);
    }

    /** Sets Patient's Name (0010,0010). */
    setPatientName(value: string): DicomInstance {
        return this.setTag('(0010,0010)', value);
    }

    /** Sets Patient ID (0010,0020). */
    setPatientID(value: string): DicomInstance {
        return this.setTag('(0010,0020)', value);
    }

    /** Sets Study Date (0008,0020). */
    setStudyDate(value: string): DicomInstance {
        return this.setTag('(0008,0020)', value);
    }

    /** Sets Modality (0008,0060). */
    setModality(value: string): DicomInstance {
        return this.setTag('(0008,0060)', value);
    }

    /** Sets Accession Number (0008,0050). */
    setAccessionNumber(value: string): DicomInstance {
        return this.setTag('(0008,0050)', value);
    }

    /** Sets Study Description (0008,1030). */
    setStudyDescription(value: string): DicomInstance {
        return this.setTag('(0008,1030)', value);
    }

    /** Sets Series Description (0008,103E). */
    setSeriesDescription(value: string): DicomInstance {
        return this.setTag('(0008,103E)', value);
    }

    /** Sets Institution Name (0008,0080). */
    setInstitutionName(value: string): DicomInstance {
        return this.setTag('(0008,0080)', value);
    }

    /**
     * Transforms a tag value using a function.
     *
     * The function receives the current string value (or undefined if tag is missing)
     * and returns the new value. Returns a new DicomInstance with the modification.
     *
     * @param path - The DICOM tag path
     * @param fn - Transform function receiving the current value
     */
    transformTag(path: string, fn: (current: string | undefined) => string): DicomInstance {
        const current = this.dicomDataset.getString(path);
        const newValue = fn(current.length > 0 ? current : undefined);
        return this.setTag(path, newValue);
    }

    /**
     * Sets multiple tags at once, returning a new DicomInstance.
     *
     * @param entries - A record of tag path → value pairs
     */
    setBatch(entries: Readonly<Record<string, string>>): DicomInstance {
        return new DicomInstance(this.dicomDataset, this.changeSet.setBatch(entries), this.filepath, this.meta);
    }

    /**
     * Returns a new DicomInstance with the given changes merged into pending changes.
     *
     * @param changes - A ChangeSet to merge with existing pending changes
     * @returns A new DicomInstance with accumulated changes
     */
    withChanges(changes: ChangeSet): DicomInstance {
        return new DicomInstance(this.dicomDataset, this.changeSet.merge(changes), this.filepath, this.meta);
    }

    /**
     * Returns a new DicomInstance pointing to a different file path.
     *
     * Preserves the dataset, pending changes, and metadata.
     *
     * @param newPath - The new filesystem path (validated via createDicomFilePath)
     * @returns A new DicomInstance with the updated path
     * @throws If the path is invalid
     */
    withFilePath(newPath: string): DicomInstance {
        const result = createDicomFilePath(newPath);
        if (!result.ok) throw result.error;
        return new DicomInstance(this.dicomDataset, this.changeSet, result.value, this.meta);
    }

    // -----------------------------------------------------------------------
    // File I/O
    // -----------------------------------------------------------------------

    /**
     * Applies pending changes to the file in-place.
     *
     * Requires that the instance has an associated file path.
     *
     * @param options - Timeout and abort options
     */
    async applyChanges(options?: FileIOOptions): Promise<Result<void>> {
        if (this.filepath === undefined) return err(new Error('No file path associated with this instance'));
        if (this.changeSet.isEmpty) return ok(undefined);
        return applyModifications(this.filepath, this.changeSet, options ?? {});
    }

    /**
     * Copies the file to a new path and applies pending changes to the copy.
     *
     * Returns a new DicomInstance pointing to the output path.
     *
     * @param outputPath - Destination filesystem path
     * @param options - Timeout and abort options
     */
    async writeAs(outputPath: string, options?: FileIOOptions): Promise<Result<DicomInstance>> {
        if (this.filepath === undefined) return err(new Error('No file path associated with this instance'));

        const outPathResult = createDicomFilePath(outputPath);
        if (!outPathResult.ok) return err(outPathResult.error);

        const copyResult = await copyFileSafe(this.filepath, outputPath);
        if (!copyResult.ok) return err(copyResult.error);

        if (!this.changeSet.isEmpty) {
            const applyResult = await applyModifications(outPathResult.value, this.changeSet, options ?? {});
            if (!applyResult.ok) {
                await unlinkFile(outputPath);
                return err(applyResult.error);
            }
        }

        return ok(new DicomInstance(this.dicomDataset, ChangeSet.empty(), outPathResult.value, this.meta));
    }

    /**
     * Gets the file size in bytes.
     *
     * @returns A Result containing the size or an error
     */
    async fileSize(): Promise<Result<number>> {
        if (this.filepath === undefined) return err(new Error('No file path associated with this instance'));
        return statFileSize(this.filepath);
    }

    /**
     * Deletes the associated file from the filesystem.
     *
     * @returns A Result indicating success or failure
     */
    async unlink(): Promise<Result<void>> {
        if (this.filepath === undefined) return err(new Error('No file path associated with this instance'));
        return unlinkFile(this.filepath);
    }

    // -----------------------------------------------------------------------
    // Metadata (non-DICOM app context)
    // -----------------------------------------------------------------------

    /**
     * Returns a new DicomInstance with application metadata attached.
     *
     * Metadata is not stored in the DICOM file — it's for application context
     * (e.g. tracking source association, processing status, etc.).
     *
     * @param key - Metadata key
     * @param value - Metadata value
     */
    withMetadata(key: string, value: unknown): DicomInstance {
        const newMeta = new Map(this.meta);
        newMeta.set(key, value);
        return new DicomInstance(this.dicomDataset, this.changeSet, this.filepath, newMeta);
    }

    /**
     * Gets application metadata by key.
     *
     * @param key - Metadata key
     * @returns The metadata value or undefined
     */
    getMetadata(key: string): unknown {
        return this.meta.get(key);
    }
}

export { DicomInstance };
