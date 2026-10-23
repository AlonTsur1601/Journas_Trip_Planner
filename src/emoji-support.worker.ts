import {renderableEmojiCatalog} from './emoji-support';
import type {EmojiChoice} from './emoji-catalog';
const worker=globalThis as unknown as {onmessage:(event:MessageEvent<EmojiChoice[]>)=>void;postMessage:(value:{entries?:EmojiChoice[];error?:string})=>void};
worker.onmessage=event=>{void renderableEmojiCatalog(event.data,new OffscreenCanvas(1,1)).then(entries=>worker.postMessage({entries})).catch(error=>worker.postMessage({error:String(error)}));};
