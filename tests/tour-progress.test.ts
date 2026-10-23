import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/firebase',()=>({api:vi.fn()}));
import {tourSteps} from '../src/GuidedTour';
import {tourShieldPath,tourNeedsNext,tourInstructionComplete,tourSubstepDelay} from '../src/tour-progress';

describe('guide progression',()=>{
 const part=(stage:string,title:string)=>tourSteps.find(s=>s.title===stage)!.instructions!.find(p=>p.title===title)!;
 it.each([
  ['Make the trip yours','Trip name'],['Make the trip yours','Trip dates'],['Make the trip yours','Choose lodging'],
  ['Find and customize a place','Position and name'],['Find and customize a place','Note and appearance'],
  ['Link your schedule to a place','Choose dates'],['Link your schedule to a place','Set the time'],
  ['Connect a task to the plan','Write the task'],['Choose your preferences','Accent color'],['Choose your preferences','Trip retention'],
 ])('%s / %s does not advance from a blur or click alone', (stage,title)=>{
  expect(part(stage,title).done).toBeUndefined();expect(part(stage,title).completeOn).toBeUndefined();
 });
 it.each([
  ['Link your schedule to a place','Link a place'],['Make the trip yours','Choose a trip symbol'],['Make the trip yours','Choose a color'],
  ['Choose your preferences','Appearance'],['Choose your preferences','Map starting view'],['Choose your preferences','Clock and time zone'],
 ])('%s / %s keeps explicit choice advancement', (stage,title)=>expect(part(stage,title).completeOn).toBeTruthy());
 it('never includes field blur advancement anywhere in the catalog',()=>{
  for(const stage of tourSteps)for(const instruction of stage.instructions??[])expect(instruction).not.toHaveProperty('blurOn');
 });
});

describe('stable focus interaction openings',()=>{
 it('leaves both overlapping menu areas interactive and blocks the surrounding page',()=>{
  const path=tourShieldPath(100,100,[{x:20,y:20,width:50,height:50},{x:40,y:40,width:50,height:50}]);
  const blocked=[...path.matchAll(/M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)H[\d.]+Z/g)].map(m=>m.slice(1).map(Number));
  const hit=(x:number,y:number)=>blocked.some(([left,top,right,bottom])=>x>left&&x<right&&y>top&&y<bottom);
  expect(hit(10,10)).toBe(true);expect(hit(30,30)).toBe(false);expect(hit(50,50)).toBe(false);expect(hit(80,80)).toBe(false);expect(hit(95,95)).toBe(true);
 });
});

describe('required guide actions',()=>{
 const stage=(title:string)=>tourSteps.find(s=>s.title===title)!;
 it('never offers Next for a substep or stage completed by its site action',()=>{
  for(const step of tourSteps){if(!step.instructions&&step.done)expect(tourNeedsNext(step,undefined,0)).toBe(false);for(const [index,part]of (step.instructions??[]).entries()){if(part.done||part.completeOn)expect(tourNeedsNext(step,part,index)).toBe(false);if(step.done&&index===step.instructions!.length-1&&!part.closeOnNext)expect(tourNeedsNext(step,part,index)).toBe(false);}}
 });
 it('uses opening the calendar and saving planning as the advance actions',()=>{expect(stage('Navigate the trip dates').instructions![0].done).toBeTruthy();expect(stage('Undo, redo and save').instructions![1].completeOn).toContain('Save planning');});
 it('accepts lodging selected early without requiring a custom name or appearance',()=>{const steps=stage('Make the trip yours').instructions!,index=steps.findIndex(p=>p.title==='Choose lodging'),part=steps[index];expect(tourInstructionComplete(part,index,0,[],{lodgingChosen:true}as any)).toBe(true);expect(tourInstructionComplete(part,index,0,[],{lodgingChosen:false}as any)).toBe(false);});
 it('lets valid schedule defaults stay unchanged',()=>{const steps=stage('Link your schedule to a place').instructions!;for(const title of ['Choose dates','Set the time']){const index=steps.findIndex(p=>p.title===title);expect(tourInstructionComplete(steps[index],index,index,[],{date:'2026-10-23',draft:{start:'09:00',end:'10:00'}}as any)).toBe(true);}});
 it('does not complete untouched trip dates just because they are valid',()=>{const part={ready:()=>true,action:'.date-field'};expect(tourInstructionComplete(part,1,1,[],{})).toBe(false);expect(tourInstructionComplete(part,1,1,[1],{})).toBe(true);});
});

describe('automatic substeps',()=>{
 it('combines opening the symbol picker and choosing its value',()=>{const parts=tourSteps.find(s=>s.title==='Make the trip yours')!.instructions!;const symbols=parts.filter(p=>/symbol/i.test(p.title));expect(symbols).toHaveLength(1);expect(symbols[0].completeOn).toBeTruthy();expect(symbols[0].done).toBeUndefined();});
 it('never shows Next between substeps anywhere in the catalog',()=>{for(const step of tourSteps)for(let index=0;index<(step.instructions?.length??0)-1;index++)expect(tourNeedsNext(step,step.instructions![index],index)).toBe(false);});
 it('waits for required valid input and an explicit trip date choice',()=>{const p={text:'Dates',ready:(c:{valid:boolean})=>c.valid,action:'.date-field'};expect(tourSubstepDelay(p,0,2,[],{valid:true})).toBeNull();expect(tourSubstepDelay(p,0,2,[0],{valid:false})).toBeNull();expect(tourSubstepDelay(p,0,2,[0],{valid:true})).toBe(0);});
 it('provides reading time for optional explanations without auto-exiting a main stage',()=>{const p={text:'Read the optional appearance settings.'};expect(tourSubstepDelay(p,0,2,[],{})).toBeGreaterThanOrEqual(4000);expect(tourSubstepDelay(p,1,2,[],{})).toBeNull();});
});
