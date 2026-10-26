import {randomUUID} from 'node:crypto';
import type {Store} from './types.js';
import {retentionAt} from './entitlements.js';
import {adminAuth} from './store.js';
import {deliverAccountMail} from './account-mail.js';
type Delivery={enabled:boolean;email:(uid:string)=>Promise<string|undefined>;send:(email:string,message:string)=>Promise<unknown>};
const delivery=():Delivery=>({enabled:Boolean(process.env.SMTP_HOST||process.env.BREVO_SMTP_KEY),email:async uid=>(await adminAuth().getUser(uid)).email,send:(email,message)=>deliverAccountMail(email,'Journas: trip retention reminder',undefined,message)});
export async function retentionNotices(store:Store,now=Date.now(),mail=delivery()){
 let checked=0,queued=0;
 const state=await store.transaction(tx=>tx.get('maintenance/retention-notices'));let after=String(state?.cursor??'');
 // Cover the allowlisted staging inventory in one run; persist a cursor for larger inventories.
 for(let page=0;page<10;page++){
  const trips=await store.scanTrips(after,100);
  for(const snapshot of trips){
   if(snapshot.deleted)continue;
   for(const uid of snapshot.memberIds as string[]){
    const created=await store.transaction(async tx=>{
     const trip=await tx.get(`trips/${snapshot.id}`);if(!trip||trip.deleted||!(trip.memberIds as string[]).includes(uid))return false;
     const user=await tx.get(`users/${uid}`),owner=await tx.get(`users/${trip.ownerId}`),deadline=Math.min(retentionAt(trip,user,now),retentionAt(trip,owner,now)),remaining=(deadline-now)/86400000;
     if(remaining<=0||remaining>30)return false;const threshold=remaining<=1?1:remaining<=7?7:30;
     const id=`${uid}_${trip.id}_${deadline}_${threshold}`,path=`retentionNotices/${id}`;
     if(await tx.get(path))return false;
     const ownerDeletion=retentionAt(trip,owner,now)<=retentionAt(trip,user,now);
     tx.set(path,{id,uid,tripId:trip.id,deadline,threshold,ownerDeletion,createdAt:now,status:typeof user?.verifiedEmail==='string'&&user.verifiedEmail.endsWith('.test')?'test-only':'pending'});return true;
    });checked++;if(created)queued++;
   }
  }
  after=trips.length===100?String(trips.at(-1)!.id):'';
  await store.transaction(async tx=>tx.set('maintenance/retention-notices',{cursor:after,updatedAt:now}));
  if(!after)break;
 }
 let sent=0;
 const notices=store.pendingRetentionNotices?await store.pendingRetentionNotices(100):(await store.list('retentionNotices',10000)).filter(notice=>notice.status==='pending').slice(0,100);
 for(const snapshot of notices){
  const token=randomUUID(),path=`retentionNotices/${snapshot.id}`;
  const claimed=await store.transaction(async tx=>{
   const notice=await tx.get(path);if(!notice||notice.status!=='pending'||Number(notice.leaseUntil??0)>now)return null;
   const trip=await tx.get(`trips/${notice.tripId}`),user=await tx.get(`users/${notice.uid}`),owner=trip?await tx.get(`users/${trip.ownerId}`):undefined;
   const deadline=trip?Math.min(retentionAt(trip,user,now),retentionAt(trip,owner,now)):0;
   if(!trip||trip.deleted||!(trip.memberIds as string[]).includes(String(notice.uid))||deadline!==notice.deadline||deadline<=now){tx.set(path,{...notice,status:'canceled'});return null;}
   if(!mail.enabled)return null;
   tx.set(path,{...notice,leaseUntil:now+10*60000,leaseToken:token});return {notice,trip};
  });
  if(!claimed)continue;
  let delivered=false,testOnly=false;
  try{
   const email=await mail.email(String(claimed.notice.uid));
   testOnly=Boolean(email?.endsWith('.test'));
   if(email&&!email.endsWith('.test')){
    const scope=claimed.notice.ownerDeletion?'The owner’s retention period is ending, so this trip will be removed for every traveler.':'This trip will be removed from your account. Other travelers keep their own access.';
    const message=`Your Journas trip “${String(claimed.trip.name)}” is scheduled for removal on ${new Date(Number(claimed.notice.deadline)).toISOString().slice(0,10)}. ${scope} Review your plan before that date to extend retention. This message is from the isolated Journas testing environment.`;
    await mail.send(email,message);delivered=true;
   }
  }catch{/* Retry failures on a later maintenance run without losing the notice. */}
  await store.transaction(async tx=>{const current=await tx.get(path);if(current?.leaseToken===token)tx.set(path,{...current,status:delivered?'sent':testOnly?'test-only':'pending',leaseUntil:0,leaseToken:null,...(delivered?{sentAt:now}:{})});});
  if(delivered)sent++;
 }
 return {checked,queued,sent};
}
