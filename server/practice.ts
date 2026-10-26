import {JournasService} from './service.js';
import {ApiError,type Data,type Store,type Transaction} from './types.js';
export class PracticeStore implements Store {
 docs=new Map<string,Data>();
 constructor(documents:unknown=[]){if(!Array.isArray(documents)||documents.length>1500)throw new ApiError(400,'INVALID_PRACTICE','Invalid practice data');for(const entry of documents){if(!Array.isArray(entry)||typeof entry[0]!=='string'||!entry[1]||typeof entry[1]!=='object')throw new ApiError(400,'INVALID_PRACTICE','Invalid practice data');this.docs.set(entry[0],entry[1]);}}
 async transaction<T>(fn:(tx:Transaction)=>Promise<T>){const copy=new PracticeStore([...this.docs]);const result=await fn({get:async path=>copy.docs.get(path),list:path=>copy.list(path),set:(path,value)=>{copy.docs.set(path,structuredClone(value));},delete:path=>{copy.docs.delete(path);}});this.docs=copy.docs;return result;}
 async list(path:string,limit=10000){return [...this.docs].filter(([key])=>key.slice(0,key.lastIndexOf('/'))===path).map(([,value])=>value).slice(0,limit);}
 async scanTrips(after='',limit=100):Promise<Data[]>{return (await this.list('trips')).filter(trip=>String(trip.id)>after).sort((a,b)=>String(a.id).localeCompare(String(b.id))).slice(0,limit);}
 async dueMemberships(){return [];}
 async purgeTrip(id:string){for(const key of this.docs.keys())if(key===`trips/${id}`||key.startsWith(`trips/${id}/`))this.docs.delete(key);}
 async purgeLayouts(){/* Practice data is discarded with its session. */}
}
export async function practiceExecute(uid:string,input:Data){
 const action=String(input.action);
 if(!/^(planner\.restore|trip\.(create|update|get|list|remove|members)|item\.(patch|delete|copy-pin)|home\.save|settings\.(get|save)|profile\.save|layout\.save|history\.(status|undo|redo))$/.test(action))throw new ApiError(400,'PRACTICE_ONLY','Sharing and account changes are unavailable during the guided tutorial.');
 const store=new PracticeStore(input.practiceDocuments);const {practiceDocuments,...request}=input;
 const result=await new JournasService(store,Date.now,false).execute(uid,request);
 return {practiceResult:result,practiceDocuments:[...store.docs]};
}
