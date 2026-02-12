/**
 * Parses extracted DICOM response files from findscu --extract.
 *
 * Creates temp directories, lists .dcm files, and batch-parses them
 * into DicomDataset instances using dcm2json.
 *
 * @module pacs/parseResults
 */

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Result } from '../types';
import { ok, err } from '../types';
import { dcm2json } from '../tools/dcm2json';
import { DicomDataset } from '../dicom/DicomDataset';

/** Maximum number of response files to process (safety bound per Rule 8.1). */
const MAX_RESPONSE_FILES = 10_000;

/**
 * Creates a temporary directory for findscu --extract output.
 *
 * @returns A Result containing the temp directory path
 */
async function createTempDir(): Promise<Result<string>> {
    try {
        const dir = await mkdtemp(join(tmpdir(), 'dcmtk-pacs-'));
        return ok(dir);
    } catch (thrown: unknown) {
        const error = thrown instanceof Error ? thrown : new Error(String(thrown));
        return err(new Error(`Failed to create temp directory: ${error.message}`));
    }
}

/**
 * Lists .dcm files in a directory, bounded by MAX_RESPONSE_FILES.
 *
 * @param directory - Directory to scan
 * @returns A Result containing the sorted file paths
 */
async function listDcmFiles(directory: string): Promise<Result<readonly string[]>> {
    try {
        const entries = await readdir(directory);
        const dcmFiles: string[] = [];
        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            /* v8 ignore next */
            if (entry === undefined) continue;
            if (entry.endsWith('.dcm')) {
                dcmFiles.push(join(directory, entry));
                if (dcmFiles.length >= MAX_RESPONSE_FILES) break;
            }
        }
        dcmFiles.sort();
        return ok(dcmFiles);
    } catch (thrown: unknown) {
        const error = thrown instanceof Error ? thrown : new Error(String(thrown));
        return err(new Error(`Failed to list directory "${directory}": ${error.message}`));
    }
}

/**
 * Removes a temporary directory and its contents. Silently ignores errors.
 *
 * @param directory - Directory to remove
 */
async function cleanupTempDir(directory: string): Promise<void> {
    try {
        await rm(directory, { recursive: true, force: true });
    } catch {
        // Cleanup is best-effort; silently ignore errors
    }
}

/**
 * Parses a single DICOM file into a DicomDataset.
 *
 * @param filePath - Path to the .dcm file
 * @param timeoutMs - Timeout for dcm2json
 * @param signal - Optional abort signal
 * @returns A Result containing the DicomDataset
 */
async function parseSingleFile(filePath: string, timeoutMs: number, signal?: AbortSignal): Promise<Result<DicomDataset>> {
    const jsonResult = await dcm2json(filePath, { timeoutMs, signal });
    if (!jsonResult.ok) {
        return err(jsonResult.error);
    }
    return DicomDataset.fromJson(jsonResult.value.data);
}

/**
 * Parses all extracted .dcm files from a directory into DicomDataset instances.
 *
 * Uses batched parallel parsing with configurable concurrency.
 * Skips files that fail to parse and returns only successful results.
 *
 * @param directory - Directory containing extracted .dcm files
 * @param timeoutMs - Timeout per file for dcm2json
 * @param concurrency - Max concurrent parse operations
 * @param signal - Optional abort signal
 * @returns A Result containing the array of DicomDatasets
 */
async function parseExtractedFiles(directory: string, timeoutMs: number, concurrency: number, signal?: AbortSignal): Promise<Result<readonly DicomDataset[]>> {
    const listResult = await listDcmFiles(directory);
    if (!listResult.ok) {
        return err(listResult.error);
    }

    const files = listResult.value;
    if (files.length === 0) {
        return ok([]);
    }

    // Batch parse with concurrency control
    const datasets: DicomDataset[] = [];
    const inFlight = new Set<Promise<void>>();
    let nextIndex = 0;

    while (nextIndex < files.length) {
        if (signal?.aborted) break;

        const filePath = files[nextIndex];
        nextIndex += 1;
        /* v8 ignore next */
        if (filePath === undefined) continue;

        const promise = parseSingleFile(filePath, timeoutMs, signal).then(result => {
            if (result.ok) {
                datasets.push(result.value);
            }
        });
        inFlight.add(promise);
        promise.then(
            () => inFlight.delete(promise),
            /* v8 ignore next */
            () => inFlight.delete(promise)
        );

        if (inFlight.size >= concurrency) {
            await Promise.race(inFlight);
        }
    }

    if (inFlight.size > 0) {
        await Promise.all(inFlight);
    }

    return ok(datasets);
}

export { MAX_RESPONSE_FILES, createTempDir, listDcmFiles, cleanupTempDir, parseSingleFile, parseExtractedFiles };
