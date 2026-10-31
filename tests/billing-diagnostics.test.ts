import {afterEach,it,expect,vi} from 'vitest';
import {billingAction} from '../server/billing';
import {PracticeStore} from '../server/practice';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('retains Paddle error evidence without exposing server credentials or email',async()=>{
 for(const [name,value] of Object.entries({JOURNAS_ENV:'monetization-staging',FIREBASE_PROJECT_ID:'journas-monetization-2026',BILLING_ENV:'sandbox',ADS_MODE:'mock',STAGING_PUBLIC_URL:'https://journas-monetization-staging.vercel.app',PADDLE_API_KEY:'unit_sdbx_fakecredential',PADDLE_PRICE_TRAVELER_YEAR:'pri_year'}))vi.stubEnv(name,value);
 const log=vi.spyOn(console,'warn').mockImplementation(()=>{});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:400,json:async()=>({error:{code:'bad_request',detail:'invalid unit_sdbx_fakecredential user@example.com'},meta:{request_id:'request-123'}})})));
 const store=new PracticeStore([['users/alice',{billing:{source:'sandbox',status:'active',plan:'traveler',interval:'month',periodEnd:Date.now()+86400000,subscriptionId:'sub_test'}}]]);
 await expect(billingAction(store,'alice',{action:'billing.preview-change',plan:'traveler',interval:'year'})).rejects.toMatchObject({code:'BILLING_UNAVAILABLE',details:{status:400,providerCode:'bad_request',requestId:'request-123',reason:'invalid [redacted] [email]'}});
 expect(JSON.stringify(log.mock.calls)).not.toContain('unit_sdbx_fakecredential');expect(JSON.stringify(log.mock.calls)).not.toContain('user@example.com');
 expect((await store.transaction(tx=>tx.get('users/alice')))!.billing).toMatchObject({plan:'traveler',interval:'month'});
});
it('blocks an annual preview that grants a free year and refuses legacy unvalidated confirmations',async()=>{
 for(const [name,value] of Object.entries({JOURNAS_ENV:'monetization-staging',FIREBASE_PROJECT_ID:'journas-monetization-2026',BILLING_ENV:'sandbox',ADS_MODE:'mock',STAGING_PUBLIC_URL:'https://journas-monetization-staging.vercel.app',PADDLE_API_KEY:'unit_sdbx_fakecredential',PADDLE_PRICE_TRAVELER_YEAR:'pri_year'}))vi.stubEnv(name,value);
 const end=Date.now()+30*86400000,late=Date.now()+365*86400000;
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>({data:{next_billed_at:new Date(late).toISOString(),next_transaction:{billing_period:{starts_at:new Date(late).toISOString()}},immediate_transaction:null}})}));vi.stubGlobal('fetch',fetcher);
 const store=new PracticeStore([['users/alice',{billing:{source:'sandbox',status:'active',plan:'traveler',interval:'month',periodEnd:end,subscriptionId:'sub_test'}}],['billingPreviews/legacy',{uid:'alice',plan:'traveler',interval:'year',subscriptionId:'sub_test',revision:['traveler','month',end,'active'].join(':'),expiresAt:Date.now()+60000,change:{items:[]}}]]);
 await expect(billingAction(store,'alice',{action:'billing.preview-change',plan:'traveler',interval:'year'})).rejects.toMatchObject({code:'BILLING_SCHEDULE_MISMATCH'});
 await expect(billingAction(store,'alice',{action:'billing.change-plan',plan:'traveler',interval:'year',previewId:'legacy'})).rejects.toMatchObject({code:'PREVIEW_EXPIRED'});
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect((await store.transaction(tx=>tx.get('users/alice')))!.billing).toMatchObject({plan:'traveler',interval:'month',periodEnd:end});
});
