import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {readAppearance} from '../src/appearance-cache';
it('only restores valid appearance preferences',()=>{
 expect(readAppearance({getItem:()=>'{"theme":"dark","accent":"#22c55e","displayName":"private"}'})).toEqual({theme:'dark',accent:'#22c55e'});
 expect(readAppearance({getItem:()=>'{"theme":"invalid","accent":"url(evil)"}'})).toEqual({});
 expect(readAppearance({getItem:()=>{throw Error('blocked');}})).toEqual({});
 expect(readAppearance({getItem:()=>'{bad'})).toEqual({});
});
const boot=readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)![1];
function runBoot(saved:string,dark:boolean,blocked=false){
 const root={dataset:{} as Record<string,string>,style:{setProperty:(key:string,value:string)=>{root.dataset[key]=value;},getPropertyValue:(key:string)=>root.dataset[key]??''}};
 const icon={href:'/favicon.svg',getAttribute:()=>icon.href,setAttribute:(_key:string,value:string)=>{icon.href=value;}};
 let refresh=()=>{};
 runInNewContext(boot,{localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return saved;}},document:{documentElement:root,querySelector:()=>icon},matchMedia:()=>({matches:dark}),MutationObserver:class{constructor(callback:()=>void){refresh=callback;}observe(){}}});
 return {root,icon,refresh};
}
function bootAppearance(saved:string,dark:boolean,blocked=false){return runBoot(saved,dark,blocked).root.dataset;}
it('applies saved theme and accent before the app module starts',()=>{
 expect(bootAppearance('{"theme":"dark","accent":"#22c55e"}',false)).toEqual({theme:'dark','--accent':'#22c55e','--accent-ink':'#ffffff'});
 expect(bootAppearance('{"theme":"light"}',true).theme).toBe('light');
 expect(bootAppearance('{"theme":"system"}',true).theme).toBe('dark');
 expect(bootAppearance('{}',true,true).theme).toBe('dark');
});

it('only inverts the black accent in dark mode, including early startup',()=>{
 for(const accent of ['#292637','#000000','#000']){
  const saved=JSON.stringify({theme:'dark',accent});const result=bootAppearance(saved,false);expect(result['--accent']).toBe('#ffffff');expect(result['--accent-ink']).toBe('#17151f');
  expect(bootAppearance(JSON.stringify({theme:'light',accent}),true)['--accent']).toBe(accent);
 }
 for(const accent of ['#8b5cf6','#64748b','#222222'])expect(bootAppearance(JSON.stringify({theme:'dark',accent}),false)['--accent']).toBe(accent);
 expect(bootAppearance('{"theme":"system","accent":"#292637"}',true)['--accent']).toBe('#ffffff');
});

it('colors the original favicon on startup and updates it when the active accent changes',()=>{
 const {root,icon,refresh}=runBoot('{"theme":"dark","accent":"#22c55e"}',false);
 const original=readFileSync('public/favicon.svg','utf8').trim();
 const svg=()=>decodeURIComponent(icon.href.slice('data:image/svg+xml,'.length));
 expect(svg()).toBe(original.replace('#7c5ce7','#22c55e'));
 root.style.setProperty('--accent','#ec4899');refresh();expect(svg()).toBe(original.replace('#7c5ce7','#ec4899'));
 expect(decodeURIComponent(runBoot('{"theme":"dark","accent":"#292637"}',false).icon.href)).toContain('stroke="#ffffff"');
 expect(decodeURIComponent(runBoot('{"theme":"light","accent":"#292637"}',true).icon.href)).toContain('stroke="#292637"');
 expect(decodeURIComponent(runBoot('{}',false,true).icon.href)).toContain('stroke="#7c5ce7"');
});
