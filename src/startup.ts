import {api} from './firebase';
import {type Trip,type Day,type Layout,type Settings,type HomeState} from './types';
const today=()=>new Date().toLocaleDateString('en-CA');
export type ProfileStartup={tourSeen?:boolean;trips:Trip[];settings:Settings;home:HomeState;restore:{trip:Trip;date:string;day:Day;layout:Layout|null}|null};
const profiles=new Map<string,ProfileStartup>();
export function initialScreen(uid:string){
 let saved:any=null;
 try{if((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='reload')saved=JSON.parse(sessionStorage.getItem('journas-current-screen')??'null');}catch{}
 const token=new URLSearchParams(location.search).get('share'),restore=saved?.uid===uid&&!token;
 return {date:restore?saved.date:today(),...(restore&&saved.tripId?{tripId:saved.tripId}:token?{tripId:null}:{})};
}
export async function startSession(uid:string){
 const result=await api<ProfileStartup&{verified:boolean}>('auth.session',initialScreen(uid),AbortSignal.timeout(12000),true,null);
 if(result.verified)profiles.set(uid,result);
 return result.verified;
}
export const initialProfile=(uid:string)=>profiles.get(uid);
export const releaseInitialProfile=(uid:string)=>profiles.delete(uid);
