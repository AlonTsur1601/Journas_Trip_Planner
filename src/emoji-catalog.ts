export type EmojiEntry={unicode:string;label:string;group?:number;order?:number;tags?:string[];skins?:EmojiEntry[]};
export type EmojiChoice={unicode:string;label:string;group:number;order:number;tags:string[]};
export function completeEmojiCatalog(entries:ReadonlyArray<EmojiEntry>){
 const found=new Map<string,EmojiChoice>();
 const add=(entry:EmojiEntry,parent?:EmojiEntry)=>{if(!found.has(entry.unicode))found.set(entry.unicode,{unicode:entry.unicode,label:entry.label,group:entry.group??parent?.group??-1,order:entry.order??Number.MAX_SAFE_INTEGER,tags:[...new Set([...(parent?.tags??[]),...(entry.tags??[])])]});for(const skin of entry.skins??[])add(skin,entry);};
 for(const entry of entries)add(entry);
 return [...found.values()].sort((a,b)=>a.order-b.order);
}
let catalog:Promise<EmojiChoice[]>|undefined;
export function loadEmojiCatalog(){return catalog??=import('emojibase-data/en/compact.json').then(module=>completeEmojiCatalog(module.default)).catch(error=>{catalog=undefined;throw error;});}
