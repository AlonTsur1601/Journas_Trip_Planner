import {afterEach,describe,expect,it,vi} from 'vitest';
import {billingStatus} from '../shared/plans';
import {billingAction,applyBillingEvent,refreshMemberships} from '../server/billing';
import {retentionAt,retentionDeadline} from '../server/entitlements';
import {retentionNotices} from '../server/retention-notices';
import {PracticeStore} from '../server/practice';
import {JournasService} from '../server/service';
import type {Data} from '../server/types';
const day=86400000,now=Date.parse('2026-10-27T00:00:00Z');
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();});
function clock(){vi.useFakeTimers();vi.setSystemTime(now);}
class NoticeStore extends PracticeStore{
 async scanTrips(after='',limit=100){return (await this.list('trips')).filter(t=>String(t.id)>after).sort((a,b)=>String(a.id).localeCompare(String(b.id))).slice(0,limit);}
 async pendingRetentionNotices(limit:number){return (await this.list('retentionNotices')).filter(n=>n.status==='pending').slice(0,limit);}
}
const oldTrip={id:'trip',name:'Paris',ownerId:'alice',memberIds:['alice'],startDate:'2026-07-01',endDate:'2026-07-03',lodging:{timezone:'Europe/Paris'},deleted:false};
const free={id:'alice',billing:{source:'test',plan:'tourist'},settings:{autoDelete:false}};
function noticeStore(trip:Data=oldTrip){return new NoticeStore([['trips/trip',trip],['users/alice',free]]);}
describe('paid-period transitions',()=>{
 it('keeps paid access and cadence until the boundary when renewal arrives early',async()=>{
  clock();vi.stubEnv('PADDLE_PRICE_TRAVELER_YEAR','pri_renewal');const boundary=now+day,end=boundary+365*day;
  const store=new PracticeStore([['users/alice',{billing:{source:'sandbox',plan:'adventurer',interval:'month',periodEnd:boundary,pendingPlan:'traveler',pendingInterval:'year',subscriptionId:'sub_paid'}}]]);
  await applyBillingEvent(store,{event_id:'evt_renewal',event_type:'transaction.completed',occurred_at:new Date(now).toISOString(),data:{id:'txn_renewal',subscription_id:'sub_paid',custom_data:{uid:'alice',environment:'monetization-staging'},items:[{price:{id:'pri_renewal'}}],billing_period:{starts_at:new Date(boundary).toISOString(),ends_at:new Date(end).toISOString()}}});
  const user=await store.transaction(tx=>tx.get('users/alice'));
  expect(billingStatus(user,now)).toMatchObject({plan:'adventurer',interval:'month',periodEnd:boundary});
  expect(billingStatus(user,boundary)).toMatchObject({plan:'traveler',interval:'year',periodEnd:end,pendingPlan:null,downgradedAt:boundary});
  expect(billingStatus(user,end).plan).toBe('tourist');
 });
 it('retains portal identity after expiry and grants a full downgrade grace after payment grace',()=>{
  const b=billingStatus({billing:{source:'sandbox',plan:'traveler',periodEnd:now,status:'past_due',graceUntil:now+7*day,subscriptionId:'sub_manage'}},now+7*day);
  expect(b).toMatchObject({plan:'tourist',subscriptionId:'sub_manage',downgradedAt:now+7*day});
 });
 it('previews cadence changes without charging now or moving the existing renewal date',async()=>{
  clock();vi.stubEnv('JOURNAS_ENV','monetization-staging');vi.stubEnv('FIREBASE_PROJECT_ID','journas-monetization-2026');vi.stubEnv('BILLING_ENV','sandbox');vi.stubEnv('ADS_MODE','mock');vi.stubEnv('STAGING_PUBLIC_URL','https://journas-monetization-staging.vercel.app');vi.stubEnv('PADDLE_API_KEY','unit_sdbx_not_a_real_key');vi.stubEnv('PADDLE_PRICE_TRAVELER_YEAR','pri_year');
  const fetcher=vi.fn(async(_url:string,_options?:RequestInit)=>({ok:true,json:async()=>({data:{update_summary:null}})}));vi.stubGlobal('fetch',fetcher);
  const end=now+30*day,store=new PracticeStore([['users/alice',{billing:{source:'sandbox',plan:'traveler',interval:'month',periodEnd:end,subscriptionId:'sub_cadence'}}]]);
  const preview=await billingAction(store,'alice',{action:'billing.preview-change',plan:'traveler',interval:'year'});
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toMatchObject({proration_billing_mode:'do_not_bill',next_billed_at:new Date(end).toISOString()});
  await billingAction(store,'alice',{action:'billing.change-plan',plan:'traveler',interval:'year',previewId:preview.previewId});
  expect(billingStatus(await store.transaction(tx=>tx.get('users/alice')),now)).toMatchObject({interval:'month',pendingInterval:'year',plan:'traveler'});
  await expect(billingAction(store,'alice',{action:'billing.change-plan',plan:'traveler',interval:'year',previewId:preview.previewId})).rejects.toMatchObject({code:'PREVIEW_EXPIRED'});
  expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('rejects an old subscription payment while another paid subscription is active',async()=>{
  clock();vi.stubEnv('PADDLE_PRICE_ADVENTURER_MONTH','pri_new');const store=new PracticeStore([['users/alice',{billing:{source:'sandbox',plan:'traveler',periodEnd:now+day,subscriptionId:'sub_current'}}]]);
  await applyBillingEvent(store,{event_id:'evt_oldsub',event_type:'transaction.completed',occurred_at:new Date(now).toISOString(),data:{id:'txn_old',subscription_id:'sub_old',custom_data:{uid:'alice',environment:'monetization-staging'},items:[{price:{id:'pri_new'}}],billing_period:{ends_at:new Date(now+30*day).toISOString()}}});
  expect(billingStatus(await store.transaction(tx=>tx.get('users/alice')),now).plan).toBe('traveler');
 });
});
describe('retention deadlines and notifications',()=>{
 it('materializes unattended paid expiry for both owner and personal realtime access',async()=>{
  clock();const end=now+day,user={id:'alice',settings:{autoDelete:false},billing:{source:'sandbox',plan:'adventurer',periodEnd:end}};
  const expected=end+30*day;expect(retentionDeadline(oldTrip,user,now)).toBe(expected);
  const store=new PracticeStore([['users/alice',user],['trips/trip',oldTrip],['users/alice/trips/trip',{id:'trip'}]]);
  await refreshMemberships(store,'alice');expect((await store.transaction(tx=>tx.get('trips/trip')))?.ownerCleanupAt).toBe(expected);expect((await store.transaction(tx=>tx.get('users/alice/trips/trip')))?.cleanupAt).toBe(expected);
 });
 it('refreshes the owner deadline when a shorter retention setting is saved',async()=>{
  clock();const store=new PracticeStore([['users/alice',{...free,billing:{source:'test',plan:'adventurer'}}],['trips/trip',oldTrip],['users/alice/trips/trip',{id:'trip',endDate:oldTrip.endDate}]]);
  await new JournasService(store,()=>now,true).execute('alice',{action:'settings.save',settings:{autoDelete:true,retentionDays:30}});
  expect((await store.transaction(tx=>tx.get('trips/trip')))?.ownerCleanupAt).toBe(retentionAt(oldTrip,{settings:{autoDelete:true,retentionDays:30},billing:{source:'test',plan:'adventurer'}},now));
 });
 it('queues exactly one notice at each 30/7/1-day threshold',async()=>{
  const store=noticeStore(),end=retentionAt(oldTrip,free,now),mail={enabled:false,email:async()=>undefined,send:async()=>{}};
  for(const days of [30,7,1]){await retentionNotices(store,end-days*day,mail);await retentionNotices(store,end-days*day,mail);}
  expect((await store.list('retentionNotices')).map(n=>n.threshold).sort((a:any,b:any)=>a-b)).toEqual([1,7,30]);
 });
 it('cancels queued deletion warnings after a retention-extending upgrade',async()=>{
  const store=noticeStore(),at=retentionAt(oldTrip,free,now)-day,send=vi.fn();
  await retentionNotices(store,at,{enabled:false,email:async()=>undefined,send});
  await store.transaction(async tx=>tx.set('users/alice',{...free,billing:{source:'test',plan:'adventurer'}}));
  await retentionNotices(store,at,{enabled:true,email:async()=> 'alice@example.org',send});
  expect(send).not.toHaveBeenCalled();expect((await store.list('retentionNotices'))[0].status).toBe('canceled');
 });
 it('delivers pending work behind 100 old sent notices and retries SMTP failures',async()=>{
  const store=noticeStore(),at=retentionAt(oldTrip,free,now)-day;
  for(let i=0;i<100;i++)store.docs.set(`retentionNotices/old${i}`,{id:`old${i}`,status:'sent'});
  const send=vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue(undefined),mail={enabled:true,email:async()=> 'alice@example.org',send};
  expect((await retentionNotices(store,at,mail)).sent).toBe(0);expect((await retentionNotices(store,at,mail)).sent).toBe(1);expect((await retentionNotices(store,at,mail)).sent).toBe(0);expect(send).toHaveBeenCalledTimes(2);
 });
 it('scans beyond the first page and uses the owner deadline for a paid guest',async()=>{
  const store=noticeStore({...oldTrip,memberIds:['alice','bob']});store.docs.set('users/bob',{billing:{source:'test',plan:'adventurer'},settings:{autoDelete:false}});
  for(let i=0;i<101;i++)store.docs.set(`trips/a${String(i).padStart(3,'0')}`,{...oldTrip,id:`a${String(i).padStart(3,'0')}`,endDate:'2030-01-01'});
  const at=retentionAt(oldTrip,free,now)-day,send=vi.fn();await retentionNotices(store,at,{enabled:true,email:async()=> 'guest@example.org',send});
  expect(send).toHaveBeenCalledTimes(2);expect((await store.list('retentionNotices')).every(n=>n.ownerDeletion===true)).toBe(true);
 });
 it('keeps non-deliverable test addresses out of the pending mail queue',async()=>{
  const store=noticeStore(),at=retentionAt(oldTrip,free,now)-day,send=vi.fn();
  await store.transaction(async tx=>tx.set('users/alice',{...free,verifiedEmail:'tourist@journas.test'}));
  await retentionNotices(store,at,{enabled:true,email:async()=> 'tourist@journas.test',send});
  expect(await store.pendingRetentionNotices(100)).toHaveLength(0);expect(send).not.toHaveBeenCalled();
 });
});
describe('active choices across plan changes',()=>{
 it('caps old selections on downgrade, restores access on upgrade and lets an owner choose an overlap',async()=>{
  clock();const store=new PracticeStore([['users/alice',{id:'alice',tripCount:0,settings:{autoDelete:false},billing:{source:'test',plan:'adventurer'}}]]),service=new JournasService(store,()=>now,true),ids:string[]=[];
  for(let i=1;i<=6;i++){const result:any=await service.execute('alice',{action:'trip.create',name:`Trip ${i}`,startDate:`2026-11-0${i}`,endDate:`2026-11-0${i}`,lodging:{lng:2.3,lat:48.8},clientTimezone:'UTC'});ids.push(result.trip.id);}
  await service.execute('alice',{action:'trip.select-active',tripIds:ids});
  async function plan(plan:string){await store.transaction(async tx=>{const u=await tx.get('users/alice');tx.set('users/alice',{...u,billing:{source:'test',plan}});});}
  await plan('tourist');let list:any=await service.execute('alice',{action:'trip.list'});expect(list.trips.filter((t:any)=>!t.access.readonlyReason)).toHaveLength(5);
  await service.execute('alice',{action:'trip.select-active',tripIds:[ids[5]]});list=await service.execute('alice',{action:'trip.list'});expect(list.trips.filter((t:any)=>!t.access.readonlyReason).map((t:any)=>t.id)).toEqual([ids[5]]);
  await plan('adventurer');list=await service.execute('alice',{action:'trip.list'});expect(list.trips.every((t:any)=>!t.access.readonlyReason)).toBe(true);
  const overlap:any=await service.execute('alice',{action:'trip.create',name:'Overlap',startDate:'2026-11-01',endDate:'2026-11-01',lodging:{lng:2.3,lat:48.8},clientTimezone:'UTC'});
  await plan('traveler');list=await service.execute('alice',{action:'trip.list'});expect(list.trips.filter((t:any)=>t.startDate==='2026-11-01'&&!t.access.readonlyReason)).toHaveLength(1);
  await expect(service.execute('alice',{action:'trip.select-active',tripIds:[ids[0],overlap.trip.id]})).rejects.toMatchObject({code:'ACTIVE_TRIP_OVERLAP'});
  await service.execute('alice',{action:'trip.select-active',tripIds:[overlap.trip.id]});list=await service.execute('alice',{action:'trip.list'});expect(list.trips.find((t:any)=>t.id===overlap.trip.id).access.readonlyReason).toBe(null);
 });
});
