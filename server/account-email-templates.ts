import {verificationTemplate} from './verification-template.js';
export const accountEmailCategories=['verification','passwordReset','emailChange','emailChangeConfirmation','multiFactor'] as const;
export type AccountEmailCategory=typeof accountEmailCategories[number];
const copy:Record<AccountEmailCategory,{label:string;title:string;message:string;button:string;notice:string;subject:string}>={
 verification:{label:'ACCOUNT EMAIL VERIFICATION',title:'Verify your email address.',message:'Confirm this email address for your Journas account.',button:'Verify my email',notice:'If you did not create a Journas account or request this email, you can safely ignore it.',subject:'Verify your email for Journas'},
 passwordReset:{label:'ACCOUNT PASSWORD RESET',title:'Reset your password.',message:'We received a request to reset the password for your Journas account (%EMAIL%). Choose a new password using the button below.',button:'Reset my password',notice:'If you did not request a password reset, you can safely ignore this email. Your password will stay the same.',subject:'Reset your Journas password'},
 emailChange:{label:'ACCOUNT EMAIL CHANGE',title:'Your sign-in email has changed.',message:'The email address for your Journas account was changed to %NEW_EMAIL%. Future sign-ins and account emails will use that address.',button:'Undo email change',notice:'If you made this change, no action is needed. If you did not, use the button above to restore your previous email address, then reset your password.',subject:'Your Journas sign-in email has changed'},
 emailChangeConfirmation:{label:'CONFIRM YOUR NEW EMAIL',title:'Confirm your new email address.',message:'You requested to use this email address (%EMAIL%) for your Journas account. Confirm it below to complete the change.',button:'Confirm new email',notice:'Your current sign-in email will stay the same until you confirm. If you did not request this change, you can safely ignore this email.',subject:'Confirm your new email for Journas'},
 multiFactor:{label:'ACCOUNT SECURITY UPDATE',title:'Two-step verification was added.',message:'Your Journas account now has an additional sign-in factor: %SECOND_FACTOR%. This adds another check when you sign in.',button:'Remove this sign-in factor',notice:'If you added this sign-in factor, no action is needed. If you did not, use the button above to remove it, then reset your password and review your account security.',subject:'Two-step verification was added to your Journas account'},
};
/** Use the existing verification email as the visual source for every Firebase category. */
export function accountEmailTemplate(category:AccountEmailCategory){
 const base=copy.verification,target=copy[category];
 return verificationTemplate.replace(base.label,target.label).replace(base.title,target.title).replace(base.message,target.message).replace(base.button,target.button).replace(base.notice,target.notice).replace(/<p style="margin:16px 0 0;font-size:10px;color:#938aa4;">Verification request: %REQUEST_ID%<\/p>/,'');
}
export const accountEmailSubject=(category:AccountEmailCategory)=>copy[category].subject;
export const accountEmailSenderName='Journas Trip Planner';
