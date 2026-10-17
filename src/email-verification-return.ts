import type {User} from 'firebase/auth';
import {api} from './firebase';
type WorkerReply={clientId?:string;focused?:boolean;sameBrowser?:boolean;sessionToken?:string};
function workerMessage(worker:ServiceWorker,message:Record<string,unknown>):Promise<WorkerReply> {
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>finish({}),12000);
    const finish=(value:WorkerReply)=>{clearTimeout(timer);channel.port1.close();resolve(value);};
    channel.port1.onmessage=event=>finish(event.data??{});
    try{worker.postMessage(message,[channel.port2]);}catch{finish({});}
  });
}
async function worker():Promise<ServiceWorker|null>{
  if(!('serviceWorker' in navigator))return null;
  try{
    const registration=await Promise.race([navigator.serviceWorker.register('/verification-worker.js').then(()=>navigator.serviceWorker.ready),new Promise<null>(resolve=>setTimeout(()=>resolve(null),2500))]);
    return registration?.active??null;
  }catch{return null;}
}
export async function verificationReturnClient(){
  const active=await worker();
  return active?(await workerMessage(active,{type:'journas-verification-client'})).clientId:undefined;
}
export function listenForVerificationSession(user:User){
  const listener=(event:MessageEvent)=>{
    const port=event.ports[0];
    if(event.data?.type!=='journas-verification-session'||!port)return;
    const source=event.source as ServiceWorker|null;
    if(!source?.scriptURL||new URL(source.scriptURL).origin!==location.origin||new URL(source.scriptURL).pathname!=='/verification-worker.js')return;
    void(async()=>{
      try{
        await user.reload();
        if(!user.emailVerified||!user.email||user.email.toLowerCase()!==String(event.data.email).toLowerCase())throw new Error('Account mismatch');
        await user.getIdToken(true);
        const result=await api<{sessionToken:string}>('auth.verification-session');
        port.postMessage(result);
      }catch{port.postMessage({});}
      finally{port.close();}
    })();
  };
  navigator.serviceWorker?.addEventListener('message',listener);
  return()=>navigator.serviceWorker?.removeEventListener('message',listener);
}
export async function returnAfterVerification(returnClientId:string|null,email:string|undefined):Promise<WorkerReply>{
  try{localStorage.setItem('journas-email-verified',String(Date.now()));}catch{/* Polling still handles verification. */}
  const active=returnClientId?await worker():null;
  return active?await workerMessage(active,{type:'journas-email-verified',returnClientId,email}):{};
}
