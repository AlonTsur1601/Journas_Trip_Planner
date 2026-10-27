import {describe,it,expect,vi,afterEach} from 'vitest';
import {billingMailContent,billingNotices} from '../server/billing-mail';
import {applyBillingEvent} from '../server/billing';
import {PracticeStore} from '../server/practice';
describe('billing management emails',()=>{
 afterEach(()=>vi.unstubAllEnvs());
 it('queues one management message per paid transaction despite webhook retries',async()=>{
  vi.stubEnv('PADDLE_PRICE_ADVENTURER_MONTH','pri_adventure');
  const store=new PracticeStore([['users/alice',{id:'alice',verifiedEmail:'alice@example.com'}]]);
  const event={event_id:'evt_paidonce',event_type:'transaction.completed',occurred_at:new Date().toISOString(),data:{id:'txn_paid',subscription_id:'sub_paid',customer_id:'ctm_alice',custom_data:{uid:'alice',environment:'monetization-staging'},items:[{price:{id:'pri_adventure'}}],billing_period:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+2592000000).toISOString()}}};
  await applyBillingEvent(store,event);await applyBillingEvent(store,event);await applyBillingEvent(store,{...event,event_id:'evt_duplicate'});
  expect(await store.list('billingNotices')).toHaveLength(1);expect((await store.list('billingNotices'))[0]).toMatchObject({id:'txn_paid',plan:'adventurer',status:'pending'});
 });
 it('offers cancellation for both paid plans and a separate downgrade only for adventurer',()=>{
  for(const plan of ['traveler','adventurer']){const c=billingMailContent(plan);expect(c.html).toContain('/upgrade?manage=cancel');expect(c.html).toContain('Cancel future payments');expect(c.html.includes('/upgrade?manage=downgrade')).toBe(plan==='adventurer');expect(c.text).toContain('confirm');}
 });
 it('keeps failed sends pending, retries, then does not send a successful receipt twice',async()=>{
  const store=new PracticeStore([['billingNotices/txn_a',{id:'txn_a',uid:'alice',plan:'adventurer',status:'pending'}]]);let attempts=0;
  const mail={enabled:true,email:async()=> 'alice@example.com',send:async()=>{attempts++;if(attempts===1)throw Error('SMTP unavailable');}};
  expect(await billingNotices(store,mail)).toEqual({sent:0});expect((await store.list('billingNotices'))[0].status).toBe('pending');
  expect(await billingNotices(store,mail)).toEqual({sent:1});expect(await billingNotices(store,mail)).toEqual({sent:0});expect(attempts).toBe(2);
 });
 it('does not email disposable test accounts or deliver while SMTP is disconnected',async()=>{
  const store=new PracticeStore([['billingNotices/txn_a',{id:'txn_a',uid:'alice',plan:'traveler',status:'pending'}]]);let attempts=0;
  const mail={enabled:false,email:async()=> 'billing@journas.test',send:async()=>{attempts++;}};
  await billingNotices(store,mail);expect((await store.list('billingNotices'))[0].status).toBe('pending');
  await billingNotices(store,{...mail,enabled:true});expect((await store.list('billingNotices'))[0].status).toBe('test-only');expect(attempts).toBe(0);
 });
});
