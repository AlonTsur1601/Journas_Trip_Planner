import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/firebase',()=>({api:vi.fn()}));
import {tourSteps} from '../src/GuidedTour';
import {tourShieldPath} from '../src/tour-progress';

describe('guide progression',()=>{
 const part=(stage:string,title:string)=>tourSteps.find(s=>s.title===stage)!.instructions!.find(p=>p.title===title)!;
 it.each([
  ['Make the trip yours','Trip name'],['Make the trip yours','Trip dates'],['Make the trip yours','Choose lodging'],
  ['Find and customize a place','Position and name'],['Find and customize a place','Note and appearance'],
  ['Link your schedule to a place','Choose dates'],['Link your schedule to a place','Set the time'],
  ['Connect a task to the plan','Write the task'],['Choose your preferences','Accent color'],['Choose your preferences','Trip retention'],
 ])('%s / %s waits for explicit Next step', (stage,title)=>{
  expect(part(stage,title).done).toBeUndefined();expect(part(stage,title).completeOn).toBeUndefined();
 });
 it.each([
  ['Link your schedule to a place','Link a place'],['Make the trip yours','Pick a symbol'],['Make the trip yours','Choose a color'],
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
