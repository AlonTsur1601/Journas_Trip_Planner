import {useEffect,useRef,useState} from 'react';
import {usePlan} from './plan-state';
export function MockAd({placement}:{placement:string}){return <aside className={`mock-ad mock-${placement}`} aria-label="Test advertisement"><small>Advertisement · test placement</small><span>Ad preview</span><small>Google approval required · no tracking</small></aside>;}
export function ModalAd({title}:{title:string}){
 const {personal,practice}=usePlan(),anchor=useRef<HTMLDivElement>(null),[side,setSide]=useState<{left:number;top:number;width:number}|null>(null);
 const eligible=/^(Places|Connections|Trip details|Create trip|Edit trip)$/.test(title);
 useEffect(()=>{if(!eligible)return;const element=anchor.current?.closest<HTMLElement>('.modal');if(!element)return;const update=()=>{const r=element.getBoundingClientRect(),width=160,gap=24;if(innerWidth<=700){setSide(null);return;}const left=r.right+gap+width<=innerWidth-16?r.right+gap:r.left-gap-width>=16?r.left-gap-width:null;setSide(left===null?null:{left,top:Math.max(70,r.top),width});};const observer=new ResizeObserver(update);observer.observe(element);window.addEventListener('resize',update);update();return()=>{observer.disconnect();window.removeEventListener('resize',update);};},[eligible]);
 if(!personal.ads||practice||!eligible)return null;
 return <div ref={anchor} className={`modal-ad${side?' has-space':''}`} style={side?{left:side.left,top:side.top,width:side.width}:undefined}><MockAd placement="dialog"/></div>;
}
