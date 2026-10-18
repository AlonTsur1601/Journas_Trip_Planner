/** Page-lifetime cache. Never persisted, and isolated by account and email. */
export class VerificationCache {
 private entries=new Map<string,Promise<boolean>>();
 private confirmed=new Set<string>();
 has(key:string){return this.confirmed.has(key);}
 check(key:string,load:()=>Promise<boolean>){
  const existing=this.entries.get(key);if(existing)return existing;
  const request=load().then(value=>{
   if(this.entries.get(key)===request){if(value)this.confirmed.add(key);else this.entries.delete(key);}
   return value;
  },error=>{if(this.entries.get(key)===request)this.entries.delete(key);throw error;});
  this.entries.set(key,request);return request;
 }
 confirm(key:string){this.confirmed.add(key);this.entries.set(key,Promise.resolve(true));}
 invalidate(key:string){this.confirmed.delete(key);this.entries.delete(key);}
}
