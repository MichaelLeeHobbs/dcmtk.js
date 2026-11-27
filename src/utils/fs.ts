/**
 * Shared filesystem utilities returning Result types.
 *
 * @module utils/fs
 */

import { mkdir, rename, copyFile, unlink, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '../types';
import { ok, err } from '../types';

/**
 * Ensures a directory exists, creating it recursively if needed.
 *
 * @param dirPath - Directory path to create
 * @returns A Result indicating success or failure
 */
async function ensureDirectory(dirPath: string): Promise<Result<void>> {
    try {
        await mkdir(dirPath, { recursive: true });
        return ok(undefined);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return err(new Error(`Failed to create directory ${dirPath}: ${msg}`));
    }
}

/**
 * Moves a file from src to dest, falling back to copy+delete on cross-device.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 * @returns A Result indicating success or failure
 */
async function moveFile(src: string, dest: string): Promise<Result<void>> {
    try {
        await rename(src, dest);
        return ok(undefined);
    } catch {
        try {
            await copyFile(src, dest);
            await unlink(src);
            return ok(undefined);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return err(new Error(`Failed to move file ${src} → ${dest}: ${msg}`));
        }
    }
}

/**
 * Returns the file size in bytes, or 0 on error.
 *
 * @param filePath - Path to the file
 * @returns The file size in bytes, or 0 if the file cannot be stat'd
 */
async function statFileSafe(filePath: string): Promise<number> {
    try {
        const s = await stat(filePath);
        return s.size;
    } catch {
        /* v8 ignore next */
        return 0;
    }
}

/**
 * Removes a directory recursively, ignoring errors.
 *
 * @param dirPath - Directory path to remove
 */
async function removeDirSafe(dirPath: string): Promise<void> {
    try {
        await rm(dirPath, { recursive: true, force: true });
    } catch {
        /* best-effort cleanup */
    }
}

/**
 * Lists the full paths of the entries in a directory. A missing directory is an empty list.
 *
 * @param dirPath - Directory to list
 * @returns A Result with the entry paths, or an error if the directory exists but cannot be read
 */
async function listDirSafe(dirPath: string): Promise<Result<string[]>> {
    try {
        const names = await readdir(dirPath);
        return ok(names.map(name => join(dirPath, name)));
    } catch (e: unknown) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
            return ok([]);
        }
        const msg = e instanceof Error ? e.message : String(e);
        return err(new Error(`Failed to list directory ${dirPath}: ${msg}`));
    }
}

export { ensureDirectory, moveFile, statFileSafe, removeDirSafe, listDirSafe };
