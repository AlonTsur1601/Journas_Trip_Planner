import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {findTourTarget,observeTourTarget} from '../src/tour-target';
import {registerSurfaceMotion,mirrorSurfaceMotion,restingSurfaceRect} from '../src/surface-motion';
let frames:Map<number,FrameRequestCallback>,nextFrame:number;
const tick=()=>{const queued=[...frames.values()];frames.clear();queued.forEach(frame=>frame(0));};
beforeEach(()=>{
 frames=new Map();nextFrame=0;
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++nextFrame,callback);return nextFrame;});
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
});
afterEach(()=>vi.unstubAllGlobals());
describe('guide target tracking',()=>{
 it('follows every animation frame through its final position',()=>{
  const target={} as Element;let y=8;const positions:number[]=[];
  const stop=observeTourTarget(()=>target,()=>positions.push(y));
  tick();y=4;tick();y=0;tick();expect(positions).toEqual([8,4,0]);stop();expect(frames.size).toBe(0);
 });
 it('catches Web Animations that start after an initially stationary frame without DOM events',()=>{
  let y=0;const positions:number[]=[];const stop=observeTourTarget(()=>({} as Element),()=>positions.push(y));
  tick();tick();y=8;tick();y=3;tick();y=0;tick();expect(positions).toEqual([0,0,8,3,0]);stop();
 });
 it('keeps looking when a menu mounts later and follows layout changes without notifications',()=>{
  let target:Element|null=null;const positions:(Element|null)[]=[];
  const stop=observeTourTarget(()=>target,value=>positions.push(value));
  tick();target={} as Element;tick();const replacement={} as Element;target=replacement;tick();
  expect(positions).toEqual([null,expect.anything(),replacement]);stop();expect(frames.size).toBe(0);
 });
 it('cancels an outstanding frame when the guide closes',()=>{
  const place=vi.fn();const stop=observeTourTarget(()=>null,place);stop();tick();expect(place).not.toHaveBeenCalled();
 });
});

describe('explicit guide focus',()=>{
 it('keeps the main dialog selected when an unrelated nested picker opens',()=>{
  const main={getBoundingClientRect:()=>({width:500,height:500}),closest:()=>null} as unknown as Element;
  const picker={getBoundingClientRect:()=>({width:280,height:300}),closest:()=>null} as unknown as Element;
  const querySelectorAll=vi.fn((selector:string)=>selector==='.trip-modal'?[main]:[picker]);
  expect(findTourTarget('.trip-modal',{querySelectorAll} as any)).toBe(main);
  expect(querySelectorAll.mock.calls).toEqual([['.trip-modal']]);
  expect(findTourTarget('.symbol-menu',{querySelectorAll} as any)).toBe(picker);
 });
 it('rejects exited, inert and hidden targets while a replacement is opening',()=>{
  const exited={getBoundingClientRect:()=>({width:500,height:500}),closest:()=>({})};
  const hidden={getBoundingClientRect:()=>({width:0,height:0}),closest:()=>null};
  const active={getBoundingClientRect:()=>({width:500,height:500}),closest:()=>null};
  expect(findTourTarget('.trip-modal',{querySelectorAll:()=>[exited,hidden,active]} as any)).toBe(active);
 });
});

describe('shared compositor motion',()=>{
 it('copies the exact menu keyframes, timing, playback rate and timeline start',()=>{
  const frames=[{translate:'0 8px'},{translate:'0 0'}],timing={duration:280,easing:'cubic-bezier(.2,.7,.2,1)'};
  const source={startTime:1234,playbackRate:1,effect:{getKeyframes:()=>frames,getTiming:()=>timing}};
  const menu={parentElement:null} as Element;registerSurfaceMotion(menu,source as any);
  const copy={startTime:null,playbackRate:0,cancel:vi.fn()},animate=vi.fn(()=>copy);
  const binding=mirrorSurfaceMotion(menu,{animate} as any);binding.sync();binding.sync();
  expect(animate).toHaveBeenCalledExactlyOnceWith(frames,timing);expect(copy.startTime).toBe(1234);expect(copy.playbackRate).toBe(1);
  source.startTime=1250;binding.sync();expect(copy.startTime).toBe(1250);binding.stop();expect(copy.cancel).toHaveBeenCalledOnce();
 });
 it('does not bake an in-progress lift into the outline layout position',()=>{
  const menu={parentElement:null,getBoundingClientRect:()=>({x:100,y:208,width:400,height:500})} as unknown as Element;
  registerSurfaceMotion(menu,{} as Animation);vi.stubGlobal('getComputedStyle',()=>({translate:'0px 8px'}));
  expect(restingSurfaceRect(menu)).toEqual({x:100,y:200,width:400,height:500});
 });
 it('waits for a pending menu animation to receive its actual start time',()=>{
  const source={startTime:null as number|null,playbackRate:1,effect:{getKeyframes:()=>[],getTiming:()=>({duration:280})}};
  const menu={parentElement:null} as Element;registerSurfaceMotion(menu,source as any);
  const copy={startTime:null,playbackRate:1,cancel:vi.fn()},animate=vi.fn(()=>copy);
  const binding=mirrorSurfaceMotion(menu,{animate} as any);binding.sync();expect(animate).not.toHaveBeenCalled();
  source.startTime=100;binding.sync();expect(copy.startTime).toBe(100);binding.stop();
 });
});
