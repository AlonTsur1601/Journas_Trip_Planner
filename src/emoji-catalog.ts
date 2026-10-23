export type EmojiEntry={unicode:string;label:string;group?:number;order?:number;tags?:string[];skins?:EmojiEntry[]};
export type EmojiChoice={unicode:string;label:string;group:number;order:number;tags:string[];version?:number};
export function completeEmojiCatalog(entries:ReadonlyArray<EmojiEntry>){
 const found=new Map<string,EmojiChoice>();
 const add=(entry:EmojiEntry,parent?:EmojiEntry)=>{if(!found.has(entry.unicode))found.set(entry.unicode,{unicode:entry.unicode,label:entry.label,group:entry.group??parent?.group??-1,order:entry.order??Number.MAX_SAFE_INTEGER,tags:[...new Set([...(parent?.tags??[]),...(entry.tags??[])])]});for(const skin of entry.skins??[])add(skin,entry);};
 for(const entry of entries)add(entry);
 return [...found.values()].sort((a,b)=>a.order-b.order);
}
import {renderableEmojiCatalog} from './emoji-support';
export {renderableEmojiCatalog,emojiIsRenderable} from './emoji-support';
let catalog:Promise<EmojiChoice[]>|undefined;
function filterEmojiInBackground(entries:EmojiChoice[]){
 if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return renderableEmojiCatalog(entries);
 return new Promise<EmojiChoice[]>((resolve,reject)=>{const worker=new Worker(new URL('./emoji-support.worker.ts',import.meta.url),{type:'module'});worker.onmessage=(event:MessageEvent<{entries?:EmojiChoice[];error?:string}>)=>{worker.terminate();if(event.data.entries)resolve(event.data.entries);else reject(new Error(event.data.error??'Emoji support check failed.'));};worker.onerror=()=>{worker.terminate();reject(new Error('Emoji support check failed.'));};worker.postMessage(entries);}).catch(()=>renderableEmojiCatalog(entries));
}
export function loadEmojiCatalog(){return catalog??=Promise.all([import('emojibase-data/en/compact.json'),import('./emoji-versions.json')]).then(([module,versions])=>filterEmojiInBackground(completeEmojiCatalog(module.default).map(entry=>({...entry,version:(versions.default as Record<string,number>)[entry.unicode]})))).catch(error=>{catalog=undefined;throw error;});}
