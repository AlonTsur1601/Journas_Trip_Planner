import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {loadedFlight,focusEasing,focusDuration,focusPreloadSteps,playFocusFrames} from '../src/map-focus';
class MapStub{
 listeners=new Map<string,Set<()=>void>>();ready=true;options:any;stops=0;elapsed=0;
 on(name:string,callback:()=>void){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name)!.add(callback);}
 off(name:string,callback:()=>void){this.listeners.get(name)?.delete(callback);}
 flyTo(options:any){this.options=options;this.elapsed=0;}
 stop(){this.stops++;}
 areTilesLoaded(){return this.ready;}
 emit(name:string){for(const callback of [...this.listeners.get(name)??[]])callback();}
 frame(ready=true,ms=20){vi.advanceTimersByTime(ms);this.elapsed+=ms;this.ready=ready;const progress=this.options.easing(Math.min(1,this.elapsed/this.options.duration));this.emit('render');if(this.elapsed>=this.options.duration)this.emit('moveend');return progress;}
}
beforeEach(()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});
 vi.stubGlobal('requestAnimationFrame',(callback:(time:number)=>void)=>setTimeout(()=>callback(performance.now()),16));
 vi.stubGlobal('cancelAnimationFrame',clearTimeout);
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('does not advance or finish the preload while tiles are unfinished',async()=>{
 const map=new MapStub(),controller=new AbortController();let complete=false;
 const task=loadedFlight(map as any,{center:[2,49],zoom:15},controller.signal,true).then(()=>complete=true);
 expect(map.frame(false)).toBe(0);expect(map.frame(false)).toBe(0);expect(complete).toBe(false);
 map.frame();const progress=map.frame();expect(progress).toBeGreaterThan(0);
 expect(map.frame(false)).toBe(progress);expect(map.frame(false)).toBe(progress);
 for(let i=0;i<focusPreloadSteps.near+1;i++)map.frame();await task;expect(complete).toBe(true);expect(map.stops).toBe(1);
 expect([...map.listeners.values()].every(set=>set.size===0)).toBe(true);
});
it('keeps visible progress on the native clock even if a tile-readiness flag changes',async()=>{
 const map=new MapStub(),controller=new AbortController();
 const task=loadedFlight(map as any,{zoom:15},controller.signal,false);
 expect(map.options.duration).toBe(focusDuration);
 const before=map.frame();expect(map.frame(false,200)).toBeGreaterThan(before);
 for(let i=0;i<61;i++)map.frame(false);await task;
 expect(map.stops).toBe(0);expect([...map.listeners.values()].every(set=>set.size===0)).toBe(true);
});
it('prepares every playback sample before exposing the route',async()=>{
 const map=new MapStub(),controller=new AbortController();let complete=false;
 const task=loadedFlight(map as any,{zoom:15},controller.signal,true,focusPreloadSteps.far).then(()=>complete=true);
 for(let i=0;i<focusPreloadSteps.near/2;i++)map.frame();await Promise.resolve();expect(complete).toBe(false);
 for(let i=0;i<focusPreloadSteps.far;i++)map.frame();await task;expect(complete).toBe(true);
 expect(focusPreloadSteps.near).toBe(focusDuration/1000*60);
});it('cancels without leaving a running flight or readiness listeners',async()=>{
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
 const rejected=expect(task).rejects.toThrow('taking too long');vi.advanceTimersByTime(4001);await rejected;
 expect(map.stops).toBe(1);
});
it('uses almost constant progress instead of a long easing tail',()=>{
 expect(focusEasing(0)).toBe(0);expect(focusEasing(1)).toBe(1);
 const increments=Array.from({length:100},(_,i)=>focusEasing((i+1)/100)-focusEasing(i/100));
 expect(Math.min(...increments)).toBeGreaterThan(.008);expect(Math.max(...increments)).toBeLessThan(.0111);
});
it('waits for the image capture before advancing the hidden camera',async()=>{
 const map=new MapStub(),controller=new AbortController();let finishCapture!:()=>void;
 const capture=vi.fn(()=>new Promise<void>(resolve=>finishCapture=resolve));
 const task=loadedFlight(map as any,{zoom:15},controller.signal,true,2,capture);
 expect(map.frame()).toBe(0);expect(capture).toHaveBeenCalledTimes(1);
 expect(map.frame()).toBe(0);expect(capture).toHaveBeenCalledTimes(1);
 finishCapture();await Promise.resolve();expect(map.frame()).toBeGreaterThan(0);
 controller.abort();finishCapture();await expect(task).rejects.toMatchObject({name:'AbortError'});
});
it('plays every prepared frame by time without network or renderer gates',async()=>{
 const frames:number[]=[],controller=new AbortController();
 const task=playFocusFrames(73,index=>frames.push(index),controller.signal);
 vi.advanceTimersByTime(1250);await task;
 expect(frames[0]).toBe(0);expect(frames.at(-1)).toBe(72);
 expect(new Set(frames).size).toBe(73);expect(vi.getTimerCount()).toBe(0);
});
it('cancels playback without leaving an animation callback',async()=>{
 const draw=vi.fn(),controller=new AbortController(),task=playFocusFrames(73,draw,controller.signal);
 vi.advanceTimersByTime(100);controller.abort();const calls=draw.mock.calls.length;
 await expect(task).rejects.toMatchObject({name:'AbortError'});vi.advanceTimersByTime(2000);
 expect(draw).toHaveBeenCalledTimes(calls);expect(vi.getTimerCount()).toBe(0);
});