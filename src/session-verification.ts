import {useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {api,auth} from './firebase';
/** Verification is shared by the profile and its temporary practice view for this mounted session. */
export function useSessionVerification(){
 const [verified,setVerified]=useState<boolean|null>(null),[accountId,setAccountId]=useState<string|null>(null);
 const pending=useRef<{uid:string;promise:Promise<boolean>}|null>(null),currentUid=useRef<string|null>(null);
 useEffect(()=>{
  let live=true;
  const check=()=>{const user=auth?.currentUser;setAccountId(user?.uid??null);if(!user){currentUid.current=null;pending.current=null;setVerified(null);return;}
   if(currentUid.current!==user.uid){currentUid.current=user.uid;setVerified(null);}
   if(pending.current?.uid!==user.uid)pending.current={uid:user.uid,promise:api<{verified:boolean}>('auth.verification-status').then(async result=>{if(result.verified)await user.getIdToken(true);return result.verified;})};
   void pending.current.promise.then(value=>{if(live&&currentUid.current===user.uid)setVerified(value);}).catch(()=>{if(live&&currentUid.current===user.uid){pending.current=null;setVerified(false);}});
  };
  const stop=auth?onAuthStateChanged(auth,check):()=>{};
  const refresh=()=>{pending.current=null;check();};window.addEventListener('journas-email-confirmed',refresh);
  return()=>{live=false;stop();window.removeEventListener('journas-email-confirmed',refresh);};
 },[]);
 return {verified,accountId,confirm:()=>{const uid=auth?.currentUser?.uid;if(uid)pending.current={uid,promise:Promise.resolve(true)};setVerified(true);}};
}
