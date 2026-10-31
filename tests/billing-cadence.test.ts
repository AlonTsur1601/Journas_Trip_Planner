import {afterEach,describe,it,expect,vi} from 'vitest';
import {billingAction,resumeCadenceChange,applyBillingEvent} from '../server/billing';
import {billingStatus} from '../shared/plans';
import {PracticeStore} from '../server/practice';
const day=86400000;
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(from='traveler',cadence='month',to='traveler',interval='year'){
 const end=Date.now()+30*day,renewal=new Date(end).toISOString(),source=`pri_${from}${cadence}`,target=`pri_${to}${interval}`;
 for(const [key,value]of Object.entries({JOURNAS_ENV:'monetization-staging',FIREBASE_PROJECT_ID:'journas-monetization-2026',BILLING_ENV:'sandbox',ADS_MODE:'mock',STAGING_PUBLIC_URL:'https://journas-monetization-staging.vercel.app',PADDLE_API_KEY:'unit_sdbx_mock',['PADDLE_PRICE_'+to.toUpperCase()+'_'+interval.toUpperCase()]:target}))vi.stubEnv(key,value);
 let subscription:any={id:'sub_test',status:'active',items:[{price:{id:source},quantity:1}],next_billed_at:renewal,scheduled_change:null};
 const calls:any[]=[],total=interval==='year'?(to==='adventurer'?'9999':'4999'):(to==='adventurer'?'999':'499');
 const control={failDate:0,loseFirstResponse:false};
 vi.spyOn(console,'warn').mockImplementation(()=>{});
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:any={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,method:options.method??'GET',body});
  if(url.endsWith('/preview'))return {ok:true,json:async()=>({data:{immediate_transaction:null,next_billed_at:new Date(Date.now()+365*day).toISOString(),recurring_transaction_details:{totals:{grand_total:total,currency_code:'USD'}}}})};
  if(body){expect(Boolean(body.items)&&Boolean(body.next_billed_at)).toBe(false);expect(body.proration_billing_mode).toBe('do_not_bill');
   if(body.items){subscription={...subscription,items:body.items,next_billed_at:cadence===interval?subscription.next_billed_at:new Date(Date.now()+365*day).toISOString()};if(control.loseFirstResponse){control.loseFirstResponse=false;throw Error('Connection dropped after provider applied update');}}
   else{if(control.failDate-->0)return {ok:false,status:503,json:async()=>({error:{code:'unavailable',detail:'temporary'}})};subscription={...subscription,next_billed_at:body.next_billed_at};}
  }
  return {ok:true,json:async()=>({data:structuredClone(subscription)})};
 }));
 const store=new PracticeStore([['users/alice',{billing:{source:'sandbox',status:'active',plan:from,interval:cadence,periodEnd:end,subscriptionId:'sub_test'}}]]);
 return {store,control,calls,end,renewal,source,target,to,interval,get subscription(){return subscription;}};
}
async function preview(f:ReturnType<typeof setup>){return billingAction(f.store,'alice',{action:'billing.preview-change',plan:f.to,interval:f.interval});}
async function confirm(f:ReturnType<typeof setup>,p:any){return billingAction(f.store,'alice',{action:'billing.change-plan',plan:f.to,interval:f.interval,previewId:p.previewId});}
describe('combined plan and cadence workflow',()=>{
 it.each([['adventurer','month','traveler','year'],['adventurer','year','traveler','month'],['traveler','month','traveler','year'],['adventurer','month','traveler','month'],['traveler','year','traveler','month']])('schedules %s/%s to %s/%s at the paid boundary',async(from,cadence,to,interval)=>{
  const f=setup(from,cadence,to,interval),p=await preview(f);
  expect(p).toMatchObject({effectiveAt:f.end,preview:null,quote:{dueNow:0,renewsAt:f.end,currency:'USD'}});
  expect(f.calls.filter(c=>c.method==='PATCH'&&!c.url.endsWith('/preview'))).toHaveLength(0);
  await expect(confirm(f,p)).resolves.toMatchObject({pending:true});
  expect(f.subscription.next_billed_at).toBe(f.renewal);expect(f.subscription.items[0].price_id).toBe(f.target);
  expect(f.calls.filter(c=>c.method==='PATCH'&&!c.url.endsWith('/preview')).map(c=>c.body)).toEqual([{items:[{price_id:f.target,quantity:1}],proration_billing_mode:'do_not_bill',on_payment_failure:'prevent_change'},...(cadence===interval?[]:[{next_billed_at:f.renewal,proration_billing_mode:'do_not_bill',on_payment_failure:'prevent_change'}])]);
  expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice')))).toMatchObject({plan:from,interval:cadence,periodEnd:f.end,pendingPlan:to,pendingInterval:interval});
  await expect(confirm(f,p)).rejects.toMatchObject({code:'PREVIEW_EXPIRED'});
 });
 it('recovers a failed second update without applying the item change twice',async()=>{
  const f=setup(),p=await preview(f);f.control.failDate=1;
  await expect(confirm(f,p)).rejects.toMatchObject({code:'BILLING_CHANGE_PENDING'});
  expect((await f.store.transaction(tx=>tx.get('billingChanges/alice')))?.stage).toBe('items-applied');expect(await f.store.list('billingNotices')).toHaveLength(0);
  await expect(billingAction(f.store,'alice',{action:'billing.change-plan',plan:'traveler',interval:'month',previewId:'other'})).rejects.toBeDefined();
  await expect(billingAction(f.store,'alice',{action:'billing.status'})).resolves.toMatchObject({changeProcessing:false,billing:{pendingPlan:'traveler',pendingInterval:'year'}});
  expect(f.subscription.next_billed_at).toBe(f.renewal);expect(await f.store.list('billingNotices')).toHaveLength(1);await billingAction(f.store,'alice',{action:'billing.status'});expect(await f.store.list('billingNotices')).toHaveLength(1);
  expect(f.calls.filter(c=>c.body?.items&&!c.url.endsWith('/preview'))).toHaveLength(1);
 });
 it('recovers when the provider applied the first update but its response was lost',async()=>{
  const f=setup(),p=await preview(f);f.control.loseFirstResponse=true;
  await expect(confirm(f,p)).rejects.toMatchObject({code:'BILLING_CHANGE_PENDING'});await resumeCadenceChange(f.store,'alice');
  expect(f.subscription.next_billed_at).toBe(f.renewal);expect(f.calls.filter(c=>c.body?.items&&!c.url.endsWith('/preview'))).toHaveLength(1);
 });
 it('does not grant the new tier from subscription updates alone',async()=>{
  const f=setup(),p=await preview(f);await confirm(f,p);
  await applyBillingEvent(f.store,{event_id:'evt_cadence',event_type:'subscription.updated',occurred_at:new Date().toISOString(),data:{id:'sub_test',custom_data:{uid:'alice',environment:'monetization-staging'},items:[{price_id:f.target,quantity:1}]}});
  expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice')))).toMatchObject({plan:'traveler',interval:'month',periodEnd:f.end});
 });
});
it('preserves the scheduled change when reconciliation repeats the last paid transaction under another event ID',async()=>{
 const f=setup(),p=await preview(f);await confirm(f,p);
 await f.store.transaction(async tx=>{const user=await tx.get('users/alice');tx.set('users/alice',{...user,billing:{...(user!.billing as any),lastPaidTransactionId:'txn_original'}});});
 await applyBillingEvent(f.store,{event_id:'evt_repeated',event_type:'transaction.completed',occurred_at:new Date().toISOString(),data:{id:'txn_original',subscription_id:'sub_test',custom_data:{uid:'alice',environment:'monetization-staging'},items:[{price_id:f.source,quantity:1}],billing_period:{ends_at:f.renewal}}});
 expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice')))).toMatchObject({plan:'traveler',interval:'month',pendingPlan:'traveler',pendingInterval:'year'});
});
it('queues cancellation only after the provider accepts it, preserving paid access until expiry',async()=>{
 const f=setup();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({data:{scheduled_change:{action:'cancel'}}})})));
 const p=await billingAction(f.store,'alice',{action:'billing.preview-change',plan:'tourist',interval:'year'});
 await billingAction(f.store,'alice',{action:'billing.change-plan',plan:'tourist',interval:'year',previewId:p.previewId});
 expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice')))).toMatchObject({plan:'traveler',interval:'month',periodEnd:f.end,pendingPlan:'tourist',pendingInterval:null});
 expect(await f.store.list('billingNotices')).toEqual([expect.objectContaining({kind:'scheduled-change',plan:'tourist',previousPlan:'traveler',effectiveAt:f.end})]);
});
