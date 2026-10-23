export type EmojiEntry={unicode:string;label:string;group?:number;order?:number;tags?:string[];skins?:EmojiEntry[]};
export type EmojiChoice={unicode:string;label:string;group:number;order:number;tags:string[];version?:number};
export function completeEmojiCatalog(entries:ReadonlyArray<EmojiEntry>){
 const found=new Map<string,EmojiChoice>();
 const add=(entry:EmojiEntry,parent?:EmojiEntry)=>{if(!found.has(entry.unicode))found.set(entry.unicode,{unicode:entry.unicode,label:entry.label,group:entry.group??parent?.group??-1,order:entry.order??Number.MAX_SAFE_INTEGER,tags:[...new Set([...(parent?.tags??[]),...(entry.tags??[])])]});for(const skin of entry.skins??[])add(skin,entry);};
 for(const entry of entries)add(entry);
 return [...found.values()].sort((a,b)=>a.order-b.order);
}
import {renderableEmojiCatalog} from './emoji-support';
import {readEmojiSupportCache,writeEmojiSupportCache} from './emoji-support-cache';
export {renderableEmojiCatalog,emojiIsRenderable} from './emoji-support';
let catalog:Promise<EmojiChoice[]>|undefined;
async function filterEmojiInBackground(entries:EmojiChoice[]){
 const device=typeof navigator==='undefined'?'':navigator.userAgent+'|'+navigator.platform;
 try{const cached=readEmojiSupportCache(localStorage.getItem('journas-emoji-support'),entries,device);if(cached)return cached;}catch{/* Storage can be disabled. */}
 const supported=await detectEmojiSupport(entries);
 try{localStorage.setItem('journas-emoji-support',writeEmojiSupportCache(entries,supported,device));}catch{/* Keep the in-memory result when storage is unavailable. */}
 return supported;
}
function detectEmojiSupport(entries:EmojiChoice[]){
 if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return renderableEmojiCatalog(entries);
 return new Promise<EmojiChoice[]>((resolve,reject)=>{const worker=new Worker(new URL('./emoji-support.worker.ts',import.meta.url),{type:'module'});const deadline=setTimeout(()=>{worker.terminate();reject(Object.assign(new Error('Emoji support check timed out. Please retry.'),{code:'EMOJI_TIMEOUT'}));},15000);const finish=()=>{clearTimeout(deadline);worker.terminate();};worker.onmessage=(event:MessageEvent<{entries?:EmojiChoice[];error?:string}>)=>{finish();if(event.data.entries)resolve(event.data.entries);else reject(new Error(event.data.error??'Emoji support check failed.'));};worker.onerror=()=>{finish();reject(new Error('Emoji support check failed.'));};worker.postMessage(entries);}).catch(error=>{if(error?.code==='EMOJI_TIMEOUT')throw error;return renderableEmojiCatalog(entries);});
}
export function loadEmojiCatalog(){return catalog??=Promise.all([import('emojibase-data/en/compact.json'),import('./emoji-versions.json')]).then(([module,versions])=>filterEmojiInBackground(completeEmojiCatalog(module.default).map(entry=>({...entry,version:(versions.default as Record<string,number>)[entry.unicode]})))).catch(error=>{catalog=undefined;throw error;});}

let preloadScheduled=false;
export function preloadEmojiCatalog(){
 if(preloadScheduled||typeof window==='undefined')return;preloadScheduled=true;
 const run=()=>{void loadEmojiCatalog().catch(()=>{preloadScheduled=false;});};
 if('requestIdleCallback' in window)window.requestIdleCallback(run,{timeout:1200});else setTimeout(run,200);
}
