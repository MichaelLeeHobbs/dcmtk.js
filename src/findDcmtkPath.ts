/**
 * Locates DCMTK binaries on the host system.
 *
 * Search order:
 * 1. `DCMTK_PATH` environment variable
 * 2. Platform-specific known install locations
 * 3. System PATH (via `which`/`where` lookup)
 *
 * @module findDcmtkPath
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Result } from './types';
import { ok, err } from './types';
import { WINDOWS_SEARCH_PATHS, UNIX_SEARCH_PATHS, REQUIRED_BINARIES } from './constants';

/** Cached path result. Cleared only by passing `noCache: true`. */
let cachedPath: string | undefined;

const isWindows = process.platform === 'win32';

/**
 * Returns the binary filename with platform-appropriate extension.
 *
 * @param name - The base binary name (e.g., `"dcm2json"`)
 * @returns The binary name with `.exe` appended on Windows
 */
function binaryName(name: string): string {
    /* v8 ignore next -- platform-specific branch */
    return isWindows ? `${name}.exe` : name;
}

/**
 * Checks whether a directory contains all required DCMTK binaries.
 *
 * @param dir - The directory to check
 * @returns `true` if all required binaries exist in the directory
 */
function hasRequiredBinaries(dir: string): boolean {
    for (const bin of REQUIRED_BINARIES) {
        if (!existsSync(join(dir, binaryName(bin)))) {
            return false;
        }
    }
    return true;
}

/**
 * Attempts to locate a binary via the system PATH using `which` (Unix) or `where` (Windows).
 *
 * @param name - The binary name to search for
 * @returns The directory containing the binary, or `undefined` if not found
 */
function findViaSystemPath(name: string): string | undefined {
    try {
        /* v8 ignore next -- platform-specific branch */
        const cmd = isWindows ? `where ${binaryName(name)}` : `which ${name}`;
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 5_000, windowsHide: true }).trim();
        const firstLine = result.split('\n')[0]?.trim();
        if (firstLine) {
            /* v8 ignore next -- platform-specific branch */
            const lastSep = firstLine.lastIndexOf(isWindows ? '\\' : '/');
            if (lastSep >= 0) {
                return firstLine.substring(0, lastSep);
            }
        }
    } catch {
        // Binary not in PATH — this is expected, not exceptional
    }
    return undefined;
}

/**
 * Checks the DCMTK_PATH environment variable for a valid DCMTK installation.
 *
 * @returns A Result if the env var is set (success or error), or `undefined` if unset
 */
function searchEnvPath(): Result<string> | undefined {
    const envPath = process.env['DCMTK_PATH'];
    if (envPath === undefined || envPath.length === 0) {
        return undefined;
    }
    if (hasRequiredBinaries(envPath)) {
        return ok(envPath);
    }
    return err(new Error(`DCMTK_PATH="${envPath}" is set but required binaries are missing`));
}

/**
 * Searches platform-specific known install locations for DCMTK binaries.
 *
 * @returns The directory path if found, or `undefined`
 */
function searchKnownPaths(): string | undefined {
    /* v8 ignore next -- platform-specific branch */
    const searchPaths = isWindows ? WINDOWS_SEARCH_PATHS : UNIX_SEARCH_PATHS;
    for (const candidate of searchPaths) {
        if (hasRequiredBinaries(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

/**
 * Searches the system PATH for DCMTK binaries.
 *
 * @returns The directory path if found, or `undefined`
 */
function searchSystemPath(): string | undefined {
    /* v8 ignore next -- fallback never used since REQUIRED_BINARIES is non-empty */
    const systemDir = findViaSystemPath(REQUIRED_BINARIES[0] ?? 'dcm2json');
    if (systemDir !== undefined && hasRequiredBinaries(systemDir)) {
        return systemDir;
    }
    return undefined;
}

/**
 * Options for {@link findDcmtkPath}.
 */
interface FindDcmtkPathOptions {
    /** Bypass the cached result and perform a fresh search. */
    readonly noCache?: boolean | undefined;
}

/**
 * Locates the directory containing DCMTK command-line binaries.
 *
 * Searches in the following order:
 * 1. `DCMTK_PATH` environment variable (if set)
 * 2. Platform-specific known install locations
 * 3. System PATH lookup via `which`/`where`
 *
 * The result is cached after the first successful call. Pass `{ noCache: true }`
 * to force a fresh search.
 *
 * @param options - Optional configuration
 * @returns A Result containing the DCMTK binary directory path, or an error if not found
 * @throws Never throws for expected failures (Rule 6.1)
 *
 * @example
 * ```ts
 * const result = findDcmtkPath();
 * if (result.ok) {
 *     console.log(`DCMTK found at: ${result.value}`);
 * } else {
 *     console.error(result.error.message);
 * }
 * ```
 */
function findDcmtkPath(options?: FindDcmtkPathOptions): Result<string> {
    if (cachedPath !== undefined && !options?.noCache) {
        return ok(cachedPath);
    }

    const envResult = searchEnvPath();
    if (envResult !== undefined) {
        if (envResult.ok) {
            cachedPath = envResult.value;
        }
        return envResult;
    }

    const knownPath = searchKnownPaths();
    if (knownPath !== undefined) {
        cachedPath = knownPath;
        return ok(knownPath);
    }

    const systemPath = searchSystemPath();
    if (systemPath !== undefined) {
        cachedPath = systemPath;
        return ok(systemPath);
    }

    return err(
        new Error(
            'DCMTK binaries not found. Install DCMTK and either:\n' +
                '  - Set the DCMTK_PATH environment variable, or\n' +
                '  - Install DCMTK to a standard location, or\n' +
                '  - Ensure DCMTK binaries are on the system PATH'
        )
    );
}

/**
 * Clears the cached DCMTK path. Primarily for testing.
 */
function clearDcmtkPathCache(): void {
    cachedPath = undefined;
}

export { findDcmtkPath, clearDcmtkPathCache };
export type { FindDcmtkPathOptions };
