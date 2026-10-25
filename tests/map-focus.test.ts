import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {focusLoadedMap,focusEasing,focusDuration,focusRoute} from '../src/map-focus';
class MapStub{
 listeners=new Map<string,Set<()=>void>>();options:any;stops=0;active=false;
 getCenter(){return{lng:120,lat:-30};}getZoom(){return 2;}
 on(name:string,callback:()=>void){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name)!.add(callback);}
 off(name:string,callback:()=>void){this.listeners.get(name)?.delete(callback);}
 flyTo(options:any){if(this.active)this.stop();this.options=options;this.active=true;}
 stop(){this.stops++;if(this.active){this.active=false;this.emit('moveend');}}
 emit(name:string){for(const callback of [...this.listeners.get(name)??[]])callback();}
}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());
it('starts synchronously without waiting for a route, tile, image, or promise',async()=>{
 const map=new MapStub(),controller=new AbortController();
 const task=focusLoadedMap(map as any,{lng:2,lat:49},controller.signal);
 expect(map.options.center).toEqual([2,49]);expect(map.options.duration).toBe(focusDuration);
 map.emit('moveend');await task;expect(vi.getTimerCount()).toBe(0);
});
it('removes callbacks and stops an interrupted flight',async()=>{
 const map=new MapStub(),controller=new AbortController();
 const task=focusLoadedMap(map as any,{lng:2,lat:49},controller.signal);
 controller.abort();await expect(task).rejects.toMatchObject({name:'AbortError'});
 expect(map.stops).toBe(2);expect([...map.listeners.values()].every(set=>set.size===0)).toBe(true);
});
it('bounds the camera task even if a renderer fails to emit moveend',async()=>{
 const map=new MapStub(),task=focusLoadedMap(map as any,{lng:2,lat:49},new AbortController().signal);
 vi.advanceTimersByTime(focusDuration+501);await task;expect(map.stops).toBe(2);expect(vi.getTimerCount()).toBe(0);
});
it('does not mistake the interrupted zoom moveend for the end of the new flight',async()=>{
 const map=new MapStub();map.active=true;let finished=false;
 const task=focusLoadedMap(map as any,{lng:2,lat:49},new AbortController().signal).then(()=>finished=true);
 await Promise.resolve();expect(finished).toBe(false);expect(map.options.center).toEqual([2,49]);
 map.emit('moveend');await task;
});
it('slows through the middle and returns smoothly to its starting speed',()=>{
 expect(focusEasing(0)).toBe(0);expect(focusEasing(1)).toBe(1);
 const speed=(t:number)=>(focusEasing(t+.00001)-focusEasing(t))/.00001;
 expect(speed(.5)).toBeLessThan(speed(.01)*.7);
 expect(speed(.01)).toBeCloseTo(speed(.99),3);
 for(let i=0;i<100;i++)expect(focusEasing((i+1)/100)).toBeGreaterThan(focusEasing(i/100));
});
it('prepares distant destinations through finite native-flight cameras',()=>{
 const route=focusRoute({center:[120,-30],zoom:2},{lng:2.37,lat:48.85},800);
 expect(route[0]).toEqual({center:[120,-30],zoom:2});
 expect(route.at(-1)).toEqual({center:[2.37,48.85],zoom:15});
 expect(route.every(frame=>[...frame.center,frame.zoom].every(Number.isFinite))).toBe(true);
 expect(Math.min(...route.map(frame=>frame.zoom))).toBeLessThan(2);
});
it('handles pure zoom and wraps across the date line along the short route',()=>{
 const route=focusRoute({center:[2,49],zoom:4},{lng:2,lat:49},800);
 expect(route.every(frame=>frame.center[0]===2&&frame.center[1]===49)).toBe(true);
 const wrapped=focusRoute({center:[179,0],zoom:4},{lng:-179,lat:0},800);
 expect(wrapped.slice(0,-1).every(frame=>frame.center[0]>178&&frame.center[0]<182)).toBe(true);
});
