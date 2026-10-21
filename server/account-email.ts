import{createHash,randomUUID}from'node:crypto';
import{adminAuth,firestoreStore}from'./store.js';
import{ApiError}from'./types.js';
import{accountMailTransport,deliverAccountMail}from'./account-mail.js';
import{accountEmailTemplate,accountEmailSubject,type AccountEmailCategory}from'./account-email-templates.js';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&#39;');
export function accountEmailContent(category:AccountEmailCategory,link:string,email:string){return accountEmailTemplate(category).replace(/%LINK%|%EMAIL%/g,key=>escape(key==='%LINK%'?link:email));}
function emailAddress(value:unknown){if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value)||/[\r\n<>]/.test(value))throw new ApiError(400,'INVALID_EMAIL','Enter a valid email address.');return value.trim();}
async function reserve(keys:string[]){const attempt=randomUUID(),store=firestoreStore(),paths=keys.map(key=>`rateLimits/account_mail_${hash(key)}`);await store.transaction(async tx=>{const records=await Promise.all(paths.map(path=>tx.get(path)));const now=Date.now();if(records.some(record=>Number(record?.nextAttemptAt??0)>now))throw new ApiError(429,'EMAIL_RATE_LIMIT','Please wait before requesting another account email.');if(records.some(record=>Number(record?.windowStart??0)>now-3600000&&Number(record?.count??0)>=10))throw new ApiError(429,'EMAIL_RATE_LIMIT','Too many account email requests. Try again later.');paths.forEach((path,index)=>{const record=records[index],sameWindow=Number(record?.windowStart??0)>now-3600000;tx.set(path,{attempt,nextAttemptAt:now+30000,windowStart:sameWindow?record!.windowStart:now,count:sameWindow?Number(record?.count??0)+1:1,expiresAt:now+86400000});});});return async()=>{await store.transaction(async tx=>{const records=await Promise.all(paths.map(path=>tx.get(path)));paths.forEach((path,index)=>{if(records[index]?.attempt===attempt)tx.set(path,{...records[index],nextAttemptAt:0});});});};}
export async function sendPasswordReset(value:unknown,address:string){
 const email=emailAddress(value);accountMailTransport();const release=await reserve([`reset-ip:${address}`,`reset-email:${email.toLowerCase()}`]);
 try{const user=await adminAuth().getUserByEmail(email);if(user.disabled||!user.providerData.some(provider=>provider.providerId==='password'))return {sent:true};const link=await adminAuth().generatePasswordResetLink(email);await deliverAccountMail(email,accountEmailSubject('passwordReset'),accountEmailContent('passwordReset',link,email),`Reset your Journas password:\n\n${link}\n\nIf you did not request this, ignore this email. Your password will stay the same.\n\nThe Journas team`);return {sent:true};}
 catch(error){if((error as{code?:string}).code==='auth/user-not-found')return {sent:true};await release();throw new ApiError(503,'EMAIL_DELIVERY_FAILED','Unable to send the email. Please try again.');}
}
export async function sendEmailChange(uid:string,value:unknown,authTime:number){
 if(!Number.isFinite(authTime)||Date.now()/1000-authTime>300||authTime>Date.now()/1000+60)throw new ApiError(401,'auth/requires-recent-login','Confirm your identity again to change your email.');
 const email=emailAddress(value),user=await adminAuth().getUser(uid);if(!user.email||user.disabled)throw new ApiError(400,'EMAIL_UNAVAILABLE','This account cannot change its email.');
 if(email.toLowerCase()===user.email.toLowerCase())throw new ApiError(400,'INVALID_EMAIL','Enter a different email address.');
 accountMailTransport();const release=await reserve([`change-uid:${uid}`,`change-email:${email.toLowerCase()}`]);
 try{const link=await adminAuth().generateVerifyAndChangeEmailLink(user.email,email);await deliverAccountMail(email,accountEmailSubject('emailChangeConfirmation'),accountEmailContent('emailChangeConfirmation',link,email),`Verify your new email address for Journas:\n\n${link}\n\nYour sign-in email will stay the same until you verify the new address. If you did not request this, ignore this email.\n\nThe Journas team`);return {sent:true};}
 catch{await release();throw new ApiError(503,'EMAIL_DELIVERY_FAILED','Unable to send the email. Please try again.');}
}
