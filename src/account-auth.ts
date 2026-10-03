import {EmailAuthProvider,GoogleAuthProvider,linkWithCredential,linkWithPopup,reauthenticateWithCredential,reauthenticateWithPopup,updatePassword,verifyBeforeUpdateEmail,type User} from 'firebase/auth';
export const linkGoogleAccount=(user:User)=>linkWithPopup(user,new GoogleAuthProvider());
export async function linkPasswordAccount(user:User,email:string,password:string){
 try{return await linkWithCredential(user,EmailAuthProvider.credential(email,password));}
 catch(error){
  // Some Auth implementations reject linking the account's own existing email.
  // Setting a password on that same user retains its UID and Google provider.
  if((error as {code?:string}).code!=='auth/email-already-in-use'||email.trim().toLowerCase()!==user.email?.toLowerCase()||user.providerData.some(p=>p.providerId==='password'))throw error;
  await updatePassword(user,password);await user.reload();return {user};
 }
}
export async function confirmAccountIdentity(user:User,currentPassword:string){
 if(user.providerData.some(p=>p.providerId==='password'))return reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email!,currentPassword));
 return reauthenticateWithPopup(user,new GoogleAuthProvider());
}
export async function changeAccountEmail(user:User,email:string,currentPassword:string){await confirmAccountIdentity(user,currentPassword);await verifyBeforeUpdateEmail(user,email);}
export async function changeAccountPassword(user:User,password:string,currentPassword:string){await confirmAccountIdentity(user,currentPassword);await updatePassword(user,password);}
