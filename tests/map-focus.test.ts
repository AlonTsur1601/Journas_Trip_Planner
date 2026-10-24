import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {loadedFlight,focusEasing} from '../src/map-focus';
class MapStub{
 listeners=new Map<string,Set<()=>void>>();ready=true;options:any;stops=0;
 on(name:string,callback:()=>void){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name)!.add(callback);}
 off(name:string,callback:()=>void){this.listeners.get(name)?.delete(callback);}
 flyTo(options:any){this.options=options;}
 stop(){this.stops++;}
 areTilesLoaded(){return this.ready;}
 emit(name:string){for(const callback of [...this.listeners.get(name)??[]])callback();}
 frame(ready=true,ms=20){vi.advanceTimersByTime(ms);this.ready=ready;const progress=this.options.easing(0);this.emit('render');return progress;}
}
beforeEach(()=>vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']}));
afterEach(()=>vi.useRealTimers());
it('does not advance or finish the preload while tiles are unfinished',async()=>{
 const map=new MapStub(),controller=new AbortController();let complete=false;
 const task=loadedFlight(map as any,{center:[2,49],zoom:15},controller.signal,true).then(()=>complete=true);
 expect(map.frame(false)).toBe(0);expect(map.frame(false)).toBe(0);expect(complete).toBe(false);
 map.frame();const progress=map.frame();expect(progress).toBeGreaterThan(0);
 expect(map.frame(false)).toBe(progress);expect(map.frame(false)).toBe(progress);
 for(let i=0;i<25;i++)map.frame();await task;expect(complete).toBe(true);expect(map.stops).toBe(1);
 expect([...map.listeners.values()].every(set=>set.size===0)).toBe(true);
});
it('reports missing frames so the previous complete pixels can cover them',async()=>{
 const map=new MapStub(),controller=new AbortController(),frames:boolean[]=[];
 const task=loadedFlight(map as any,{zoom:15},controller.signal,false,loaded=>frames.push(loaded));
 map.frame();const before=map.frame();expect(map.frame(false,200)).toBe(before);expect(frames.at(-1)).toBe(false);
 map.frame();for(let i=0;i<62;i++)map.frame();await task;expect(frames.at(-1)).toBe(true);
});
it('prepares long routes at the denser sampling rate before exposing movement',async()=>{
 const map=new MapStub(),controller=new AbortController();let complete=false;
 const task=loadedFlight(map as any,{zoom:15},controller.signal,true,undefined,48).then(()=>complete=true);
 for(let i=0;i<25;i++)map.frame();await Promise.resolve();expect(complete).toBe(false);
 for(let i=0;i<25;i++)map.frame();await task;expect(complete).toBe(true);
});
it('cancels without leaving a running flight or readiness listeners',async()=>{
 const map=new MapStub(),controller=new AbortController();
 const task=loadedFlight(map as any,{zoom:15},controller.signal,true);
 controller.abort();await expect(task).rejects.toMatchObject({name:'AbortError'});
 expect(map.stops).toBe(1);expect([...map.listeners.values()].every(set=>set.size===0)).toBe(true);
});
it('fails instead of exposing a route whose tile request errors',async()=>{
 const map=new MapStub(),controller=new AbortController();
 const task=loadedFlight(map as any,{zoom:15},controller.signal,true);map.emit('error');
 await expect(task).rejects.toThrow('could not finish loading');
});
it('bounds a stalled visible animation instead of waiting forever',async()=>{
 const map=new MapStub(),controller=new AbortController();
 const task=loadedFlight(map as any,{zoom:15},controller.signal,false);
 const rejected=expect(task).rejects.toThrow('taking too long');vi.advanceTimersByTime(3001);await rejected;
 expect(map.stops).toBe(1);
});
it('uses almost constant progress instead of a long easing tail',()=>{
 expect(focusEasing(0)).toBe(0);expect(focusEasing(1)).toBe(1);
 const increments=Array.from({length:100},(_,i)=>focusEasing((i+1)/100)-focusEasing(i/100));
 expect(Math.min(...increments)).toBeGreaterThan(.008);expect(Math.max(...increments)).toBeLessThan(.0111);
});
