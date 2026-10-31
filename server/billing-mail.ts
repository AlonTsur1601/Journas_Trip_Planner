import {randomUUID} from 'node:crypto';
import type {Store,Data,Transaction} from './types.js';
import {adminAuth} from './store.js';
import {deliverAccountMail} from './account-mail.js';

const origin='https://journas-monetization-staging.vercel.app';
function subscriptionLinks(plan:string){
 const cancel=`${origin}/upgrade?manage=cancel`,downgrade=`${origin}/upgrade?manage=downgrade`;
 const button=(url:string,label:string)=>`<a href="${url}" style="display:inline-block;margin:8px 12px 8px 0;padding:12px 18px;border-radius:5px;background:#7c5ce7;color:#fff;text-decoration:none">${label}</a>`;
 return {html:`${button(cancel,'Cancel future payments')}${plan==='adventurer'?button(downgrade,'Switch to traveler'):''}`,text:`Cancel future payments: ${cancel}${plan==='adventurer'?`\nSwitch to traveler: ${downgrade}`:''}`};
}
export function billingMailContent(plan:string){
 const links=subscriptionLinks(plan),timing='Upgrades start after successful payment of the prorated difference. Downgrades, cancellations and billing-period-only changes take effect at the end of the paid period.';
 return {subject:'Journas: manage your subscription payment',html:`<h1>Your Journas payment</h1><p>Paddle sends your payment receipt separately. Manage future charges below. Changes require sign-in and confirmation; opening a link never cancels a subscription.</p>${links.html}<p>${timing} This is the isolated Sandbox environment.</p>`,text:`Paddle sends your receipt separately. ${links.text}\nSign in and confirm the change. ${timing} Sandbox only.`};
}
export async function queueChangeNotice(tx:Transaction,uid:string,id:string,billing:Data,plan:string,interval:string,quote?:Data){
 const path=`billingNotices/change_${id}`;if(await tx.get(path))return;
 tx.set(path,{id:`change_${id}`,uid,kind:'scheduled-change',plan,interval,previousPlan:billing.plan,previousInterval:billing.interval,effectiveAt:billing.periodEnd,keepCurrent:plan===billing.plan&&interval===billing.interval,...(quote?{nextTotal:quote.nextTotal,currency:quote.currency}:{}),status:'pending',createdAt:Date.now()});
}
export function changeMailContent(notice:Data){
 const plan=['tourist','traveler','adventurer'].includes(String(notice.plan))?String(notice.plan):'your selected plan';
 const previous=['tourist','traveler','adventurer'].includes(String(notice.previousPlan))?String(notice.previousPlan):'your current plan';
 const interval=notice.interval==='year'?'yearly':'monthly',previousInterval=notice.previousInterval==='year'?'yearly':'monthly';
 const at=Number(notice.effectiveAt),date=Number.isFinite(at)?new Intl.DateTimeFormat('en',{dateStyle:'long',timeStyle:'short',timeZone:'UTC'}).format(at)+' UTC':'the end of your paid period';
 const currency=typeof notice.currency==='string'&&/^[A-Z]{3}$/.test(notice.currency)?notice.currency:'USD';
 const amount=Number(notice.nextTotal),charge=Number.isFinite(amount)&&amount>=0?new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount/100):null;
 const title=notice.keepCurrent?'Your scheduled change was canceled':'Your subscription change is scheduled';
 const message=notice.keepCurrent?`Your current ${previous} plan stays unchanged.`:plan==='tourist'?`Your subscription will end on ${date}. You will move to tourist then; no further subscription payments are scheduled.`:`Your change to ${plan} with ${interval} billing takes effect on ${date}.`;
 const timing=notice.keepCurrent?'':`Until ${date}, your current ${previous} ${previousInterval} plan and its access stay active. Downgrades and billing-period-only changes take effect only at the end of the paid period.`;
 const payment=plan==='tourist'?'You were not charged for this change.':`You were not charged for this change. ${charge?`Your next payment is ${charge} on ${date}, then every ${notice.interval==='year'?'year':'month'}. Applicable taxes are based on the renewal details.`:'Your next payment is due at renewal.'}`;
 const base=subscriptionLinks(plan);
 return {subject:notice.keepCurrent?'Journas: scheduled change canceled':'Journas: subscription change scheduled',html:`<h1>${title}</h1><p>${message}</p><p>${timing}</p><p>${payment}</p>${base.html}<p>Sign in to manage your subscription. Opening a link never changes it. Sandbox only.</p>`,text:`${title}\n${message}\n${timing}\n${payment}\n${base.text}\nSign in to manage your subscription. Sandbox only.`};
}
export function upgradeMailContent(notice:Data){
 const base=billingMailContent(String(notice.plan)),plan=['traveler','adventurer'].includes(String(notice.plan))?String(notice.plan):'paid';
 const message=`Your ${plan} upgrade is active. Paddle has confirmed payment. Your new plan starts now; you do not need to wait until the previous paid period ends.`;
 return {subject:'Journas: your upgrade is active',html:`<h1>Your upgrade is active</h1><p>${message}</p>${base.html}`,text:`${message}\n${base.text}`};
}
type Delivery={enabled:boolean;email:(uid:string)=>Promise<string|undefined>;send:(email:string,content:ReturnType<typeof billingMailContent>)=>Promise<unknown>};
const delivery=():Delivery=>({enabled:Boolean(process.env.SMTP_HOST||process.env.BREVO_SMTP_KEY),email:async uid=>(await adminAuth().getUser(uid)).email,send:(email,c)=>deliverAccountMail(email,c.subject,c.html,c.text)});
export async function billingNotices(store:Store,mail=delivery(),now=Date.now()){
 if(!mail.enabled)return {sent:0};
 const pending=store.pendingBillingNotices?await store.pendingBillingNotices(100):(await store.list('billingNotices',10000)).filter(n=>n.status==='pending').slice(0,100);
 let sent=0;
 for(const snapshot of pending){
  const path=`billingNotices/${snapshot.id}`,token=randomUUID();
  const notice=await store.transaction(async tx=>{const n=await tx.get(path);if(!n||n.status!=='pending'||Number(n.leaseUntil??0)>now)return null;tx.set(path,{...n,leaseUntil:now+600000,leaseToken:token});return n;});
  if(!notice)continue;
  let status='pending';
  try{const email=await mail.email(String(notice.uid));if(email?.endsWith('.test'))status='test-only';else if(email){await mail.send(email,notice.kind==='scheduled-change'?changeMailContent(notice):notice.kind==='paid-upgrade'?upgradeMailContent(notice):billingMailContent(String(notice.plan)));status='sent';sent++;}}catch{/* Preserve the queue for retry. */}
  await store.transaction(async tx=>{const current=await tx.get(path);if(current?.leaseToken===token)tx.set(path,{...current,status,leaseUntil:0,leaseToken:null,...(status==='sent'?{sentAt:now}:{})});});
 }
 return {sent};
}
