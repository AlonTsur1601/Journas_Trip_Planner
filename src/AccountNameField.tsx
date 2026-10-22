import {useEffect,useId,useState} from 'react';
import {api} from './firebase';
import {LoadingSpinner} from './LoadingScreen';
export function AccountNameField({value,onChange,onValidity,disabled=false,check=true,autoFocus=false}:{value:string;onChange:(value:string)=>void;onValidity:(valid:boolean)=>void;disabled?:boolean;check?:boolean;autoFocus?:boolean}){
 const id=useId();
 const [result,setResult]=useState<{value:string;state:'available'|'taken'|'error';message?:string}|null>(null);
 const nonempty=Boolean(value.trim()),pending=check&&nonempty&&result?.value!==value;
 const valid=!check||(nonempty&&!pending&&result?.state==='available');
 useEffect(()=>{onValidity(valid);},[valid,onValidity]);
 useEffect(()=>{
  if(!check||!nonempty)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{void api<{available:boolean}>('profile.name-availability',{name:value},controller.signal,true).then(({available})=>{if(!controller.signal.aborted)setResult({value,state:available?'available':'taken'});}).catch(error=>{if(!controller.signal.aborted)setResult({value,state:'error',message:error.message??'Unable to check availability. Try again.'});});},450);
  return()=>{clearTimeout(timer);controller.abort();};
 },[value,check,nonempty]);
 return <div className="account-name-field"><label className="field"><span>Account name</span><input autoFocus={autoFocus} autoComplete="nickname" required maxLength={80} value={value} onChange={e=>{setResult(null);onChange(e.target.value);}} disabled={disabled} aria-describedby={id} aria-invalid={check&&nonempty&&!pending&&result?.state==='taken'}/></label><div id={id} className="account-name-status" role="status" aria-live="polite">{check&&nonempty&&(pending?<><LoadingSpinner/><span className="sr-only">Checking name availability</span></>:result?.state==='available'?<span className="name-available">This name is available.</span>:result?.state==='taken'?<span className="name-unavailable">This name is already taken.</span>:<span>{result?.message}</span>)}</div></div>;
}
