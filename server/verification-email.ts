import nodemailer from 'nodemailer';
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
 if(user.emailVerified)return {alreadyVerified:true};
 if(!user.email||user.disabled)throw new ApiError(400,'EMAIL_UNAVAILABLE','This account cannot receive a verification email.');
 const host=process.env.SMTP_HOST,userName=process.env.SMTP_USER,password=process.env.SMTP_PASSWORD;
 if(!host||!userName||!password)throw new ApiError(503,'EMAIL_NOT_CONFIGURED','Email delivery is not configured.');
 const attempt=randomUUID(),path=`rateLimits/verification_${uid}`,store=firestoreStore();
 await store.transaction(async tx=>{const last=await tx.get(path);const remaining=Number(last?.nextAttemptAt??0)-Date.now();if(remaining>0)throw new ApiError(429,'EMAIL_RATE_LIMIT','Please wait before resending.',{retryAfter:Math.ceil(remaining/1000)});tx.set(path,{attempt,nextAttemptAt:Date.now()+30000,expiresAt:Date.now()+86400000});});
 try{
  const link=verificationActionLink(await adminAuth().generateEmailVerificationLink(user.email,{url:siteUrl}),returnClientId);
  const transport=nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT??465),secure:process.env.SMTP_SECURE!=='false',auth:{user:userName,pass:password.replace(/\s/g,'')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
  const result=await transport.sendMail({from:{name:'Journas Trip Planner',address:userName},replyTo:userName,envelope:{from:userName,to:user.email},to:user.email,subject:`Verify your email for Journas — ${attempt.slice(0,8)}`,html:verificationContent(link,attempt),text:`Confirm your email address for Journas:\n\n${link}\n\nIf you did not request this email, you can ignore it.\n\nThe Journas team\nRequest: ${attempt}`,disableFileAccess:true,disableUrlAccess:true});
  if(!result.accepted?.length)throw new Error('Email rejected');
  return {sent:true};
 }catch{
  await store.transaction(async tx=>{const current=await tx.get(path);if(current?.attempt===attempt)tx.delete(path);});
  throw new ApiError(503,'EMAIL_DELIVERY_FAILED','Unable to send the email. Please try again.');
 }
}
