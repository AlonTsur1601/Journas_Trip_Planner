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
function bootAppearance(saved:string,dark:boolean,blocked=false){const root={dataset:{} as Record<string,string>,style:{setProperty:(key:string,value:string)=>{root.dataset[key]=value;}}};runInNewContext(boot,{localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return saved;}},document:{documentElement:root},matchMedia:()=>({matches:dark})});return root.dataset;}
it('applies saved theme and accent before the app module starts',()=>{
 expect(bootAppearance('{"theme":"dark","accent":"#22c55e"}',false)).toEqual({theme:'dark','--accent':'#22c55e'});
 expect(bootAppearance('{"theme":"light"}',true).theme).toBe('light');
 expect(bootAppearance('{"theme":"system"}',true).theme).toBe('dark');
 expect(bootAppearance('{}',true,true).theme).toBe('dark');
});
