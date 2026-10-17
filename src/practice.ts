export type PracticeData={documents:unknown[];queue:Promise<unknown>};
let session:PracticeData|null=null;
export const practiceActive=()=>session!==null;
export const getPracticeSession=()=>session;
export function setPractice(value:boolean){session=value?{documents:[],queue:Promise.resolve()}:null;practiceLocal.clear();practiceSession.clear();}
export function practiceRequest<T>(state:PracticeData,work:(documents:unknown[])=>Promise<{practiceResult:T;practiceDocuments:unknown[]}>):Promise<T>{const next=state.queue.then(async()=>{const result=await work(state.documents);state.documents=result.practiceDocuments;return result.practiceResult;});state.queue=next.catch(()=>{});return next;}
function memoryStorage(){const values=new Map<string,string>();return {get length(){return values.size;},key:(index:number)=>[...values.keys()][index]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,String(value));},removeItem:(key:string)=>{values.delete(key);},clear:()=>values.clear()} satisfies Storage;}
export const practiceLocal=memoryStorage(),practiceSession=memoryStorage();
