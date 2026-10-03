import {useState} from 'react';
import type {User} from 'firebase/auth';
import {linkGoogleAccount,linkPasswordAccount,changeAccountEmail,changeAccountPassword} from './account-auth';

/** Provider linking preserves the existing UID and all its trip memberships. */
export function AccountCredentials({user,onMessage,onChanged}: {user:User;onMessage:(s:string)=>void;onChanged:()=>void}) {
 const [mode,setMode]=useState<'link'|'email'|'password'|null>(null);
 const [busy,setBusy]=useState(false);
 const providers=user.providerData.map(p=>p.providerId);
 const password=providers.includes('password'),google=providers.includes('google.com');
 const error=(e:any)=>onMessage(e.code==='auth/credential-already-in-use'||e.code==='auth/email-already-in-use'?'This sign-in method belongs to another account. Sign in to that account instead.':e.code==='auth/invalid-credential'?'The current password is incorrect.':e.code==='auth/popup-closed-by-user'?'Google sign-in was closed.':e.message);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const form=new FormData(e.currentTarget);setBusy(true);
  try{
   if(mode==='link'){await linkPasswordAccount(user,String(form.get('email')),String(form.get('newPassword')));onMessage('Email and password linked to your existing account.');}
   else{if(mode==='email'){await changeAccountEmail(user,String(form.get('email')),String(form.get('currentPassword')??''));onMessage('Check the new email address to confirm the change.');}else{await changeAccountPassword(user,String(form.get('newPassword')),String(form.get('currentPassword')??''));onMessage('Password updated.');}}
   await user.reload();onChanged();setMode(null);
  }catch(e){error(e);}finally{setBusy(false);}
 }
 return <section className="account-credentials"><h3>Sign-in methods</h3><p>{user.email}</p><div className="credential-methods"><span>Google {google?'— linked':''}</span>{!google&&<button type="button" className="button" disabled={busy} onClick={async()=>{setBusy(true);try{await linkGoogleAccount(user);await user.reload();onChanged();onMessage('Google linked to your existing account.');}catch(e){error(e);}finally{setBusy(false);}}}>Link Google</button>}</div><div className="credential-methods"><span>Email and password {password?'— linked':''}</span>{!password&&<button type="button" className="button" onClick={()=>setMode('link')}>Link email and password</button>}</div>{password&&<div className="credential-actions"><button type="button" className="button" onClick={()=>setMode('email')}>Change email</button><button type="button" className="button" onClick={()=>setMode('password')}>Change password</button></div>}{mode&&<form className="credential-form" onSubmit={submit}>{mode!=='password'&&<label className="field"><span>{mode==='link'?'Email address':'New email address'}</span><input type="email" name="email" required defaultValue={mode==='link'?user.email??'':''} autoComplete="email"/></label>}{mode!=='link'&&password&&<label className="field"><span>Current password</span><input type="password" name="currentPassword" required autoComplete="current-password"/></label>}{mode!=='email'&&<label className="field"><span>New password</span><input type="password" name="newPassword" required minLength={8} autoComplete="new-password"/></label>}<div className="credential-actions"><button type="button" className="button" onClick={()=>setMode(null)}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving…':mode==='link'?'Link sign-in method':'Save changes'}</button></div></form>}</section>;
}
