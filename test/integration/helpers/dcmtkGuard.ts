import { findDcmtkPath } from '../../../src/findDcmtkPath';

/**
 * Returns true if DCMTK binaries are available on the system.
 * Used with `describe.skipIf(!dcmtkAvailable)` so CI without DCMTK skips gracefully.
 */
function isDcmtkAvailable(): boolean {
    const result = findDcmtkPath({ noCache: true });
    return result.ok;
}

/** Cached result — evaluated once at module load. */
const dcmtkAvailable = isDcmtkAvailable();

export { dcmtkAvailable };
