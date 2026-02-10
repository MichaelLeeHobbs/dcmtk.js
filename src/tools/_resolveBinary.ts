/**
 * Resolves the full path to a DCMTK binary.
 *
 * Wraps {@link findDcmtkPath} + `path.join` and appends `.exe` on Windows.
 *
 * @module _resolveBinary
 * @internal
 */

import { join } from 'node:path';
import type { Result } from '../types';
import { ok, err } from '../types';
import { findDcmtkPath } from '../findDcmtkPath';

const isWindows = process.platform === 'win32';

/**
 * Resolves the full filesystem path to a named DCMTK binary.
 *
 * @param toolName - The DCMTK binary name (e.g., "dcm2xml")
 * @returns A Result containing the full binary path or an error if DCMTK is not found
 */
function resolveBinary(toolName: string): Result<string> {
    const pathResult = findDcmtkPath();
    if (!pathResult.ok) {
        return err(pathResult.error);
    }
    /* v8 ignore next -- platform-specific branch */
    const binaryName = isWindows ? `${toolName}.exe` : toolName;
    return ok(join(pathResult.value, binaryName));
}

export { resolveBinary };
