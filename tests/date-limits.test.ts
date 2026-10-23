import {it,expect} from 'vitest';
import {boundedDate} from '../src/date-limits';
it('uses the allowed boundary rather than restoring the previous date',()=>{expect(boundedDate('2028-10-23','2026-10-23','2027-10-23')).toBe('2027-10-23');expect(boundedDate('2025-10-23','2026-10-23','2027-10-23')).toBe('2026-10-23');});
it('preserves invalid calendar input for form validation and valid in-range dates',()=>{for(const date of ['2027-02-30','2027-04-15','202'])expect(boundedDate(date,'2026-10-23','2027-10-23')).toBe(date);});
