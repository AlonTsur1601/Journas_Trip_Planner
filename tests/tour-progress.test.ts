import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('../src/firebase',()=>({api:vi.fn()}));
import {tourSteps} from '../src/GuidedTour';
import {tourShieldPath,tourNeedsNext,tourInstructionComplete,tourSubstepDelay,tourStageReviewed} from '../src/tour-progress';

beforeEach(()=>vi.stubGlobal('document',{activeElement:null,querySelector:()=>null}));
afterEach(()=>vi.unstubAllGlobals());

describe('guide progression',()=>{
 const part=(stage:string,title:string)=>tourSteps.find(s=>s.title===stage)!.instructions!.find(p=>p.title===title)!;
 it.each([
  ['Make the trip yours','Trip name'],['Make the trip yours','Trip dates'],['Make the trip yours','Choose lodging'],
  ['Find and customize a place','Position and name'],['Find and customize a place','Note and appearance'],
  ['Link your schedule to a place','Activity name'],['Link your schedule to a place','Set the time'],
  ['Connect a task to the plan','Write the task'],
 ])('%s / %s does not advance from a blur or click alone', (stage,title)=>{
  expect(part(stage,title).done).toBeUndefined();expect(part(stage,title).completeOn).toBeUndefined();
 });
 it.each([
['Make the trip yours','Choose a trip symbol'],['Make the trip yours','Choose a color'],
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
  for(const step of tourSteps){if(!step.informational&&!step.instructions&&step.done)expect(tourNeedsNext(step,undefined,0)).toBe(false);for(const [index,part]of (step.instructions??[]).entries()){if(!step.informational&&!part.informational&&(part.done||part.completeOn))expect(tourNeedsNext(step,part,index)).toBe(false);if(!step.informational&&step.done&&index===step.instructions!.length-1&&!part.closeOnNext)expect(tourNeedsNext(step,part,index)).toBe(false);}}
 });
 it('makes introductory controls optional and immediately offers Next',()=>{for(const title of ['Choose a trip','Navigate the trip dates','Arrange your workspace','Undo, redo and save','Share and collaborate','Find your plans again']){const step=stage(title);expect(step.informational).toBe(true);expect(step.instructions).toBeUndefined();expect(tourNeedsNext(step,undefined,0)).toBe(true);}});
 it('accepts lodging selected early without requiring a custom name or appearance',()=>{const steps=stage('Make the trip yours').instructions!,index=steps.findIndex(p=>p.title==='Choose lodging'),part=steps[index];expect(tourInstructionComplete(part,index,0,[index],{lodgingChosen:true}as any)).toBe(true);expect(tourInstructionComplete(part,index,0,[],{lodgingChosen:false}as any)).toBe(false);});
 it('lets valid schedule defaults stay unchanged',()=>{const steps=stage('Link your schedule to a place').instructions!;for(const title of ['Set the time']){const index=steps.findIndex(p=>p.title===title);expect(tourInstructionComplete(steps[index],index,index,[index],{date:'2026-10-23',draft:{start:'09:00',end:'10:00'}}as any)).toBe(true);}});
 it('does not complete untouched trip dates just because they are valid',()=>{const part={ready:()=>true,action:'.date-field'};expect(tourInstructionComplete(part,1,1,[],{})).toBe(false);expect(tourInstructionComplete(part,1,1,[1],{})).toBe(true);});
});
it('lets every introductory screen and every preference advance without an interaction',()=>{
 for(const title of ['Choose a trip','Browse your places','Browse your connections','Navigate the trip dates','Arrange your workspace','Undo, redo and save','View the trip details','Share and collaborate','Return home','Find your plans again','Personalize Journas','Choose your preferences']){
  const step=tourSteps.find(s=>s.title===title)!;
  expect(step.informational,title).toBe(true);
  for(const [index,item] of (step.instructions??[undefined]).entries())expect(tourNeedsNext(step,item,index),title).toBe(true);
 }
 expect(tourStageReviewed([{informational:true,action:'.optional'},{action:'.required'},{completeOn:'.save'}],[1],{})).toBe(true);
});

describe('automatic substeps',()=>{
 it('combines opening the symbol picker and choosing its value',()=>{const parts=tourSteps.find(s=>s.title==='Make the trip yours')!.instructions!;const symbols=parts.filter(p=>/symbol/i.test(p.title));expect(symbols).toHaveLength(1);expect(symbols[0].completeOn).toBeTruthy();expect(symbols[0].done).toBeUndefined();});
 it('offers Next for every explanation while keeping required exercises action driven',()=>{for(const step of tourSteps)for(let index=0;index<(step.instructions?.length??0)-1;index++)expect(tourNeedsNext(step,step.instructions![index],index)).toBe(Boolean(step.informational||step.instructions![index].informational));});
 it('waits for required valid input and an explicit trip date choice',()=>{const p={text:'Dates',ready:(c:{valid:boolean})=>c.valid,action:'.date-field'};expect(tourSubstepDelay(p,0,2,[],{valid:true})).toBeNull();expect(tourSubstepDelay(p,0,2,[0],{valid:false})).toBeNull();expect(tourSubstepDelay(p,0,2,[0],{valid:true})).toBe(0);});
 it('never replaces a user action with elapsed reading time',()=>{const p={text:'Read the optional appearance settings.'};expect(tourSubstepDelay(p,0,2,[],{})).toBeNull();expect(tourSubstepDelay(p,1,2,[],{})).toBeNull();});
});


describe('finishing the entire field group',()=>{
 it.each([
  ['Make the trip yours','Trip name',{},'.trip-modal [name=name]'],
  ['Make the trip yours','Trip dates',{},'.trip-modal .date-field'],
  ['Find and customize a place','Position and name',{draft:{title:'Museum'}},'.item-modal fieldset > .field:first-child input, .item-modal .location-picker .place-search input'],
  ['Connect a task to the plan','Write the task',{draft:{title:'Buy tickets'}},'.task-modal fieldset > .field:first-child input'],
  ['Link your schedule to a place','Activity name',{draft:{title:'Museum'}},'.item-modal fieldset > .field:first-child input'],
  ['Link your schedule to a place','Set the time',{date:'2026-10-23',draft:{start:'09:00',end:'10:00'}},'.item-modal .time-field'],
 ])('keeps %s / %s active throughout editing', (stage,title,context,selector)=>{
  const instruction=tourSteps.find(s=>s.title===stage)!.instructions!.find(p=>p.title===title)!;
  const doc={activeElement:{closest:(s:string)=>s===selector?{}:null},querySelector:(s:string)=>s==='.trip-modal [name=name]'?{value:'Paris weekend'}:s==='.trip-modal form'?{querySelector:()=>({value:'2026-10-23'})}:null};
  vi.stubGlobal('document',doc);expect(instruction.ready!(context as any)).toBe(false);
  doc.activeElement.closest=()=>null;expect(instruction.ready!(context as any)).toBe(true);
 });
});

it('waits for the date picker to close without undoing completed name fields',()=>{
 const steps=tourSteps.find(s=>s.title==='Make the trip yours')!.instructions!;let calendar=true;
 vi.stubGlobal('document',{activeElement:null,querySelector:(selector:string)=>selector==='.trip-modal [name=name]'?{value:'Paris'}:selector==='.trip-modal form'?{querySelector:()=>({value:'2026-10-23'})}:selector.startsWith('.field-calendar')&&calendar?{}:null});
 expect(steps[0].ready!({} as any)).toBe(true);expect(steps[1].ready!({} as any)).toBe(false);
 calendar=false;expect(steps[1].ready!({} as any)).toBe(true);
});


describe('manual completion throughout the entire guide',()=>{
 it('does not mark any current or future substep before an actual action, even with valid defaults',()=>{
  for(const step of tourSteps)for(const [index,instruction]of (step.instructions??[]).entries()){
   const valid={...instruction,ready:()=>true};
   expect(tourInstructionComplete(valid,index,index,[],{}),`${step.title}: ${instruction.title}`).toBe(false);
   expect(tourInstructionComplete(valid,index,0,[],{}),`${step.title}: ${instruction.title}`).toBe(false);
   expect(tourSubstepDelay(valid,index,step.instructions!.length,[],{})).toBeNull();
  }
 });
 it('gives every substep a manual site action or an explicit final close/save action',()=>{
  for(const step of tourSteps)for(const [index,instruction]of (step.instructions??[]).entries()){
   const final=index===step.instructions!.length-1;
   expect(Boolean(instruction.action||instruction.completeOn||instruction.closeOnNext||final&&step.done),`${step.title}: ${instruction.title}`).toBe(true);
   expect(instruction.done).toBeUndefined();
  }
 });
 it('accepts unchanged reviewed values and requires only the actual lodging selection',()=>{
  const parts=tourSteps.find(s=>s.title==='Make the trip yours')!.instructions!;
  const index=parts.findIndex(p=>p.title==='Choose lodging');
  expect(tourInstructionComplete(parts[index],index,index,[],{lodgingChosen:true} as any)).toBe(false);
  expect(tourInstructionComplete(parts[index],index,index,[index],{lodgingChosen:true} as any)).toBe(true);
 });
});


describe('review-only values and logical progression',()=>{
 it('allows a main stage to finish after every preceding substep has a manual action',()=>{
  const instructions=[{action:'.title'},{action:'.time'},{action:'.link'},{completeOn:'.save'}];
  expect(tourStageReviewed(instructions,[],{})).toBe(false);
  expect(tourStageReviewed(instructions,[0,1],{})).toBe(false);
  expect(tourStageReviewed(instructions,[0,1,2],{})).toBe(true);
 });
 it('does not demand a link when the user deliberately keeps the independent activity',()=>{
  const part=tourSteps.find(s=>s.title==='Link your schedule to a place')!.instructions!.find(s=>s.title==='Link a place or connection')!;
  expect(part.ready!({draft:{pinId:null,connectionId:null}} as any)).toBe(true);
  expect(part.action).toContain('Linked place or connection');
 });
 it('teaches block fields in menu order and creates connections before showing link choices',()=>{
  const stage=tourSteps.find(s=>s.title==='Link your schedule to a place')!;
  expect(stage.instructions!.map(s=>s.title)).toEqual(['Activity name','Set the time','Link a place or connection','Details and appearance','Create the time block']);
  expect(tourSteps.findIndex(s=>s.title==='Connect your places')).toBeLessThan(tourSteps.indexOf(stage));
  expect(JSON.stringify(tourSteps)).not.toMatch(/overnight|multi-day|across days|start and end dates and times/i);
 });
 it('only skips the optional custom-map step after the preceding user choice',()=>{
  const items=[{completeOn:'.mode'},{completeOn:'.custom',skipWhen:(c:{custom:boolean})=>!c.custom},{completeOn:'.save'}];
  expect(tourStageReviewed(items,[0],{custom:false})).toBe(true);
  expect(tourStageReviewed(items,[0],{custom:true})).toBe(false);
 });
});


it('highlights the whole task, focuses opened navigation lists, and omits map exploration',()=>{
 expect(tourSteps.some(step=>step.title==='Explore the map')).toBe(false);
 expect(tourSteps.find(step=>step.title==='Check it off')!.target).toContain('.task-row');
 expect(tourSteps.find(step=>step.title==='Undo, redo and save')!.target).toBe('.planning-history-actions');
 const navigation=tourSteps.find(step=>step.title==='Navigate the trip dates')!;
 vi.stubGlobal('document',{querySelector:()=>({})});expect((navigation.target as Function)({})).toBe('.calendar-popover');
 const selector=tourSteps.find(step=>step.title==='Choose a trip')!;
 expect((selector.target as Function)({})).toContain('Choose trip');
});
