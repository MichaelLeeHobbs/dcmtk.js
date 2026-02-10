import { copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

/**
 * Copies a sample DICOM file to a temp directory for in-place modification tests.
 *
 * @param sourcePath - Absolute path to the source DICOM file
 * @param tempDir - Absolute path to the temp directory
 * @param newName - Optional new filename (defaults to original basename)
 * @returns Absolute path to the copied file
 */
async function copyDicomToTemp(sourcePath: string, tempDir: string, newName?: string): Promise<string> {
    const filename = newName ?? basename(sourcePath);
    const destPath = join(tempDir, filename);
    await copyFile(sourcePath, destPath);
    return destPath;
}

export { copyDicomToTemp };
