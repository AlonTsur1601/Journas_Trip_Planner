import {describe,it,expect} from 'vitest';
import {blockRange} from '../src/block-range';
describe('visible portion of a shared time block',()=>{
 it('clips first, middle and last days without changing the original times',()=>{
  const b={start:'22:00',end:'07:00',startDate:'2026-12-31',endDate:'2027-01-02'};
  expect(blockRange(b,'2026-12-31')).toEqual({start:'22:00',end:'24:00'});
  expect(blockRange(b,'2027-01-01')).toEqual({start:'00:00',end:'24:00'});
  expect(blockRange(b,'2027-01-02')).toEqual({start:'00:00',end:'07:00'});
  expect(b.start).toBe('22:00');
 });
 it('preserves existing single day blocks',()=>expect(blockRange({start:'09:00',end:'10:00'},'2026-10-10')).toEqual({start:'09:00',end:'10:00'}));
});
