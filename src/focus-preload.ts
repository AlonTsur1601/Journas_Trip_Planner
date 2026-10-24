type Prepared={bytes:number;dispose:()=>void};
type Entry<P,T>={point:P;promise:Promise<T>;resolve:(value:T)=>void;reject:(error:Error)=>void;value?:T;claimed:boolean};
const cancelled=()=>new DOMException('Focus preparation cancelled','AbortError');

/** One background renderer, bounded reusable routes, and priority for an actual click. */
export class FocusPreloadQueue<P,T extends Prepared>{
 private entries=new Map<string,Entry<P,T>>();
 private waiting:string[]=[];
 private active?:{key:string;controller:AbortController};
 private paused=false;
 private generation=0;
 private bytes=0;
 private estimate=0;
 private prepare?:(point:P,signal:AbortSignal)=>Promise<T>;
 constructor(private budget:number,private changed?:(ready:number)=>void){}
 get readyCount(){return [...this.entries.values()].filter(entry=>entry.value).length;}
 get isPaused(){return this.paused;}
 private notify(){this.changed?.(this.readyCount);}
 reset(points:Array<[string,P]>,prepare:(point:P,signal:AbortSignal)=>Promise<T>){
  this.clear();this.paused=false;this.prepare=prepare;
  for(const [key,point] of points)this.add(key,point);
  this.pump();
 }
 private add(key:string,point:P){
  if(this.entries.has(key))return this.entries.get(key)!;
  let resolve!:(value:T)=>void,reject!:(error:Error)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  void promise.catch(()=>{});
  const entry:Entry<P,T>={point,promise,resolve,reject,claimed:false};
  this.entries.set(key,entry);this.waiting.push(key);return entry;
 }
 private pump(){
  if(this.active||!this.prepare)return;
  const key=this.waiting[0],entry=this.entries.get(key);if(!entry)return;
  if(this.paused&&!entry.claimed)return;
  if(!entry.claimed&&this.estimate&&this.bytes+this.estimate>this.budget)return;
  this.waiting.shift();
  const controller=new AbortController(),generation=this.generation;
  this.active={key,controller};
  void this.prepare(entry.point,controller.signal).then(value=>{
   if(controller.signal.aborted||generation!==this.generation||this.entries.get(key)!==entry){value.dispose();return;}
   this.estimate=value.bytes;
   if(entry.claimed)this.entries.delete(key);
   else{entry.value=value;this.bytes+=value.bytes;}
   this.notify();entry.resolve(value);
  },error=>{if(this.entries.get(key)===entry)this.entries.delete(key);entry.reject(error);}).finally(()=>{this.active=undefined;this.pump();});
 }
 async take(key:string,point:P,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();this.paused=true;
  const entry=this.add(key,point);entry.claimed=true;
  // The selected route owns its frames; release alternatives before playback.
  for(const [other,value] of this.entries)if(other!==key){value.value?.dispose();value.reject(cancelled());this.entries.delete(other);}
  this.bytes=0;this.waiting=this.waiting.filter(value=>value===key);
  if(this.active&&this.active.key!==key)this.active.controller.abort();
  if(entry.value){this.entries.delete(key);this.notify();return entry.value;}
  this.waiting=this.waiting.filter(value=>value!==key);if(this.active?.key!==key)this.waiting.unshift(key);
  const cancel=()=>{if(this.entries.get(key)===entry)this.entries.delete(key);this.waiting=this.waiting.filter(value=>value!==key);if(this.active?.key===key)this.active.controller.abort();entry.reject(cancelled());};
  signal.addEventListener('abort',cancel,{once:true});this.pump();
  try{const value=await entry.promise;if(signal.aborted){value.dispose();throw cancelled();}return value;}
  finally{signal.removeEventListener('abort',cancel);}
 }
 clear(){
  ++this.generation;this.active?.controller.abort();
  for(const entry of this.entries.values()){entry.value?.dispose();entry.reject(cancelled());}
  this.entries.clear();this.waiting=[];this.bytes=0;this.estimate=0;this.notify();
 }
}
