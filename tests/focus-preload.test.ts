import {expect,it,vi} from 'vitest';
import {FocusPreloadQueue} from '../src/focus-preload';
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const frame=(bytes=10)=>({bytes,dispose:vi.fn()});
function renderer(){
 const jobs=new Map<string,{resolve:(value:ReturnType<typeof frame>)=>void;signal:AbortSignal}>();
 const prepare=vi.fn((point:string,signal:AbortSignal)=>new Promise<ReturnType<typeof frame>>((resolve,reject)=>{
  jobs.set(point,{resolve,signal});signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
 }));return{jobs,prepare};
}
it('starts preparing before any click and returns the completed route without rendering again',async()=>{
 const r=renderer(),queue=new FocusPreloadQueue<string,ReturnType<typeof frame>>(100);
 queue.reset([['a','a']],r.prepare);expect(r.prepare).toHaveBeenCalledTimes(1);
 const prepared=frame();r.jobs.get('a')!.resolve(prepared);await flush();expect(queue.readyCount).toBe(1);
 expect(await queue.take('a','a',new AbortController().signal)).toBe(prepared);
 expect(r.prepare).toHaveBeenCalledTimes(1);expect(prepared.dispose).not.toHaveBeenCalled();
});
it('uses one renderer at a time and prepares the next target automatically',async()=>{
 const r=renderer(),queue=new FocusPreloadQueue<string,ReturnType<typeof frame>>(100);
 queue.reset([['a','a'],['b','b']],r.prepare);expect(r.jobs.has('b')).toBe(false);
 r.jobs.get('a')!.resolve(frame());await flush();expect(r.jobs.has('b')).toBe(true);queue.clear();
});
it('prioritizes a clicked target ahead of unfinished background work',async()=>{
 const r=renderer(),queue=new FocusPreloadQueue<string,ReturnType<typeof frame>>(100);
 queue.reset([['a','a'],['b','b']],r.prepare);
 const selected=queue.take('b','b',new AbortController().signal);expect(r.jobs.get('a')!.signal.aborted).toBe(true);
 await flush();const prepared=frame();r.jobs.get('b')!.resolve(prepared);expect(await selected).toBe(prepared);
});
it('invalidates routes when the camera changes and disposes stale results',async()=>{
 let finish!:(value:ReturnType<typeof frame>)=>void;
 const queue=new FocusPreloadQueue<string,ReturnType<typeof frame>>(100);
 queue.reset([['old','old']],()=>new Promise(resolve=>finish=resolve));
 queue.reset([['new','new']],async()=>frame());const stale=frame();finish(stale);await flush();
 expect(stale.dispose).toHaveBeenCalledOnce();expect(queue.readyCount).toBe(1);queue.clear();
});
it('bounds cached memory and releases alternatives when a target is requested',async()=>{
 const r=renderer(),queue=new FocusPreloadQueue<string,ReturnType<typeof frame>>(20);
 queue.reset([['a','a'],['b','b'],['c','c']],r.prepare);
 const a=frame(),b=frame();r.jobs.get('a')!.resolve(a);await flush();r.jobs.get('b')!.resolve(b);await flush();
 expect(queue.readyCount).toBe(2);expect(r.jobs.has('c')).toBe(false);
 const selected=queue.take('c','c',new AbortController().signal);expect(a.dispose).toHaveBeenCalledOnce();expect(b.dispose).toHaveBeenCalledOnce();
 const c=frame();r.jobs.get('c')!.resolve(c);expect(await selected).toBe(c);
});
it('cancels requested work without exposing an obsolete route',async()=>{
 const r=renderer(),queue=new FocusPreloadQueue<string,ReturnType<typeof frame>>(100),controller=new AbortController();
 queue.reset([['a','a']],r.prepare);const selected=queue.take('a','a',controller.signal);controller.abort();
 await expect(selected).rejects.toMatchObject({name:'AbortError'});expect(r.jobs.get('a')!.signal.aborted).toBe(true);
});
