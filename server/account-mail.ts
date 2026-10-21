import nodemailer from 'nodemailer';
import {ApiError} from './types.js';
import {accountEmailSenderName} from './account-email-templates.js';
export function accountMailTransport(){
 const host=process.env.SMTP_HOST,user=process.env.SMTP_USER,password=process.env.SMTP_PASSWORD;
 if(!host||!user||!password)throw new ApiError(503,'EMAIL_NOT_CONFIGURED','Email delivery is not configured.');
 return {sender:user,transport:nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT??465),secure:process.env.SMTP_SECURE!=='false',auth:{user,pass:password.replace(/\s/g,'')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000})};
}
export async function deliverAccountMail(to:string,subject:string,html:string,text:string){
 const{sender,transport}=accountMailTransport();
 const result=await transport.sendMail({from:{name:accountEmailSenderName,address:sender},replyTo:sender,envelope:{from:sender,to},to,subject,html,text,disableFileAccess:true,disableUrlAccess:true});
 if(!result.accepted?.length)throw new Error('Email rejected');
}
