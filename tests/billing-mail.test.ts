import {describe,it,expect,vi,afterEach} from 'vitest';
import {billingMailContent,billingNotices,changeMailContent} from '../server/billing-mail';
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

it('delivers a dated change confirmation with no immediate charge and the exact next amount',async()=>{
 const at=Date.parse('2026-11-30T16:34:26Z'),notice={id:'change_one',uid:'alice',kind:'scheduled-change',plan:'adventurer',interval:'year',previousPlan:'traveler',previousInterval:'month',effectiveAt:at,nextTotal:9999,currency:'USD',status:'pending'};
 const store=new PracticeStore([['billingNotices/change_one',notice]]),delivered:any[]=[];
 await billingNotices(store,{enabled:true,email:async()=> 'alice@example.com',send:async(email,content)=>{delivered.push(content);}});
 expect(delivered).toHaveLength(1);const mail=delivered[0];expect(mail.subject).toContain('scheduled');for(const part of ['adventurer','yearly','November 30, 2026','UTC','$99.99','traveler monthly','You were not charged','only at the end of the paid period'])expect(mail.text).toContain(part);
 expect(mail.html).toContain('Switch to traveler');
});
it('explains cancellation happens at the paid boundary with no future payments',()=>{
 const mail=changeMailContent({plan:'tourist',previousPlan:'adventurer',previousInterval:'year',effectiveAt:Date.parse('2026-11-30T16:34:26Z')});
 expect(mail.text).toContain('no further subscription payments');expect(mail.text).toContain('adventurer yearly');expect(mail.subject).toContain('scheduled');
});
it('distinguishes canceling a scheduled change from canceling the current subscription',()=>{
 const mail=changeMailContent({plan:'traveler',previousPlan:'traveler',previousInterval:'month',interval:'month',keepCurrent:true,effectiveAt:Date.parse('2026-11-30T16:34:26Z'),nextTotal:499,currency:'USD'});
 expect(mail.subject).toContain('scheduled change canceled');expect(mail.text).toContain('current traveler plan stays unchanged');expect(mail.text).toContain('$4.99');
});
