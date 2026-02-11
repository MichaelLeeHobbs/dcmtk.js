import { describe, it, expect } from 'vitest';
import {
    DEFAULT_TIMEOUT_MS,
    DEFAULT_START_TIMEOUT_MS,
    DEFAULT_DRAIN_TIMEOUT_MS,
    DEFAULT_BLOCK_TIMEOUT_MS,
    PDU_SIZE,
    REQUIRED_BINARIES,
    MAX_BLOCK_LINES,
} from './constants';

describe('constants', () => {
    describe('timeouts', () => {
        it('has positive default timeout', () => {
            expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
        });

        it('has start timeout less than default timeout', () => {
            expect(DEFAULT_START_TIMEOUT_MS).toBeLessThanOrEqual(DEFAULT_TIMEOUT_MS);
        });

        it('has positive drain timeout', () => {
            expect(DEFAULT_DRAIN_TIMEOUT_MS).toBeGreaterThan(0);
        });

        it('has positive block timeout', () => {
            expect(DEFAULT_BLOCK_TIMEOUT_MS).toBeGreaterThan(0);
        });
    });

    describe('PDU sizes', () => {
        it('has min <= default <= max', () => {
            expect(PDU_SIZE.MIN).toBeLessThanOrEqual(PDU_SIZE.DEFAULT);
            expect(PDU_SIZE.DEFAULT).toBeLessThanOrEqual(PDU_SIZE.MAX);
        });

        it('has positive values', () => {
            expect(PDU_SIZE.MIN).toBeGreaterThan(0);
        });
    });

    describe('required binaries', () => {
        it('includes essential DCMTK tools', () => {
            expect(REQUIRED_BINARIES).toContain('dcm2json');
            expect(REQUIRED_BINARIES).toContain('echoscu');
            expect(REQUIRED_BINARIES).toContain('dcmodify');
        });

        it('is non-empty', () => {
            expect(REQUIRED_BINARIES.length).toBeGreaterThan(0);
        });
    });

    describe('buffer limits', () => {
        it('has positive max block lines', () => {
            expect(MAX_BLOCK_LINES).toBeGreaterThan(0);
        });
    });
});
