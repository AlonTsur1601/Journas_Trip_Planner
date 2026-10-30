import {useEffect,useRef,useState} from 'react';
import {type User} from 'firebase/auth';
import {auth,observeAuthSession} from './firebase';
import {startSession} from './startup';
import {VerificationCache} from './verification-cache';
const cache=new VerificationCache();
const keyFor=(user:User)=>`${user.uid}:${user.email?.toLowerCase()??''}`;
/** Share confirmed identity across screen remounts until the page is closed. */
export function useSessionVerification(){
 const [identity,setIdentity]=useState(()=>{const user=auth?.currentUser;return {key:user?keyFor(user):null,accountId:user?.uid??null,verified:user&&cache.has(keyFor(user))?true:null as boolean|null};});
 const [error,setError]=useState(false);
 const generation=useRef(0);
 useEffect(()=>{
  let live=true;
  const check=()=>{
   const user=auth?.currentUser,request=++generation.current;setError(false);
   if(!user){setIdentity({key:null,accountId:null,verified:null});return;}
   const key=keyFor(user);
   setIdentity(current=>({key,accountId:user.uid,verified:cache.has(key)?true:current.key===key?current.verified:null}));
   void cache.check(key,async()=>{
    const verified=await startSession(user.uid);
    if(verified&&!user.emailVerified)await user.getIdToken(true);
    return verified;
   }).then(verified=>{if(live&&generation.current===request)setIdentity({key,accountId:user.uid,verified});})
   .catch(()=>{if(live&&generation.current===request){cache.invalidate(key);setError(true);}});
  };
  let observedKey:string|null|undefined;
  const stop=auth?observeAuthSession(()=>{const user=auth?.currentUser,key=user?keyFor(user):null;if(observedKey===key)return;observedKey=key;check();}):()=>{};
  const refresh=()=>{const user=auth?.currentUser;if(user&&!cache.has(keyFor(user)))cache.invalidate(keyFor(user));check();};
  window.addEventListener('journas-email-confirmed',refresh);
  return()=>{live=false;stop();window.removeEventListener('journas-email-confirmed',refresh);};
 },[]);
 return {...identity,error,retry:()=>window.dispatchEvent(new Event('journas-email-confirmed')),confirm:()=>{const user=auth?.currentUser;if(user){++generation.current;cache.confirm(keyFor(user));setIdentity({key:keyFor(user),accountId:user.uid,verified:true});}}};
}
