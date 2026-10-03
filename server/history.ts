import {randomUUID} from 'node:crypto';
import {ApiError,type Data,type Store,type Transaction} from './types.js';
const lifetime=600000;
const mutations=new Set(['item.patch','item.delete','trip.create','trip.update','trip.remove','share.create','share.revoke','share.join','member.remove','settings.save','profile.save']);
const stable=(value:any):string=>JSON.stringify(value===undefined?null:Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>!['versions','updatedAt','updatedBy'].includes(k)).map(k=>[k,JSON.parse(stable(value[k]))])):value);
export async function historyTransaction(store:Store,uid:string,input:Data,now:number,run:(tx:Transaction)=>Promise<Data>):Promise<Data>{
 if(!mutations.has(String(input.action))&&!String(input.action).startsWith('history.'))return store.transaction(run);
 return store.transaction(async raw=>{
  const root=`users/${uid}/history`,statePath=`users/${uid}/historyState/current`,state=await raw.get(statePath),branch=String(state?.branch??'initial'),entries=await raw.list(root);
  const recent=entries.filter(e=>Number(e.at)>now-lifetime&&(!e.undone||String(e.branch??'initial')===branch)).sort((a,b)=>Number(a.at)-Number(b.at));
  for(const entry of entries.filter(e=>Number(e.at)<=now-lifetime).slice(0,100))raw.delete(`${root}/${entry.id}`);
  if(input.action==='history.status')return {undo:recent.filter(e=>!e.undone).at(-1)?.id??null,redo:recent.find(e=>e.undone)?.id??null};
  if(input.action==='history.undo'||input.action==='history.redo'){
   const undo=input.action==='history.undo',entry=undo?recent.filter(e=>!e.undone).at(-1):recent.find(e=>e.undone);
   if(!entry)throw new ApiError(409,'HISTORY_EMPTY','No recent action to restore');
   const changes=entry.changes as {path:string;before:Data|null;after:Data|null}[];
   const originalTripId=String(entry.tripId??'');
   if(originalTripId&&['item.patch','item.delete','trip.update','share.create','share.revoke','member.remove'].includes(String(entry.action))){
    const trip=await raw.get(`trips/${originalTripId}`);
    if(!trip||trip.deleted||!(trip.memberIds as string[]).includes(uid))throw new ApiError(403,'FORBIDDEN','Your access to this trip has changed');
    if(['share.create','share.revoke','member.remove'].includes(String(entry.action))&&trip.ownerId!==uid)throw new ApiError(403,'FORBIDDEN','Only the owner can restore sharing changes');
   }
   const current=await Promise.all(changes.map(c=>raw.get(c.path)));
   if(changes.some((c,i)=>stable(current[i])!==stable(undo?c.after:c.before)))throw new ApiError(409,'HISTORY_CONFLICT','Another change affects this action. It cannot be restored safely.');
   changes.forEach((c,i)=>{
    const restored=structuredClone(undo?c.before:c.after);
    if(restored){
     if(restored.kind){const previous=current[i]?.versions as Record<string,number>??{};const next=restored.versions as Record<string,number>??{};restored.versions=Object.fromEntries([...new Set([...Object.keys(previous),...Object.keys(next)])].map(k=>[k,Math.max(previous[k]??0,next[k]??0)+1]));restored.updatedAt=now;restored.updatedBy=uid;}
     raw.set(c.path,restored);
    }else raw.delete(c.path);
   });
   raw.set(`${root}/${entry.id}`,{...entry,undone:undo,branch});
   return {screen:(undo?entry.screen:entry.screenAfter??entry.screen)??null,action:entry.action};
  }
  if(input.action==='history.view'){
   const id=randomUUID();const nextBranch=recent.some(e=>e.undone)?randomUUID():branch;if(nextBranch!==branch)raw.set(statePath,{branch:nextBranch});
   raw.set(`${root}/${id}`,{id,at:Math.max(now,Number(recent.at(-1)?.at??0)+1),action:input.action,screen:input.screen??null,screenAfter:input.screenAfter??null,changes:[],undone:false,branch:nextBranch});return {historyId:id};
  }
  if(!mutations.has(String(input.action)))return run(raw);
  const writes=new Map<string,Data|null>(),before=new Map<string,Data|null>();
  const tx:Transaction={get:async path=>writes.has(path)?writes.get(path)??undefined:raw.get(path),list:async path=>{
   const found=await raw.list(path);const records=new Map(found.map(v=>[String(v.id),v]));
   for(const [p,v]of writes)if(p.slice(0,p.lastIndexOf('/'))===path){const id=p.slice(p.lastIndexOf('/')+1);if(v)records.set(id,v);else records.delete(id);}return [...records.values()];
  },set:(path,value)=>{writes.set(path,structuredClone(value));},delete:path=>{writes.set(path,null);}};
  const result=await run(tx);
  for(const [path,value]of writes)if(path.startsWith('cleanupJobs/')&&value)value.undoUntil=now+lifetime;
  for(const path of writes.keys())before.set(path,(await raw.get(path))??null);
  const changes=[...writes].filter(([p,v])=>stable(v)!==stable(before.get(p))).map(([path,after])=>({path,before:before.get(path)??null,after}));
  for(const [path,value]of writes)if(value)raw.set(path,value);else raw.delete(path);
  if(changes.length){
   const id=randomUUID();const screen=input.screen??null;
   if(JSON.stringify({changes,screen}).length>700000)throw new ApiError(400,'HISTORY_SIZE','This action is too large to retain safely');
   const nextBranch=recent.some(e=>e.undone)?randomUUID():branch;if(nextBranch!==branch)raw.set(statePath,{branch:nextBranch});
   const trip=result.trip as any;
   const screenAfter=input.action==='trip.create'&&screen?{...(screen as any),tripId:trip.id,date:trip.startDate}:input.action==='trip.remove'&&screen?{...(screen as any),tripId:null}:screen;
   raw.set(`${root}/${id}`,{id,at:Math.max(now,Number(recent.at(-1)?.at??0)+1),tripId:input.tripId??trip?.id??null,action:input.action,screen,screenAfter,changes,undone:false,branch:nextBranch});
   return {...result,historyId:id};
  }
  return result;
 });
}
