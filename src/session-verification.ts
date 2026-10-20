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
 const generation=useRef(0);
 useEffect(()=>{
  let live=true;
  const check=()=>{
   const user=auth?.currentUser,request=++generation.current;
   if(!user){setIdentity({key:null,accountId:null,verified:null});return;}
   const key=keyFor(user);
   setIdentity(current=>({key,accountId:user.uid,verified:cache.has(key)?true:current.key===key?current.verified:null}));
   void cache.check(key,async()=>{
    const verified=await startSession(user.uid);
    if(verified&&!user.emailVerified)await user.getIdToken(true);
    return verified;
   }).then(verified=>{if(live&&generation.current===request)setIdentity({key,accountId:user.uid,verified});})
   .catch(()=>{if(live&&generation.current===request)setIdentity({key,accountId:user.uid,verified:false});});
  };
  const stop=auth?observeAuthSession(check):()=>{};
  const refresh=()=>{const user=auth?.currentUser;if(user&&!cache.has(keyFor(user)))cache.invalidate(keyFor(user));check();};
  window.addEventListener('journas-email-confirmed',refresh);
  return()=>{live=false;stop();window.removeEventListener('journas-email-confirmed',refresh);};
 },[]);
 return {...identity,confirm:()=>{const user=auth?.currentUser;if(user){++generation.current;cache.confirm(keyFor(user));setIdentity({key:keyFor(user),accountId:user.uid,verified:true});}}};
}
