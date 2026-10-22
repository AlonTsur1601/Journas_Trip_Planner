import nodemailer from 'nodemailer';
import {ApiError} from './types.js';
import {accountEmailSenderName} from './account-email-templates.js';
export const accountEmailSenderAddress='journas.app@gmail.com';
export function accountMailTransport(){
 const provider=process.env.ACCOUNT_MAIL_PROVIDER??'gmail';
 const brevo=provider==='brevo';
 const host=brevo?'smtp-relay.brevo.com':process.env.SMTP_HOST,user=brevo?process.env.BREVO_SMTP_USER:process.env.SMTP_USER,password=brevo?process.env.BREVO_SMTP_KEY:process.env.SMTP_PASSWORD;
 if(!['gmail','brevo'].includes(provider)||!host||!user||!password||(!brevo&&user.trim().toLowerCase()!==accountEmailSenderAddress))throw new ApiError(503,'EMAIL_NOT_CONFIGURED','Email delivery is not configured.');
 return {sender:accountEmailSenderAddress,transport:nodemailer.createTransport({host,port:brevo?465:Number(process.env.SMTP_PORT??465),secure:brevo||process.env.SMTP_SECURE!=='false',auth:{user,pass:brevo?password.trim():password.replace(/\s/g,'')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000})};
}
export async function deliverAccountMail(to:string,subject:string,html:string|undefined,text:string){
 const{sender,transport}=accountMailTransport();
 const result=await transport.sendMail({from:{name:accountEmailSenderName,address:sender},replyTo:sender,envelope:{from:sender,to},to,subject,html,text,disableFileAccess:true,disableUrlAccess:true});
 if(!result.accepted?.length)throw new Error('Email rejected');
}
