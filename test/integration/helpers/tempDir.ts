import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Creates a temporary directory with the given prefix.
 *
 * @param prefix - Directory name prefix (e.g. 'dcmtk-test-')
 * @returns Absolute path to the created temp directory
 */
async function createTempDir(prefix = 'dcmtk-test-'): Promise<string> {
    return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Removes a temporary directory and all its contents.
 *
 * @param path - Absolute path to the directory to remove
 */
async function removeTempDir(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
}

export { createTempDir, removeTempDir };
