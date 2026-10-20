import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {readAppearance} from '../src/appearance-cache';
it('restores appearance only for the authenticated account',()=>{
 const storage={getItem:()=>JSON.stringify({userId:'alice',theme:'dark',accent:'#22c55e'})};
 expect(readAppearance('alice',storage)).toEqual({theme:'dark',accent:'#22c55e'});
 expect(readAppearance('bob',storage)).toEqual({});
 expect(readAppearance('',storage)).toEqual({});
 expect(readAppearance('alice',{getItem:()=>'{"theme":"dark","accent":"#22c55e"}'})).toEqual({});
 expect(readAppearance('alice',{getItem:()=>'{bad'})).toEqual({});
 expect(readAppearance('alice',{getItem:()=>'{"userId":"alice","accent":"url(evil)","theme":"invalid"}'})).toEqual({});
});
it('uses a self-hosted bootstrap allowed by production CSP',()=>{
 const html=readFileSync('index.html','utf8');
 expect(html).toContain('<script src="/appearance.js"></script>');
 expect(html).not.toMatch(/<script>/);
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 const csp=config.headers.flatMap((x:any)=>x.headers).find((x:any)=>x.key==='Content-Security-Policy').value;
 expect(csp).toContain("script-src 'self'");
});
it('starts neutral before authentication and follows the active account accent',()=>{
 const root={dataset:{} as Record<string,string>,style:{getPropertyValue:()=>root.dataset.accent??''}};
 const icon={href:'',getAttribute:()=>icon.href,setAttribute:(_key:string,value:string)=>{icon.href=value;}};
 let refresh=()=>{};
 runInNewContext(readFileSync('public/appearance.js','utf8'),{document:{documentElement:root,querySelector:()=>icon},matchMedia:()=>({matches:true}),MutationObserver:class{constructor(callback:()=>void){refresh=callback;}observe(){}}});
 const svg=()=>decodeURIComponent(icon.href);
 expect(root.dataset.theme).toBe('dark');expect(svg()).toContain('stroke="#7c5ce7"');
 root.dataset.accent='#22c55e';refresh();expect(svg()).toContain('stroke="#22c55e"');
 root.dataset.accent='#ffffff';refresh();expect(svg()).toContain('stroke="#ffffff"');
 root.dataset.accent='#7c5ce7';refresh();expect(svg()).toContain('stroke="#7c5ce7"');
});
