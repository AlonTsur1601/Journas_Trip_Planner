import {plans,billingStatus,basicColors,isBasicEmoji,isJournasSymbol,requiredPlan,addCalendarYears,type Feature,type PlanId} from '../shared/plans.js';
import {ApiError,type Data,type Store,type Transaction,type Trip} from './types.js';
import {resolveWallTime} from './time.js';
const dayMs=86400000;
export function upgrade(feature:Feature|'trips'|'days'|'horizon'|'members'|'overlaps',plan:PlanId,limit?:number,current?:number):never{
 throw new ApiError(403,'UPGRADE_REQUIRED',`This action requires ${plan}.`,{feature,requiredPlan:plan,...(limit===undefined?{}:{limit,current})});
}
export function requireFeature(user:Data|undefined,feature:Feature,now:number){const plan=plans[billingStatus(user,now).plan];if(!plan.features[feature])upgrade(feature,requiredPlan(feature));}
export function checkAppearance(user:Data|undefined,value:Data|undefined,previous:Data|undefined,now:number){
 if(!value)return;const plan=plans[billingStatus(user,now).plan];
 if(typeof value.color==='string'&&value.color!==previous?.color&&!basicColors.includes(value.color.toLowerCase())&&!plan.features.advancedColor)upgrade('advancedColor','adventurer');
 if(typeof value.accent==='string'&&value.accent!==previous?.accent&&!basicColors.includes(value.accent.toLowerCase())&&!plan.features.advancedColor)upgrade('advancedColor','adventurer');
 if(typeof value.symbol==='string'&&value.symbol!==previous?.symbol&&!isJournasSymbol(value.symbol)){
  if(!plan.features.basicEmoji)upgrade('basicEmoji','traveler');
  if(!plan.features.allEmoji&&!isBasicEmoji(value.symbol))upgrade('allEmoji','adventurer');
 }
}
export function retentionAt(trip:Data,user:Data|undefined,now:number){
 const status=billingStatus(user,now),plan=plans[status.plan],settings=user?.settings as Data|undefined;
 const days=plan.retentionDays===null?(settings?.autoDelete?Number(settings.retentionDays??365):null):Math.min(plan.retentionDays,settings?.autoDelete?Number(settings.retentionDays??plan.retentionDays):plan.retentionDays);
 if(days===null)return Number.MAX_SAFE_INTEGER;
 const zone=String((trip.lodging as Data|undefined)?.timezone??'UTC');
 const end=resolveWallTime(String(trip.endDate),'24:00',zone,'later');
 return Math.max(end+days*dayMs,Number(status.downgradedAt??0)?Number(status.downgradedAt)+30*dayMs:0);
}
export function localDay(now:number,zone='UTC'){try{return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}catch{throw new ApiError(400,'INVALID_TIMEZONE','Invalid local timezone');}}
export function rangeIssue(trip:Data,owner:Data|undefined,now:number,zone='UTC'){
 const plan=plans[billingStatus(owner,now).plan];
 if(plan.days!==null&&(Date.parse(String(trip.endDate))-Date.parse(String(trip.startDate)))/dayMs+1>plan.days)return 'days';
 if(plan.horizonYears!==null&&String(trip.endDate)>addCalendarYears(localDay(now,zone),plan.horizonYears))return 'horizon';
 if(plan.members!==null&&(trip.memberIds as string[]).length>plan.members)return 'members';
 return null;
}
const intersects=(a:Data,b:Data)=>String(a.startDate)<=String(b.endDate)&&String(b.startDate)<=String(a.endDate);
async function accountTrips(tx:Transaction,uid:string){const refs=await tx.list(`users/${uid}/trips`);return (await Promise.all(refs.map(ref=>tx.get(`trips/${ref.id}`)))).filter(trip=>trip&&!trip.deleted&&(trip.memberIds as string[]).includes(uid)) as Trip[];}
export async function accessFor(tx:Transaction,uid:string,trip:Data,user:Data|undefined,now:number){
 const owner=await tx.get(`users/${trip.ownerId}`),status=billingStatus(owner,now),owned=await accountTrips(tx,String(trip.ownerId));
 const personal=await accountTrips(tx,uid),limit=plans[billingStatus(user,now).plan].trips;
 const active=Array.isArray(user?.activeTripIds)?user.activeTripIds as string[]:[];
 const today=localDay(now);
 const priority=(t:Data)=>String(t.startDate)<=today&&String(t.endDate)>=today?0:String(t.startDate)>today?1:2;
 personal.sort((a,b)=>{const ai=active.indexOf(a.id),bi=active.indexOf(b.id);if(ai>=0||bi>=0)return (ai<0?1e6:ai)-(bi<0?1e6:bi);return priority(a)-priority(b)||(priority(a)===1?a.startDate.localeCompare(b.startDate):b.endDate.localeCompare(a.endDate))||a.id.localeCompare(b.id);});
 let reason=(Array.isArray(user?.activeTripIds)?!active.includes(String(trip.id)):personal.findIndex(t=>t.id===trip.id)>=limit)?'trips':rangeIssue(trip,owner,now,String(trip.planningTimezone??'UTC'));
 const ownerActive=owner?.activeTripIds as string[]|undefined,ownerLimit=plans[status.plan].trips;
 if(!reason&&uid!==trip.ownerId){
  if(Array.isArray(ownerActive)){if(!ownerActive.includes(String(trip.id)))reason='trips';}
  else{owned.sort((a,b)=>priority(a)-priority(b)||(priority(a)===1?a.startDate.localeCompare(b.startDate):b.endDate.localeCompare(a.endDate))||a.id.localeCompare(b.id));if(owned.findIndex(t=>t.id===trip.id)>=ownerLimit)reason='trips';}
 }
 if(!reason&&!plans[status.plan].overlaps&&owned.some(other=>other.id!==trip.id&&other.ownerId===trip.ownerId&&intersects(trip,other)))reason='overlaps';
 const ownerExpired=retentionAt(trip,owner,now)<=now,personalExpired=retentionAt(trip,user,now)<=now;
 return {ownerPlan:status.plan,readonlyReason:reason,expired:ownerExpired||personalExpired,cleanupAt:Math.min(retentionAt(trip,owner,now),retentionAt(trip,user,now)),ownerCleanupAt:retentionAt(trip,owner,now)};
}
/** Buffer every write, including history restores, and check the final domain state before committing. */
export function policyStore(store:Store,uid:string,input:Data,now:number):Store{
 return {...store,transaction:fn=>store.transaction(async raw=>{
  const writes=new Map<string,Data|null>(),previous=new Map<string,Data|undefined>();
  const user=await raw.get(`users/${uid}`),status=billingStatus(user,now),personalPlan=plans[status.plan];
  const tripId=typeof input.tripId==='string'?input.tripId:null,oldTrip=tripId?await raw.get(`trips/${tripId}`):undefined;
  const oldAccess=oldTrip&&(oldTrip.memberIds as string[])?.includes(uid)?await accessFor(raw,uid,oldTrip,user,now):null;
  const action=String(input.action),reducing=['trip.remove','member.remove','trip.update','trip.select-active','share.revoke'].includes(action);
  if(oldAccess?.expired&&!['trip.remove'].includes(action))throw new ApiError(410,'TRIP_EXPIRED','This trip has reached its retention deadline.');
  if(oldAccess?.readonlyReason&&action==='trip.update'&&(oldAccess.readonlyReason==='trips'||input.startDate===oldTrip?.startDate&&input.endDate===oldTrip?.endDate))throw new ApiError(403,'PLAN_READ_ONLY','Resolve the trip limit before changing this trip.',{feature:oldAccess.readonlyReason,requiredPlan:status.plan==='tourist'?'traveler':'adventurer'});
  if(oldAccess?.readonlyReason&&!reducing&&!['trip.get','trip.members','layout.save','history.status'].includes(action))throw new ApiError(403,'PLAN_READ_ONLY','This trip is read-only until its plan limits are resolved.',{feature:oldAccess.readonlyReason,requiredPlan:status.plan==='tourist'?'traveler':'adventurer'});
  const tx:Transaction={
   get:async path=>writes.has(path)?writes.get(path)??undefined:raw.get(path),
   list:async path=>{const values=await raw.list(path),byId=new Map(values.map(value=>[String(value.id),value]));for(const [p,v]of writes)if(p.slice(0,p.lastIndexOf('/'))===path){const id=p.slice(p.lastIndexOf('/')+1);if(v)byId.set(id,v);else byId.delete(id);}return [...byId.values()];},
   set:(path,value)=>{writes.set(path,structuredClone(value));},delete:path=>{writes.set(path,null);},
  };
  const result=await fn(tx);
  for(const path of writes.keys())previous.set(path,await raw.get(path));
  if(action==='item.copy-pin')requireFeature(user,'copyPlaces',now);
  for(const [path,value]of writes){
   const before=previous.get(path);
   if(path===`users/${uid}`&&value){
    checkAppearance(user,value.settings as Data,before?.settings as Data,now);
    const home=value.home as Data|undefined,oldHome=before?.home as Data|undefined;
    if(home&&JSON.stringify(home.pins)!==JSON.stringify(oldHome?.pins)){
     const oldPins=oldHome?.pins as unknown[]??[],pins=home.pins as unknown[]??[];
     if(pins.length>personalPlan.homePins&&pins.some(pin=>!oldPins.some(old=>JSON.stringify(old)===JSON.stringify(pin))))upgrade('homePins',personalPlan.plan==='tourist'?'traveler':'adventurer',personalPlan.homePins,pins.length);
    }
   }
   if(/^users\/[^/]+\/trips\/[^/]+$/.test(path)&&value&&!before){const memberUid=path.split('/')[1],memberUser=await tx.get(`users/${memberUid}`),memberPlan=plans[billingStatus(memberUser,now).plan],trips=await accountTrips(tx,memberUid);if(trips.length>memberPlan.trips)upgrade('trips',memberPlan.plan==='tourist'?'traveler':'adventurer',memberPlan.trips,trips.length);}
   if(/^trips\/[^/]+$/.test(path)&&value&&!value.deleted){
    const owner=await tx.get(`users/${value.ownerId}`),plan=plans[billingStatus(owner,now).plan];
    if(!before||value.startDate!==before.startDate||value.endDate!==before.endDate||(value.memberIds as string[]).length>(before.memberIds as string[]).length){
     const issue=rangeIssue(value,owner,now,String(value.planningTimezone??input.clientTimezone??'UTC'));
     if(issue)upgrade(issue,plan.plan==='tourist'?'traveler':'adventurer');
     const owned=await accountTrips(tx,String(value.ownerId));
     if(!plan.overlaps&&owned.some(t=>t.id!==value.id&&t.ownerId===value.ownerId&&intersects(t,value)))upgrade('overlaps','adventurer');
    }
    checkAppearance(user,value.appearance as Data,before?.appearance as Data,now);checkAppearance(user,value.lodging as Data,before?.lodging as Data,now);
   }
   if(value?.kind&&/^trips\/[^/]+\/days\/[^/]+\/items\/[^/]+$/.test(path)){
    const trip=await tx.get(`trips/${path.split('/')[1]}`),owner=await tx.get(`users/${trip?.ownerId}`);
    if(['tasks','blocks'].includes(String(value.kind))&&(value.pinId||value.connectionId||value.blockId))requireFeature(owner,'linkedPlanning',now);
    if(action.startsWith('history.'))checkAppearance(user,value,before,now);
    else if(action==='item.patch'&&input.id===value.id&&input.kind===value.kind){
     const requested={...(input.patch as Data)},inherited=Array.isArray(value.overrides)?value.overrides as string[]:[];
     if(value.kind==='blocks'&&(value.pinId||value.connectionId)){for(const field of ['color','symbol'])if(!inherited.includes(field))delete requested[field];}
     checkAppearance(user,requested,before,now);
    }
   }
  }
  // Materialize expiry for realtime security rules as well as API checks.
  for(const [path,value]of [...writes])if(value&&/^trips\/[^/]+$/.test(path)&&!value.deleted){const owner=await tx.get(`users/${value.ownerId}`);writes.set(path,{...value,ownerCleanupAt:retentionAt(value,owner,now)});}
  for(const [path,value]of writes)if(value)raw.set(path,value);else raw.delete(path);
  return result;
 })};
}
