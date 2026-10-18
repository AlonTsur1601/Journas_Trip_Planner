import {describe,it,expect,vi} from 'vitest';
import {ConcurrentReads,isReadAction} from '../src/request-cache';
describe('concurrent API reads',()=>{
 it('shares one network read, but returns separate objects',async()=>{const reads=new ConcurrentReads();let resolve!:(value:{value:number[]})=>void;const load=vi.fn(()=>new Promise<{value:number[]}>(r=>{resolve=r;}));const a=reads.run('day',load),b=reads.run('day',load);resolve({value:[1]});const [one,two]=await Promise.all([a,b]);one.value.push(2);expect(two.value).toEqual([1]);expect(load).toHaveBeenCalledTimes(1);});
 it('clears finished reads and retries errors',async()=>{const reads=new ConcurrentReads();const load=vi.fn(async()=>1);await reads.run('day',load);await reads.run('day',load);expect(load).toHaveBeenCalledTimes(2);await expect(reads.run('day',async()=>{throw Error('offline');})).rejects.toThrow('offline');expect(await reads.run('day',load)).toBe(1);});
 it('never treats writes as reads',()=>{for(const action of ['item.patch','trip.create','layout.save','tour.seen','history.undo','settings.save'])expect(isReadAction(action)).toBe(false);expect(isReadAction('planner.restore')).toBe(true);expect(isReadAction('auth.session')).toBe(true);});
});
