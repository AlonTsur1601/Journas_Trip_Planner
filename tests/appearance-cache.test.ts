import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {readAppearance} from '../src/appearance-cache';
const boot=readFileSync('index.html','utf8').replace(/\r\n/g,'\n').match(/<script>([\s\S]*?)<\/script>/)![1];
it('restores appearance only for the authenticated account',()=>{
 const storage={getItem:()=>JSON.stringify({userId:'alice',theme:'dark',accent:'#22c55e'})};
 expect(readAppearance('alice',storage)).toEqual({theme:'dark',accent:'#22c55e'});
 expect(readAppearance('bob',storage)).toEqual({});
 expect(readAppearance('',storage)).toEqual({});
 expect(readAppearance('alice',{getItem:()=>'{"theme":"dark","accent":"#22c55e"}'})).toEqual({});
 expect(readAppearance('alice',{getItem:()=>'{bad'})).toEqual({});
 expect(readAppearance('alice',{getItem:()=>'{"userId":"alice","accent":"url(evil)","theme":"invalid"}'})).toEqual({});
});
it('runs the bootstrap directly in HTML with an exact production CSP hash',()=>{
 const html=readFileSync('index.html','utf8');
 expect(html).not.toContain('src="/appearance.js"');
 expect(html).not.toContain('href="/favicon.svg"');
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 const csp=config.headers.flatMap((x:any)=>x.headers).find((x:any)=>x.key==='Content-Security-Policy').value;
 expect(csp).toContain("script-src 'self'");
 expect(csp).toContain("'sha256-"+createHash('sha256').update(boot).digest('base64')+"'");
 expect(csp).not.toContain("script-src 'unsafe-inline'");
});
it('starts neutral before authentication and follows the active account accent',()=>{
 const root={dataset:{} as Record<string,string>,style:{getPropertyValue:()=>root.dataset.accent??''}};
 const icon={href:'',getAttribute:()=>icon.href,setAttribute:(_key:string,value:string)=>{icon.href=value;}};
 let refresh=()=>{};
 runInNewContext(boot,{document:{documentElement:root,querySelector:()=>icon},matchMedia:()=>({matches:true}),MutationObserver:class{constructor(callback:()=>void){refresh=callback;}observe(){}}});
 const svg=()=>decodeURIComponent(icon.href);
 expect(root.dataset.theme).toBe('dark');expect(svg()).toContain('stroke="#7c5ce7"');
 root.dataset.accent='#22c55e';refresh();expect(svg()).toContain('stroke="#22c55e"');
 root.dataset.accent='#ffffff';refresh();expect(svg()).toContain('stroke="#ffffff"');
 root.dataset.accent='#7c5ce7';refresh();expect(svg()).toContain('stroke="#7c5ce7"');
});
it('restores appearance before app startup only for a matching unexpired persisted sign-in',()=>{
 const run=(age:number,persistedUid:string|null,appearanceUid='alice')=>{
  const values:Record<string,string>={'journas-auth-visit':JSON.stringify({uid:'alice',visited:Date.now()-age}),'journas-appearance':JSON.stringify({userId:appearanceUid,theme:'dark',accent:'#22c55e'})};
  if(persistedUid)values['firebase:authUser:test:[DEFAULT]']=JSON.stringify({uid:persistedUid});
  const keys=Object.keys(values);
  const root={dataset:{} as Record<string,string>,style:{setProperty:(key:string,value:string)=>{root.dataset[key]=value;},getPropertyValue:(key:string)=>root.dataset[key]??''}};
  const icon={href:'',getAttribute:()=>icon.href,setAttribute:(_key:string,value:string)=>{icon.href=value;}};
  runInNewContext(boot,{localStorage:{getItem:(key:string)=>values[key]??null,length:keys.length,key:(i:number)=>keys[i]},document:{documentElement:root,querySelector:()=>icon},matchMedia:()=>({matches:false}),MutationObserver:class{observe(){}}});
  return {...root.dataset,icon:decodeURIComponent(icon.href)} as Record<string,string>;
 };
 expect(run(1000,'alice')).toMatchObject({appearanceUser:'alice',theme:'dark','--accent':'#22c55e'});
 expect(run(1000,'alice').icon).toContain('stroke="#22c55e"');
 for(const result of [run(7*86400000,'alice'),run(1000,null),run(1000,'bob'),run(1000,'alice','bob')]){
  expect(result.appearanceUser).toBeUndefined();expect(result['--accent']).toBeUndefined();expect(result.icon).toContain('stroke="#7c5ce7"');
 }
});
