import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {findTourTarget,observeTourTarget} from '../src/tour-target';
let frames:Map<number,FrameRequestCallback>,nextFrame:number,animations:any[],mutated:()=>void,resized:()=>void;
const resizeDisconnect=vi.fn(),mutationDisconnect=vi.fn();
const element=()=>({contains(other:unknown){return other===this;}} as Element);
const tick=()=>{const queued=[...frames.values()];frames.clear();queued.forEach(frame=>frame(0));};
beforeEach(()=>{
 frames=new Map();nextFrame=0;animations=[];resizeDisconnect.mockClear();mutationDisconnect.mockClear();
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++nextFrame,callback);return nextFrame;});vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resized=callback;}observe=vi.fn();disconnect=resizeDisconnect;});
 vi.stubGlobal('MutationObserver',class{constructor(callback:()=>void){mutated=callback;}observe=vi.fn();disconnect=mutationDisconnect;});
 vi.stubGlobal('document',{body:{},getAnimations:()=>animations,addEventListener:vi.fn(),removeEventListener:vi.fn()});
 vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});
});
afterEach(()=>vi.unstubAllGlobals());
describe('guide target tracking',()=>{
 it('tracks a transform through its final frame without any DOM/style mutation',()=>{
  const target=element();let y=8;const positions:number[]=[];const motion={playState:'running',pending:false,effect:{target,getComputedTiming:()=>({endTime:280})}};animations=[motion];
  const stop=observeTourTarget(()=>target,()=>positions.push(y));expect(positions).toEqual([8]);
  y=4;tick();y=0;motion.playState='finished';tick();expect(positions).toEqual([8,4,0]);expect(frames.size).toBe(0);stop();
 });
 it('follows motion on a target ancestor',()=>{
  const target=element(),ancestor={contains:(value:Element)=>value===target};animations=[{playState:'running',effect:{target:ancestor,getComputedTiming:()=>({endTime:280})}}];
  const stop=observeTourTarget(()=>target,vi.fn());expect(frames.size).toBe(1);stop();expect(frames.size).toBe(0);
 });
 it('ignores unrelated and infinite glow animations, but reacts to resize/mutations',()=>{
  const target=element();animations=[{playState:'running',effect:{target,getComputedTiming:()=>({endTime:Infinity})}},{playState:'running',effect:{target:element(),getComputedTiming:()=>({endTime:280})}}];
  const place=vi.fn();const stop=observeTourTarget(()=>target,place);expect(frames.size).toBe(0);resized();mutated();expect(frames.size).toBe(1);tick();expect(place).toHaveBeenCalledTimes(2);stop();expect(mutationDisconnect).toHaveBeenCalled();
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
