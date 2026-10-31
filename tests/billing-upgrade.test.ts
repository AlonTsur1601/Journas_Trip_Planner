import {afterEach,describe,it,expect,vi} from 'vitest';
import {billingAction,applyBillingEvent} from '../server/billing';
import {billingStatus} from '../shared/plans';
import {PracticeStore} from '../server/practice';
import {upgradeMailContent} from '../server/billing-mail';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(interval='month'){
 const end=Date.now()+30*86400000,target='pri_adventure'+interval;
 for(const [key,value]of Object.entries({JOURNAS_ENV:'monetization-staging',FIREBASE_PROJECT_ID:'journas-monetization-2026',BILLING_ENV:'sandbox',ADS_MODE:'mock',STAGING_PUBLIC_URL:'https://journas-monetization-staging.vercel.app',PADDLE_API_KEY:'unit_sdbx_mock',['PADDLE_PRICE_ADVENTURER_'+interval.toUpperCase()]:target}))vi.stubEnv(key,value);
 const store=new PracticeStore([['users/alice',{billing:{source:'sandbox',status:'active',plan:'traveler',interval:'month',periodEnd:end,subscriptionId:'sub_test'}}]]);
 const calls:any[]=[],control={decline:false,complete:false,loseResponse:false};
 const paid={id:'txn_upgrade',updated_at:new Date().toISOString(),subscription_id:'sub_test',items:[{price_id:target,quantity:1}],billing_period:{starts_at:new Date().toISOString(),ends_at:new Date(end).toISOString()}};
 vi.spyOn(console,'warn').mockImplementation(()=>{});
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:any={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,body,method:options.method??'GET'});
  if(url.includes('/transactions?'))return {ok:true,json:async()=>({data:control.complete?[paid]:[]})};
  if(url.endsWith('/preview'))return {ok:true,json:async()=>({data:{next_billed_at:new Date(end).toISOString(),immediate_transaction:{details:{totals:{grand_total:'500',currency_code:'USD'}}},recurring_transaction_details:{totals:{grand_total:interval==='year'?'9999':'999',currency_code:'USD'}}}})};
  expect(body.proration_billing_mode).toBe('prorated_immediately');expect(body.on_payment_failure).toBe('prevent_change');expect(body.next_billed_at).toBeUndefined();
  if(control.decline)return {ok:false,status:400,json:async()=>({error:{code:'payment_declined',detail:'Declined'}})};
  if(control.loseResponse)throw Error('Network response lost');
  return {ok:true,json:async()=>({data:{id:'sub_test'}})};
 }));
 return {store,calls,control,end,interval,paid};
}
async function preview(f:ReturnType<typeof setup>){return billingAction(f.store,'alice',{action:'billing.preview-change',plan:'adventurer',interval:f.interval});}
async function confirm(f:ReturnType<typeof setup>,p:any){return billingAction(f.store,'alice',{action:'billing.change-plan',plan:'adventurer',interval:f.interval,previewId:p.previewId});}
describe('immediate paid upgrades',()=>{
 it.each(['month','year'])('charges proration for a %s upgrade and waits for verified payment',async interval=>{
  const f=setup(interval),p=await preview(f);expect(p).toMatchObject({effectiveAt:'after successful payment',quote:{dueNow:500,immediate:true}});
  await expect(confirm(f,p)).resolves.toMatchObject({pending:false});
  expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice'))).plan).toBe('traveler');expect(await f.store.list('billingNotices')).toHaveLength(0);
  f.control.complete=true;const status:any=await billingAction(f.store,'alice',{action:'billing.status'});expect(status.billing).toMatchObject({plan:'adventurer',interval,pendingPlan:null});
  expect(await f.store.transaction(tx=>tx.get('billingChanges/alice'))).toBeUndefined();const notices=await f.store.list('billingNotices');expect(notices).toHaveLength(1);expect(notices[0].kind).toBe('paid-upgrade');
  expect(upgradeMailContent(notices[0]).text).toContain('Paddle has confirmed payment');expect(upgradeMailContent(notices[0]).subject).toContain('active');
 });
 it('does not grant access on a failed payment and releases a definitively rejected attempt',async()=>{
  const f=setup(),p=await preview(f);f.control.decline=true;await expect(confirm(f,p)).rejects.toMatchObject({code:'BILLING_UNAVAILABLE'});
  expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice'))).plan).toBe('traveler');expect(await f.store.transaction(tx=>tx.get('billingChanges/alice'))).toBeUndefined();expect(await f.store.list('billingNotices')).toHaveLength(0);
 });
 it('retains the lock after an ambiguous network failure and recovers payment without repeating the charge',async()=>{
  const f=setup(),p=await preview(f);f.control.loseResponse=true;await expect(confirm(f,p)).rejects.toThrow();f.control.complete=true;
  await billingAction(f.store,'alice',{action:'billing.status'});expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice'))).plan).toBe('adventurer');expect(f.calls.filter(c=>c.method==='PATCH'&&!c.url.endsWith('/preview'))).toHaveLength(1);
 });
 it('does not grant the upgrade on subscription.updated alone',async()=>{
  const f=setup(),p=await preview(f);await confirm(f,p);await applyBillingEvent(f.store,{event_id:'evt_subscriptiononly',event_type:'subscription.updated',occurred_at:new Date().toISOString(),data:{id:'sub_test',custom_data:{uid:'alice',environment:'monetization-staging'},items:f.paid.items}});
  expect(billingStatus(await f.store.transaction(tx=>tx.get('users/alice'))).plan).toBe('traveler');
 });
});
