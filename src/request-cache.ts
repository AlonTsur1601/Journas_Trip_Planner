/** Coalesce only concurrent reads. Writes always reach the server independently. */
export class ConcurrentReads {
 private pending=new Map<string,Promise<unknown>>();
 run<T>(key:string,read:()=>Promise<T>):Promise<T>{
  let request=this.pending.get(key) as Promise<T>|undefined;
  if(!request){request=read();this.pending.set(key,request);const clear=()=>{if(this.pending.get(key)===request)this.pending.delete(key);};void request.then(clear,clear);}
  return request.then(result=>structuredClone(result));
 }
}
export const isReadAction=(action:string)=>['auth.session','auth.verification-status','planner.restore','settings.get','tour.status','trip.get','trip.list','trip.members','history.status','share.read','share.list','places.search','places.reverse','places.landmarks'].includes(action);
