import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {billingStatus,isPlan,planIds,plans,type PlanId,type BillingStatus} from '../shared/plans.js';
import {ApiError,type Data,type Store} from './types.js';
import {assertStaging} from './staging.js';
import {retentionDeadline} from './entitlements.js';
const apiRoot='https://sandbox-api.paddle.com';
const billingRevision=(value:BillingStatus)=>[value.plan,value.interval,value.periodEnd,value.status].join(':');
function checkoutToken(){const token=process.env.PADDLE_CLIENT_TOKEN;if(!token?.startsWith('test_'))throw new ApiError(503,'BILLING_NOT_CONFIGURED','Paddle Sandbox checkout is not connected. Follow the setup guide.');return token;}
function price(plan:PlanId,interval:string){const id=process.env[`PADDLE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`];if(!id||!/^pri_[a-z0-9]+$/.test(id))throw new ApiError(503,'BILLING_NOT_CONFIGURED','Paddle Sandbox prices are not configured. Follow the setup guide.');return id;}
export function configuredPrices(){return planIds.filter(p=>p!=='tourist').flatMap(plan=>['month','year'].map(interval=>({plan,interval,id:process.env[`PADDLE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`]}))).filter(p=>p.id);}
async function paddle(path:string,method='GET',body?:unknown){
 assertStaging();const key=process.env.PADDLE_API_KEY;
 if(!key||!key.includes('_sdbx'))throw new ApiError(503,'BILLING_NOT_CONFIGURED','Paddle Sandbox is not connected. Follow the setup guide.');
 const response=await fetch(apiRoot+path,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new ApiError(502,'BILLING_UNAVAILABLE','Paddle could not complete the request. Your plan has not been changed.');return (await response.json()).data;
}
export async function refreshMemberships(store:Store,uid:string){await store.transaction(async tx=>{const user=await tx.get(`users/${uid}`);for(const ref of await tx.list(`users/${uid}/trips`)){const trip=await tx.get(`trips/${ref.id}`);if(trip){const cleanupAt=retentionDeadline(trip,user,Date.now());tx.set(`users/${uid}/trips/${ref.id}`,{...ref,cleanupAt});if(trip.ownerId===uid)tx.set(`trips/${trip.id}`,{...trip,ownerCleanupAt:cleanupAt});}}});}
export async function billingAction(store:Store,uid:string,input:Data){
 const user=await store.transaction(tx=>tx.get(`users/${uid}`)),billing=billingStatus(user),action=String(input.action);
 if(action==='billing.status')return {billing,entitlements:plans[billing.plan],configured:Boolean(process.env.PADDLE_API_KEY)&&Boolean(process.env.PADDLE_CLIENT_TOKEN?.startsWith('test_'))&&configuredPrices().length===4};
 if(billing.source==='test')throw new ApiError(409,'TEST_PLAN_FIXED','This account has a fixed test plan. Use a billing test account to test purchases.');
 if(action==='billing.checkout-config')return {token:checkoutToken(),environment:'sandbox'};
 if(action==='billing.portal'){
  const customerId=(user?.billing as Data)?.customerId;if(typeof customerId!=='string')throw new ApiError(409,'NO_SUBSCRIPTION','No subscription to manage');
  const session=await paddle(`/customers/${customerId}/portal-sessions`,'POST',{subscription_ids:billing.subscriptionId?[billing.subscriptionId]:[]});return {url:session.urls.general.overview};
 }
 if(!isPlan(input.plan)||!['month','year'].includes(String(input.interval)))throw new ApiError(400,'INVALID_PLAN','Choose a valid plan and billing interval');
 const plan=input.plan,interval=String(input.interval),url=process.env.STAGING_PUBLIC_URL;
 if(!url?.startsWith('https://')||new URL(url).hostname==='journas-trip-planner.vercel.app')throw new ApiError(503,'UNSAFE_ENVIRONMENT','Configure the isolated staging URL');
 if(action==='billing.checkout'){
  checkoutToken();
  if(billing.subscriptionId&&!['canceled','refunded'].includes(billing.status))throw new ApiError(409,'SUBSCRIPTION_EXISTS','Manage your existing subscription instead.');
  if(plan==='tourist')return {billing};
  const priceId=price(plan,interval),reservation=randomUUID();
  const previous=await store.transaction(async tx=>{const existing=await tx.get(`billingCheckouts/${uid}`);if(existing&&Number(existing.expiresAt)>Date.now()){if(existing.plan===plan&&existing.interval===interval&&existing.url)return existing;if(!existing.completed)throw new ApiError(409,'CHECKOUT_PENDING','A checkout is already being prepared. Please retry shortly.');}tx.set(`billingCheckouts/${uid}`,{id:reservation,uid,plan,interval,expiresAt:Date.now()+5*60000});return null;});
  if(previous?.url)return {url:previous.url,transactionId:previous.transactionId};
  try{const transaction=await paddle('/transactions','POST',{items:[{price_id:priceId,quantity:1}],custom_data:{uid,environment:'monetization-staging'},checkout:{url:`${url}/upgrade`}});
   await store.transaction(async tx=>{const current=await tx.get(`billingCheckouts/${uid}`);if(current?.id===reservation)tx.set(`billingCheckouts/${uid}`,{...current,url:transaction.checkout.url,transactionId:transaction.id});});return {url:transaction.checkout.url,transactionId:transaction.id};
  }catch(error){await store.transaction(async tx=>{const current=await tx.get(`billingCheckouts/${uid}`);if(current?.id===reservation)tx.delete(`billingCheckouts/${uid}`);});throw error;}
 }
 if(!billing.subscriptionId)throw new ApiError(409,'NO_SUBSCRIPTION','Subscribe before changing a plan');
 const cadenceChange=interval!==billing.interval;
 const immediate=planIds.indexOf(plan)>planIds.indexOf(billing.plan)&&!cadenceChange;
 const change=plan==='tourist'?{scheduled_change:{action:'cancel',effective_at:'next_billing_period'}}:{items:[{price_id:price(plan,interval),quantity:1}],proration_billing_mode:immediate?'prorated_immediately':cadenceChange?'do_not_bill':'full_next_billing_period',...(cadenceChange?{next_billed_at:new Date(Number(billing.periodEnd)).toISOString()}:{}),on_payment_failure:'prevent_change'};
 if(action==='billing.preview-change'){
  const preview=plan==='tourist'?null:await paddle(`/subscriptions/${billing.subscriptionId}/preview`,'PATCH',change);
  const id=randomUUID();await store.transaction(async tx=>{tx.set(`billingPreviews/${id}`,{uid,plan,interval,subscriptionId:billing.subscriptionId,revision:billingRevision(billing),immediate,expiresAt:Date.now()+5*60000,change});});
  return {previewId:id,preview,effectiveAt:immediate?'after successful payment':billing.periodEnd};
 }
 if(action==='billing.change-plan'){
  const preview=await store.transaction(async tx=>{
   const preview=await tx.get(`billingPreviews/${String(input.previewId)}`),current=billingStatus(await tx.get(`users/${uid}`)),lock=await tx.get(`billingChanges/${uid}`);
   if(!preview||preview.processing||preview.uid!==uid||preview.plan!==plan||preview.interval!==interval||preview.subscriptionId!==current.subscriptionId||preview.revision!==billingRevision(current)||Number(preview.expiresAt)<Date.now())throw new ApiError(409,'PREVIEW_EXPIRED','Preview the change again before confirming.');
   if(lock&&Number(lock.expiresAt)>Date.now())throw new ApiError(409,'BILLING_CHANGE_PENDING','A plan change is already processing. Please check your subscription before trying again.');
   tx.set(`billingPreviews/${String(input.previewId)}`,{...preview,processing:true});tx.set(`billingChanges/${uid}`,{previewId:input.previewId,expiresAt:Date.now()+5*60000});return preview;
  });
  if(plan==='tourist')await paddle(`/subscriptions/${billing.subscriptionId}/cancel`,'POST',{effective_from:'next_billing_period'});
  else await paddle(`/subscriptions/${billing.subscriptionId}`,'PATCH',preview.change);
  await store.transaction(async tx=>{const current=await tx.get(`users/${uid}`)??{};if(!preview.immediate)tx.set(`users/${uid}`,{...current,billing:{...(current.billing as Data),pendingPlan:plan,pendingInterval:interval}});tx.delete(`billingPreviews/${String(input.previewId)}`);tx.delete(`billingChanges/${uid}`);});
  return {pending:!immediate};
 }
 throw new ApiError(400,'UNKNOWN_ACTION','Unknown billing operation');
}
export function validSignature(raw:string,header:string,secret:string,now=Date.now()){
 const parts=header.split(';').map(part=>part.split('=')),ts=parts.find(([k])=>k==='ts')?.[1],hashes=parts.filter(([k])=>k==='h1').map(([,v])=>v);
 if(!ts||Math.abs(now/1000-Number(ts))>5)return false;
 const expected=createHmac('sha256',secret).update(`${ts}:${raw}`).digest();return hashes.some(hash=>{if(!/^[a-f0-9]{64}$/i.test(hash??''))return false;return timingSafeEqual(expected,Buffer.from(hash,'hex'));});
}
export async function applyBillingEvent(store:Store,event:Data){
 const type=String(event.event_type),data=event.data as Data,id=String(event.event_id??''),at=Date.parse(String(event.occurred_at));
 if(!/^evt_[a-z0-9]+$/.test(id)||!Number.isFinite(at)||!data)throw new ApiError(400,'INVALID_WEBHOOK','Invalid event');
 const custom=data.custom_data as Data|undefined;let uid=custom?.uid as string|undefined;
 if(!uid&&data.subscription_id)uid=(await store.transaction(tx=>tx.get(`billingSubscriptions/${data.subscription_id}`)))?.uid as string|undefined;
 if(!uid&&data.transaction_id)uid=(await store.transaction(tx=>tx.get(`billingTransactions/${data.transaction_id}`)))?.uid as string|undefined;
 if(!uid&&String(data.id).startsWith('sub_'))uid=(await store.transaction(tx=>tx.get(`billingSubscriptions/${data.id}`)))?.uid as string|undefined;
 if(!uid||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))return;
 if(custom&&custom.environment!=='monetization-staging')throw new ApiError(400,'INVALID_WEBHOOK','Wrong environment');
 await store.transaction(async tx=>{
  if(await tx.get(`billingEvents/${id}`))return;
  const user=await tx.get(`users/${uid}`)??{},stored=user.billing as Data??{},paid=stored.paidChange as Data|undefined;
  const old=paid&&Number(paid.startsAt)<=Date.now()?{...stored,...billingStatus(user)}:stored;
  if(old.source==='test'){tx.set(`billingEvents/${id}`,{id,at,ignored:true});return;}
  const clock=type.startsWith('subscription.')?'subscriptionEventAt':type.startsWith('transaction.')?'transactionEventAt':'adjustmentEventAt';
  const subscription=type.startsWith('subscription.')?data.id:data.subscription_id;
  const mismatchedSubscription=subscription&&old.subscriptionId&&old.subscriptionId!==subscription&&Number(old.periodEnd)>Date.now();
  if(Number(old[clock]??0)>at||mismatchedSubscription||type==='transaction.completed'&&Number(old.canceledAt??0)>=at){tx.set(`billingEvents/${id}`,{id,at,ignored:true});return;}
  let next:Data={...old};
  const items=data.items as Data[]|undefined,matched=configuredPrices().find(p=>items?.some(item=>(item.price as Data)?.id===p.id||item.price_id===p.id));
  if(type.startsWith('subscription.')){
   next={...next,subscriptionId:data.id,customerId:data.customer_id,eventAt:at};tx.set(`billingSubscriptions/${data.id}`,{uid});
   if(type==='subscription.canceled')next={...next,plan:'tourist',source:'free',status:'canceled',periodEnd:0,downgradedAt:Date.now(),pendingPlan:null,paidChange:null,canceledAt:at};
   else if(type==='subscription.past_due')next={...next,status:'past_due',graceUntil:Number(old.periodEnd??at)+7*86400000};
   if((data.scheduled_change as Data|undefined)?.action==='cancel')next={...next,pendingPlan:'tourist',pendingInterval:null};
   // Subscription events alone never grant a new paid entitlement.
  }
  if(type==='transaction.completed'&&data.subscription_id&&matched){
   const period=data.billing_period as Data|undefined,end=Date.parse(String(period?.ends_at??''));
   if(!Number.isFinite(end))throw new ApiError(400,'INVALID_WEBHOOK','Missing paid period');
   const pending=isPlan(old.pendingPlan)?old.pendingPlan:null,start=Date.parse(String(period?.starts_at??''));
   const delayed=Number(old.periodEnd)>Date.now()&&pending===matched.plan&&end>Number(old.periodEnd)&&(!Number.isFinite(start)||start>=Number(old.periodEnd));
   next={...next,source:'sandbox',status:'active',plan:delayed?old.plan:matched.plan,interval:delayed?old.interval:matched.interval,subscriptionId:data.subscription_id,customerId:data.customer_id,periodEnd:delayed?old.periodEnd:end,pendingPlan:delayed?pending:null,pendingInterval:delayed?matched.interval:null,paidChange:delayed?{plan:matched.plan,interval:matched.interval,startsAt:Number(old.periodEnd),periodEnd:end}:null,eventAt:at,changedAt:Date.now(),lastPaidTransactionId:data.id,...(!delayed&&old.plan&&planIds.indexOf(matched.plan)<planIds.indexOf(old.plan as PlanId)?{downgradedAt:Date.now()}:{})};
   tx.set(`billingSubscriptions/${data.subscription_id}`,{uid});
   if(data.id)tx.set(`billingTransactions/${data.id}`,{uid,subscriptionId:data.subscription_id});
   tx.delete(`billingCheckouts/${uid}`);
  }
  if(type==='adjustment.updated'&&data.status==='approved'&&data.action==='refund'&&data.type==='full'&&data.transaction_id===old.lastPaidTransactionId)next={...next,source:'free',plan:'tourist',status:'refunded',periodEnd:0,paidChange:null,downgradedAt:Date.now(),canceledAt:at};
  tx.set(`users/${uid}`,{...user,billing:{...next,[clock]:at}});tx.set(`billingEvents/${id}`,{id,at,uid});
 });
 await refreshMemberships(store,uid);
}
export async function reconcileBilling(store:Store){
 if(!process.env.PADDLE_API_KEY)return {checked:0,configured:false};
 let checked=0;
 for(const user of await store.list('users',100)){
  const state=user.billing as Data|undefined;if(state?.source!=='sandbox'||!state.subscriptionId||typeof user.id!=='string')continue;
  const subscription=await paddle(`/subscriptions/${state.subscriptionId}`),uid=user.id;
  const event={event_id:`evt_reconcile${createHmac('sha256','reconcile').update(`${state.subscriptionId}:${subscription.updated_at}`).digest('hex').slice(0,26)}`,event_type:`subscription.${subscription.status==='canceled'?'canceled':subscription.status==='past_due'?'past_due':'updated'}`,occurred_at:subscription.updated_at,data:{...subscription,custom_data:{uid,environment:'monetization-staging'}}};
  await applyBillingEvent(store,event);
  const transactions=await paddle(`/transactions?subscription_id=${state.subscriptionId}&status=completed&order_by=created_at[DESC]&per_page=1`);
  for(const transaction of transactions??[])await applyBillingEvent(store,{event_id:`evt_reconcile${String(transaction.id).replace(/^txn_/,'')}`,event_type:'transaction.completed',occurred_at:transaction.updated_at,data:{...transaction,custom_data:{uid,environment:'monetization-staging'}}});
  checked++;
 }
 return {checked,configured:true};
}
