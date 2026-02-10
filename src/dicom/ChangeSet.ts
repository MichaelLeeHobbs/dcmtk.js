/**
 * Immutable mutation tracking for DICOM datasets.
 *
 * Every mutation method returns a new ChangeSet instance, preserving immutability.
 * Bridge methods produce dcmodify-compatible arguments for applying changes to files.
 *
 * @module dicom/ChangeSet
 */

import type { DicomTagPath } from '../brands';
import type { TagModification } from '../tools/dcmodify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sentinel value in the erasures set to indicate erasing all private tags. */
const ERASE_PRIVATE_SENTINEL = '__ERASE_PRIVATE__';

// ---------------------------------------------------------------------------
// Helpers (extracted for complexity/line limits)
// ---------------------------------------------------------------------------

/**
 * Returns true if a char code is a control character to strip.
 * Strips 0x00-0x09, 0x0B, 0x0C, 0x0E-0x1F, 0x7F.
 * Preserves LF (0x0A), CR (0x0D), and backslash.
 */
function isControlChar(code: number): boolean {
    if (code <= 0x09) return true;
    if (code === 0x0b || code === 0x0c) return true;
    if (code >= 0x0e && code <= 0x1f) return true;
    return code === 0x7f;
}

/** Strips control characters from a value while preserving LF, CR, and backslash. */
function sanitizeValue(value: string): string {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (!isControlChar(code)) {
            result += value[i];
        }
    }
    return result;
}

/** Merges two modification maps, with `other` winning conflicts. Removes keys present in erasures. */
function buildMergedModifications(
    base: ReadonlyMap<string, string>,
    other: ReadonlyMap<string, string>,
    erasures: ReadonlySet<string>
): ReadonlyMap<string, string> {
    const merged = new Map<string, string>(base);
    for (const [key, value] of other) {
        merged.set(key, value);
    }
    for (const key of erasures) {
        merged.delete(key);
    }
    return merged;
}

// ---------------------------------------------------------------------------
// ChangeSet class
// ---------------------------------------------------------------------------

/**
 * Immutable mutation tracker for DICOM datasets.
 *
 * Every mutation method returns a **new** ChangeSet — the original is never modified.
 * Use {@link ChangeSet.toModifications} and {@link ChangeSet.toErasureArgs} to bridge
 * to the dcmodify tool wrapper.
 *
 * @example
 * ```ts
 * const cs = ChangeSet.empty()
 *     .setTag('(0010,0010)' as DicomTagPath, 'Anonymous')
 *     .eraseTag('(0010,0020)' as DicomTagPath)
 *     .erasePrivateTags();
 * ```
 */
class ChangeSet {
    private readonly mods: ReadonlyMap<string, string>;
    private readonly erased: ReadonlySet<string>;

    private constructor(mods: ReadonlyMap<string, string>, erasures: ReadonlySet<string>) {
        this.mods = mods;
        this.erased = erasures;
    }

    /** Creates an empty ChangeSet with no modifications or erasures. */
    static empty(): ChangeSet {
        return new ChangeSet(new Map(), new Set());
    }

    /**
     * Sets a tag value, returning a new ChangeSet.
     *
     * Control characters (except LF/CR) are stripped from the value.
     * If the tag was previously erased, it is removed from the erasure set.
     *
     * @param path - The DICOM tag path to set
     * @param value - The new value for the tag
     * @returns A new ChangeSet with the modification applied
     */
    setTag(path: DicomTagPath, value: string): ChangeSet {
        const sanitized = sanitizeValue(value);
        const newMods = new Map(this.mods);
        newMods.set(path, sanitized);
        const newErasures = new Set(this.erased);
        newErasures.delete(path);
        return new ChangeSet(newMods, newErasures);
    }

    /**
     * Marks a tag for erasure, returning a new ChangeSet.
     *
     * If the tag was previously set, the modification is removed.
     *
     * @param path - The DICOM tag path to erase
     * @returns A new ChangeSet with the erasure applied
     */
    eraseTag(path: DicomTagPath): ChangeSet {
        const newMods = new Map(this.mods);
        newMods.delete(path);
        const newErasures = new Set(this.erased);
        newErasures.add(path);
        return new ChangeSet(newMods, newErasures);
    }

    /**
     * Marks all private tags for erasure, returning a new ChangeSet.
     *
     * @returns A new ChangeSet with the erase-private flag set
     */
    erasePrivateTags(): ChangeSet {
        const newErasures = new Set(this.erased);
        newErasures.add(ERASE_PRIVATE_SENTINEL);
        return new ChangeSet(new Map(this.mods), newErasures);
    }

    /** All pending tag modifications as a readonly map of path → value. */
    get modifications(): ReadonlyMap<string, string> {
        return this.mods;
    }

    /** All pending tag erasures as a readonly set of paths. */
    get erasures(): ReadonlySet<string> {
        return this.erased;
    }

    /** Whether the ChangeSet has no modifications and no erasures. */
    get isEmpty(): boolean {
        return this.mods.size === 0 && this.erased.size === 0;
    }

    /** Whether the erase-all-private-tags flag is set. */
    get erasePrivate(): boolean {
        return this.erased.has(ERASE_PRIVATE_SENTINEL);
    }

    /**
     * Merges another ChangeSet into this one, returning a new ChangeSet.
     *
     * The `other` ChangeSet wins on conflicts: if the same tag is modified in both,
     * `other`'s value is used. Erasures from both sets are unioned. An erasure in
     * `other` removes a modification from `base`.
     *
     * @param other - The ChangeSet to merge in
     * @returns A new ChangeSet with merged modifications and erasures
     */
    merge(other: ChangeSet): ChangeSet {
        const mergedErasures = new Set([...this.erased, ...other.erased]);
        const mergedMods = buildMergedModifications(this.mods, other.mods, mergedErasures);
        return new ChangeSet(mergedMods, mergedErasures);
    }

    /**
     * Converts modifications to dcmodify-compatible TagModification array.
     *
     * @returns A readonly array of TagModification objects
     */
    toModifications(): ReadonlyArray<TagModification> {
        const result: TagModification[] = [];
        for (const [tag, value] of this.mods) {
            result.push({ tag, value });
        }
        return result;
    }

    /**
     * Converts erasures to dcmodify-compatible argument strings.
     *
     * The erase-private sentinel is excluded — use {@link erasePrivate} to check
     * whether `-ep` should be passed.
     *
     * @returns A readonly array of tag path strings for `-e` arguments
     */
    toErasureArgs(): ReadonlyArray<string> {
        const result: string[] = [];
        for (const path of this.erased) {
            if (path !== ERASE_PRIVATE_SENTINEL) {
                result.push(path);
            }
        }
        return result;
    }
}

export { ChangeSet };
