import {createVerificationProof,verificationStatus,discardVerificationProof} from './verification-campaign.js';
import {accountMailTransport,deliverAccountMail} from './account-mail.js';
import {randomUUID} from 'node:crypto';
import {adminAuth,firestoreStore} from './store.js';
import {ApiError} from './types.js';
import {verificationTemplate} from './verification-template.js';

export const siteUrl='https://journas-trip-planner.vercel.app';
export function verificationContent(link:string,requestId:string){
 const safe=link.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return verificationTemplate.replaceAll('%LINK%',safe).replaceAll('%REQUEST_ID%',requestId);
}
export function verificationActionLink(firebaseLink:string,returnClientId?:unknown){
 const code=new URL(firebaseLink).searchParams.get('oobCode');
 if(!code)throw new Error('Verification link has no action code');
 const link=new URL('/verify-email',siteUrl);link.searchParams.set('oobCode',code);
 if(typeof returnClientId==='string'&&/^[a-zA-Z0-9-]{20,100}$/.test(returnClientId))link.searchParams.set('returnClientId',returnClientId);
 return link.toString();
}
export async function sendVerificationEmail(uid:string,returnClientId?:unknown){
 const user=await adminAuth().getUser(uid);
 if((await verificationStatus(uid)).verified)return {alreadyVerified:true};
 if(!user.email||user.disabled)throw new ApiError(400,'EMAIL_UNAVAILABLE','This account cannot receive a verification email.');
 accountMailTransport();
 const attempt=randomUUID(),path=`rateLimits/verification_${uid}`,store=firestoreStore();
 await store.transaction(async tx=>{const last=await tx.get(path);const remaining=Number(last?.nextAttemptAt??0)-Date.now();if(remaining>0)throw new ApiError(429,'EMAIL_RATE_LIMIT','Please wait before resending.',{retryAfter:Math.ceil(remaining/1000)});tx.set(path,{attempt,nextAttemptAt:Date.now()+30000,expiresAt:Date.now()+86400000});});
 let proof:string|undefined;
 try{
  proof=await createVerificationProof(uid,user.email);const target=new URL('/verify-email',siteUrl);target.searchParams.set('proof',proof);if(typeof returnClientId==='string'&&/^[a-zA-Z0-9-]{20,100}$/.test(returnClientId))target.searchParams.set('returnClientId',returnClientId);const link=target.toString();
  await deliverAccountMail(user.email,`Verify your email for Journas \u2014 ${attempt.slice(0,8)}`,verificationContent(link,attempt),`Confirm your email address for Journas:\n\n${link}\n\nIf you did not request this email, you can ignore it.\n\nThe Journas team\nRequest: ${attempt}`);
  return {sent:true};
 }catch{
  if(proof)await discardVerificationProof(proof);
  await store.transaction(async tx=>{const current=await tx.get(path);if(current?.attempt===attempt)tx.delete(path);});
  throw new ApiError(503,'EMAIL_DELIVERY_FAILED','Unable to send the email. Please try again.');
 }
}
