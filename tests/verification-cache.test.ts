import {describe,it,expect,vi} from 'vitest';
import {VerificationCache} from '../src/verification-cache';
describe('page-lifetime email confirmation',()=>{
 it('deduplicates in-flight checks and reuses success across consumers',async()=>{
  const cache=new VerificationCache(),load=vi.fn(async()=>true);
  await Promise.all([cache.check('account:email',load),cache.check('account:email',load)]);
  expect(await cache.check('account:email',load)).toBe(true);expect(load).toHaveBeenCalledTimes(1);
 });
 it('isolates accounts and email changes',async()=>{
  const cache=new VerificationCache();cache.confirm('one:old');
  expect(cache.has('two:old')).toBe(false);expect(cache.has('one:new')).toBe(false);
  expect(await cache.check('one:new',async()=>false)).toBe(false);
 });
 it('retries negative results and failures, and forgets confirmation in a new page',async()=>{
  const cache=new VerificationCache();await cache.check('one',async()=>false);
  await expect(cache.check('one',async()=>{throw Error('offline');})).rejects.toThrow('offline');
  expect(await cache.check('one',async()=>true)).toBe(true);expect(new VerificationCache().has('one')).toBe(false);
 });
 it('does not let an obsolete request overwrite a later confirmation',async()=>{
  const cache=new VerificationCache();let finish!:(value:boolean)=>void;
  const pending=cache.check('one',()=>new Promise<boolean>(resolve=>{finish=resolve;}));
  cache.confirm('one');finish(false);await pending;
  expect(cache.has('one')).toBe(true);expect(await cache.check('one',async()=>false)).toBe(true);
 });
});
