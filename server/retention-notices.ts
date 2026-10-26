import type {Store,Data} from './types.js';
import {retentionAt} from './entitlements.js';
import {adminAuth} from './store.js';
import {deliverAccountMail} from './account-mail.js';
export async function retentionNotices(store:Store,now=Date.now()){
 let after='',checked=0,queued=0;
 // Staging is allowlisted. Bound work per invocation while persisting the cursor.
 const state=await store.transaction(tx=>tx.get('maintenance/retention-notices'));after=String(state?.cursor??'');
 const trips=await store.scanTrips(after,100);
 for(const trip of trips){
  if(trip.deleted)continue;
  for(const uid of trip.memberIds as string[]){
   await store.transaction(async tx=>{
    const user=await tx.get(`users/${uid}`),owner=await tx.get(`users/${trip.ownerId}`),deadline=Math.min(retentionAt(trip,user,now),retentionAt(trip,owner,now)),remaining=(deadline-now)/86400000;
    if(remaining<=0||remaining>30)return;const threshold=remaining<=1?1:remaining<=7?7:30;
    const id=`${uid}_${trip.id}_${deadline}_${threshold}`,path=`retentionNotices/${id}`;
    if(await tx.get(path))return;
    const ownerDeletion=retentionAt(trip,owner,now)<=retentionAt(trip,user,now);
    tx.set(path,{id,uid,tripId:trip.id,deadline,threshold,ownerDeletion,createdAt:now,status:'pending'});queued++;
   });checked++;
  }
 }
 await store.transaction(async tx=>{tx.set('maintenance/retention-notices',{cursor:trips.length===100?trips.at(-1)!.id:'',updatedAt:now});});
 let sent=0;
 for(const notice of await store.list('retentionNotices',100)){
  if(notice.status!=='pending')continue;
  const valid=await store.transaction(async tx=>{const trip=await tx.get(`trips/${notice.tripId}`),user=await tx.get(`users/${notice.uid}`);if(!trip||trip.deleted||!(trip.memberIds as string[]).includes(String(notice.uid)))return null;const owner=await tx.get(`users/${trip.ownerId}`),deadline=Math.min(retentionAt(trip,user,now),retentionAt(trip,owner,now));return deadline===notice.deadline&&deadline>now?trip:null;});
  if(!valid){await store.transaction(async tx=>tx.set(`retentionNotices/${notice.id}`,{...notice,status:'canceled'}));continue;}
  if(!process.env.SMTP_HOST&&!process.env.BREVO_SMTP_KEY)continue;
  const account=await adminAuth().getUser(String(notice.uid));if(!account.email||account.email.endsWith('.test'))continue;
  const scope=notice.ownerDeletion?'The owner’s retention period is ending, so this trip will be removed for every traveler.':'This trip will be removed from your account. Other travelers keep their own access.';
  const message=`Your Journas trip “${String(valid.name)}” is scheduled for removal on ${new Date(Number(notice.deadline)).toISOString().slice(0,10)}. ${scope} Review your plan before that date to extend retention. This message is from the isolated Journas testing environment.`;
  try{await deliverAccountMail(account.email,'Journas: trip retention reminder',undefined,message);await store.transaction(async tx=>tx.set(`retentionNotices/${notice.id}`,{...notice,status:'sent',sentAt:now}));sent++;}catch{/* Preserve pending notice for the next maintenance run. */}
 }
 return {checked,queued,sent};
}
