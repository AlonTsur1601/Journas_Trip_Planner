import type {EmojiChoice} from './emoji-catalog';
const format='emojibase18-native-v1',lifetime=86400000;
export function readEmojiSupportCache(raw:string|null,entries:EmojiChoice[],device:string,now=Date.now()):EmojiChoice[]|null{
 try{if(!raw)return null;const saved=JSON.parse(raw);if(saved.format!==format||saved.device!==device||saved.count!==entries.length||!Number.isFinite(saved.expires)||saved.expires<=now||saved.expires>now+lifetime||!Array.isArray(saved.unsupported)||saved.unsupported.length>entries.length||saved.unsupported.some((value:unknown)=>typeof value!=='string'))return null;const excluded=new Set(saved.unsupported);if(entries.filter(entry=>excluded.has(entry.unicode)).length!==excluded.size)return null;return entries.filter(entry=>!excluded.has(entry.unicode));}catch{return null;}
}
export function writeEmojiSupportCache(entries:EmojiChoice[],supported:EmojiChoice[],device:string,now=Date.now()){
 const kept=new Set(supported.map(entry=>entry.unicode));return JSON.stringify({format,device,count:entries.length,expires:now+lifetime,unsupported:entries.filter(entry=>!kept.has(entry.unicode)).map(entry=>entry.unicode)});
}
