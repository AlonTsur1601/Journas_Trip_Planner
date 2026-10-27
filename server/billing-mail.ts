import {randomUUID} from 'node:crypto';
import type {Store} from './types.js';
import {adminAuth} from './store.js';
import {deliverAccountMail} from './account-mail.js';

const origin='https://journas-monetization-staging.vercel.app';
export function billingMailContent(plan:string){
 const cancel=`${origin}/upgrade?manage=cancel`,downgrade=`${origin}/upgrade?manage=downgrade`;
 const button=(url:string,label:string)=>`<a href="${url}" style="display:inline-block;margin:8px 12px 8px 0;padding:12px 18px;border-radius:5px;background:#7c5ce7;color:#fff;text-decoration:none">${label}</a>`;
 return {subject:'Journas: manage your subscription payment',html:`<h1>Your Journas payment</h1><p>Paddle sends your payment receipt separately. Manage future charges below. Changes require sign-in and confirmation; opening a link never cancels a subscription.</p>${button(cancel,'Cancel future payments')}${plan==='adventurer'?button(downgrade,'Switch to traveler'):''}<p>Your paid access continues until the end of the paid period. This is the isolated Sandbox environment.</p>`,text:`Paddle sends your receipt separately. Cancel future payments: ${cancel}${plan==='adventurer'?`\nSwitch to traveler: ${downgrade}`:''}\nSign in and confirm the change. Your paid access continues until the end of the paid period. Sandbox only.`};
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
  try{const email=await mail.email(String(notice.uid));if(email?.endsWith('.test'))status='test-only';else if(email){await mail.send(email,billingMailContent(String(notice.plan)));status='sent';sent++;}}catch{/* Preserve the queue for retry. */}
  await store.transaction(async tx=>{const current=await tx.get(path);if(current?.leaseToken===token)tx.set(path,{...current,status,leaseUntil:0,leaseToken:null,...(status==='sent'?{sentAt:now}:{})});});
 }
 return {sent};
}
