import { describe, it, expect } from 'vitest';
import { resolveWallTime } from '../server/time.js';
describe('Dated IANA wall-clock validation', () => {
    it('resolves normal offset, fractional offset and end-of-day', () => {
        expect(resolveWallTime('2026-10-01', '09:00', 'Europe/Paris')).toBe(Date.parse('2026-10-01T07:00:00Z'));
        expect(resolveWallTime('2026-10-01', '09:00', 'Asia/Kathmandu')).toBe(Date.parse('2026-10-01T03:15:00Z'));
        expect(resolveWallTime('2026-10-01', '24:00', 'UTC')).toBe(Date.parse('2026-10-02T00:00:00Z'));
    });
    it('rejects nonexistent spring-forward wall time', () => { expect(() => resolveWallTime('2026-03-29', '02:30', 'Europe/Paris')).toThrow(expect.objectContaining({ code: 'NONEXISTENT_TIME' })); });
    it('requires explicit selection when a fall-back hour occurs twice', () => {
        expect(() => resolveWallTime('2026-10-25', '02:30', 'Europe/Paris')).toThrow(expect.objectContaining({ code: 'AMBIGUOUS_TIME' }));
        expect(resolveWallTime('2026-10-25', '02:30', 'Europe/Paris', 'earlier')).toBe(Date.parse('2026-10-25T00:30:00Z'));
        expect(resolveWallTime('2026-10-25', '02:30', 'Europe/Paris', 'later')).toBe(Date.parse('2026-10-25T01:30:00Z'));
    });
});
