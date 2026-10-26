import type {Settings} from "./types";
export type PracticeProfile=Partial<Pick<Settings,"displayName"|"photoURL"|"theme"|"accent">>;
export type PracticeData={profile?:PracticeProfile;documents:unknown[];queue:Promise<unknown>};
let session:PracticeData|null=null;
const achievements=new Set<string>();
export const practiceFeatures=()=>[...achievements];
export function recordPracticeFeature(feature:string){if(!session)return;achievements.add(feature);window.dispatchEvent(new Event('journas-practice-feature'));}
export const practiceActive=()=>session!==null;
export const getPracticeSession=()=>session;
export function setPractice(value:boolean,userId?:string,accent?:string,profile?:PracticeProfile){
 const appearance=Object.fromEntries(Object.entries(profile??{}).filter(([key,value])=>['displayName','photoURL','theme','accent'].includes(key)&&typeof value==='string'));
 achievements.clear();session=value?{profile:{...(accent?{accent}:{}),...appearance},documents:userId?[[`users/${userId}`,{id:userId,settings:{...(accent?{accent}:{}),...appearance},tripCount:0}]]:[],queue:Promise.resolve()}:null;practiceLocal.clear();practiceSession.clear();
}
export function practiceRequest<T>(state:PracticeData,work:(documents:unknown[])=>Promise<{practiceResult:T;practiceDocuments:unknown[]}>):Promise<T>{const next=state.queue.then(async()=>{const result=await work(state.documents);state.documents=result.practiceDocuments;return result.practiceResult;});state.queue=next.catch(()=>{});return next;}
function memoryStorage(){const values=new Map<string,string>();return {get length(){return values.size;},key:(index:number)=>[...values.keys()][index]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,String(value));},removeItem:(key:string)=>{values.delete(key);},clear:()=>values.clear()} satisfies Storage;}
export const practiceLocal=memoryStorage(),practiceSession=memoryStorage();
