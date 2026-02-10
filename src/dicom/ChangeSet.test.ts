import { describe, it, expect } from 'vitest';
import { ChangeSet } from './ChangeSet';
import type { DicomTagPath } from '../brands';

const path = (s: string): DicomTagPath => s as DicomTagPath;

describe('ChangeSet', () => {
    describe('empty()', () => {
        it('creates a ChangeSet with no modifications', () => {
            const cs = ChangeSet.empty();
            expect(cs.modifications.size).toBe(0);
        });

        it('creates a ChangeSet with no erasures', () => {
            const cs = ChangeSet.empty();
            expect(cs.erasures.size).toBe(0);
        });

        it('isEmpty is true', () => {
            expect(ChangeSet.empty().isEmpty).toBe(true);
        });

        it('erasePrivate is false', () => {
            expect(ChangeSet.empty().erasePrivate).toBe(false);
        });
    });

    describe('setTag()', () => {
        it('stores a tag value', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Anonymous');
            expect(cs.modifications.get('(0010,0010)')).toBe('Anonymous');
        });

        it('sanitizes control characters', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test\x00\x01\x02Value');
            expect(cs.modifications.get('(0010,0010)')).toBe('TestValue');
        });

        it('preserves LF character', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Line1\nLine2');
            expect(cs.modifications.get('(0010,0010)')).toBe('Line1\nLine2');
        });

        it('preserves CR character', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Line1\rLine2');
            expect(cs.modifications.get('(0010,0010)')).toBe('Line1\rLine2');
        });

        it('preserves backslash', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Value\\Multi');
            expect(cs.modifications.get('(0010,0010)')).toBe('Value\\Multi');
        });

        it('removes tag from erasures set', () => {
            const cs = ChangeSet.empty().eraseTag(path('(0010,0010)')).setTag(path('(0010,0010)'), 'NewValue');
            expect(cs.erasures.has('(0010,0010)')).toBe(false);
            expect(cs.modifications.get('(0010,0010)')).toBe('NewValue');
        });

        it('overwrites previous value for same tag', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'First').setTag(path('(0010,0010)'), 'Second');
            expect(cs.modifications.get('(0010,0010)')).toBe('Second');
        });

        it('makes isEmpty false', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            expect(cs.isEmpty).toBe(false);
        });
    });

    describe('eraseTag()', () => {
        it('adds tag to erasures set', () => {
            const cs = ChangeSet.empty().eraseTag(path('(0010,0020)'));
            expect(cs.erasures.has('(0010,0020)')).toBe(true);
        });

        it('removes tag from modifications', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test').eraseTag(path('(0010,0010)'));
            expect(cs.modifications.has('(0010,0010)')).toBe(false);
            expect(cs.erasures.has('(0010,0010)')).toBe(true);
        });

        it('is idempotent', () => {
            const cs = ChangeSet.empty().eraseTag(path('(0010,0010)')).eraseTag(path('(0010,0010)'));
            expect(cs.erasures.size).toBe(1);
        });

        it('makes isEmpty false', () => {
            const cs = ChangeSet.empty().eraseTag(path('(0010,0010)'));
            expect(cs.isEmpty).toBe(false);
        });
    });

    describe('erasePrivateTags()', () => {
        it('sets erasePrivate to true', () => {
            const cs = ChangeSet.empty().erasePrivateTags();
            expect(cs.erasePrivate).toBe(true);
        });

        it('makes isEmpty false', () => {
            const cs = ChangeSet.empty().erasePrivateTags();
            expect(cs.isEmpty).toBe(false);
        });
    });

    describe('immutability', () => {
        it('setTag does not modify original', () => {
            const original = ChangeSet.empty();
            original.setTag(path('(0010,0010)'), 'Test');
            expect(original.isEmpty).toBe(true);
        });

        it('eraseTag does not modify original', () => {
            const original = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            original.eraseTag(path('(0010,0010)'));
            expect(original.modifications.has('(0010,0010)')).toBe(true);
        });

        it('erasePrivateTags does not modify original', () => {
            const original = ChangeSet.empty();
            original.erasePrivateTags();
            expect(original.erasePrivate).toBe(false);
        });

        it('merge does not modify original', () => {
            const original = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            const other = ChangeSet.empty().setTag(path('(0010,0020)'), 'Other');
            original.merge(other);
            expect(original.modifications.size).toBe(1);
        });
    });

    describe('merge()', () => {
        it('merges non-overlapping modifications', () => {
            const a = ChangeSet.empty().setTag(path('(0010,0010)'), 'Name');
            const b = ChangeSet.empty().setTag(path('(0010,0020)'), 'ID');
            const merged = a.merge(b);
            expect(merged.modifications.get('(0010,0010)')).toBe('Name');
            expect(merged.modifications.get('(0010,0020)')).toBe('ID');
        });

        it('other wins on conflicts', () => {
            const a = ChangeSet.empty().setTag(path('(0010,0010)'), 'OldName');
            const b = ChangeSet.empty().setTag(path('(0010,0010)'), 'NewName');
            const merged = a.merge(b);
            expect(merged.modifications.get('(0010,0010)')).toBe('NewName');
        });

        it('erasure in other removes modification from base', () => {
            const a = ChangeSet.empty().setTag(path('(0010,0010)'), 'Name');
            const b = ChangeSet.empty().eraseTag(path('(0010,0010)'));
            const merged = a.merge(b);
            expect(merged.modifications.has('(0010,0010)')).toBe(false);
            expect(merged.erasures.has('(0010,0010)')).toBe(true);
        });

        it('unions erasure sets', () => {
            const a = ChangeSet.empty().eraseTag(path('(0010,0010)'));
            const b = ChangeSet.empty().eraseTag(path('(0010,0020)'));
            const merged = a.merge(b);
            expect(merged.erasures.has('(0010,0010)')).toBe(true);
            expect(merged.erasures.has('(0010,0020)')).toBe(true);
        });

        it('preserves erasePrivate flag from either side', () => {
            const a = ChangeSet.empty().erasePrivateTags();
            const b = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            const merged = a.merge(b);
            expect(merged.erasePrivate).toBe(true);
        });
    });

    describe('toModifications()', () => {
        it('produces TagModification array', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Anonymous').setTag(path('(0010,0020)'), 'ANON001');
            const mods = cs.toModifications();
            expect(mods).toHaveLength(2);
            expect(mods).toContainEqual({ tag: '(0010,0010)', value: 'Anonymous' });
            expect(mods).toContainEqual({ tag: '(0010,0020)', value: 'ANON001' });
        });

        it('returns empty array for no modifications', () => {
            const cs = ChangeSet.empty().eraseTag(path('(0010,0010)'));
            expect(cs.toModifications()).toHaveLength(0);
        });
    });

    describe('toErasureArgs()', () => {
        it('produces string array of tag paths', () => {
            const cs = ChangeSet.empty().eraseTag(path('(0010,0010)')).eraseTag(path('(0010,0020)'));
            const args = cs.toErasureArgs();
            expect(args).toHaveLength(2);
            expect(args).toContain('(0010,0010)');
            expect(args).toContain('(0010,0020)');
        });

        it('excludes the erase-private sentinel', () => {
            const cs = ChangeSet.empty().erasePrivateTags().eraseTag(path('(0010,0010)'));
            const args = cs.toErasureArgs();
            expect(args).toHaveLength(1);
            expect(args).toContain('(0010,0010)');
            expect(args).not.toContain('__ERASE_PRIVATE__');
        });

        it('returns empty array for no erasures', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'Test');
            expect(cs.toErasureArgs()).toHaveLength(0);
        });

        it('returns empty array for only erase-private sentinel', () => {
            const cs = ChangeSet.empty().erasePrivateTags();
            expect(cs.toErasureArgs()).toHaveLength(0);
        });
    });

    describe('control character sanitization', () => {
        it('strips NULL (0x00)', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'A\x00B');
            expect(cs.modifications.get('(0010,0010)')).toBe('AB');
        });

        it('strips TAB (0x09)', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'A\tB');
            expect(cs.modifications.get('(0010,0010)')).toBe('AB');
        });

        it('strips VT (0x0B)', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'A\x0BB');
            expect(cs.modifications.get('(0010,0010)')).toBe('AB');
        });

        it('strips FF (0x0C)', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'A\x0CB');
            expect(cs.modifications.get('(0010,0010)')).toBe('AB');
        });

        it('strips DEL (0x7F)', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'A\x7FB');
            expect(cs.modifications.get('(0010,0010)')).toBe('AB');
        });

        it('strips range 0x0E-0x1F', () => {
            const cs = ChangeSet.empty().setTag(path('(0010,0010)'), 'A\x0E\x1FB');
            expect(cs.modifications.get('(0010,0010)')).toBe('AB');
        });
    });
});
