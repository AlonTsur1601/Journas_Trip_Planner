import type {Settings} from './types';
export const appearanceKey='journas-appearance';
export function readAppearance(userId:string,storage:Pick<Storage,'getItem'>=localStorage):Partial<Pick<Settings,'theme'|'accent'>>{
 try{const value=JSON.parse(storage.getItem(appearanceKey)??'{}');if(!userId||value?.userId!==userId)return {};return {...(['light','dark','system'].includes(value?.theme)?{theme:value.theme}:{}),...(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value?.accent)?{accent:value.accent}:{})};}catch{return {};}
}
export function cacheAppearance(settings:Pick<Settings,'theme'|'accent'>,userId:string){try{localStorage.setItem(appearanceKey,JSON.stringify({userId,theme:settings.theme,accent:settings.accent}));}catch{/* Storage can be disabled. */}}

export const isBlackAccent=(accent:string)=>['#292637','#000000','#000','#000000ff'].includes(accent.toLowerCase());
export function applyAccent(accent:string,dark:boolean){document.documentElement.dataset.neutralAccent=String(isBlackAccent(accent)||['#fff','#ffffff'].includes(accent.toLowerCase()));const neutral=dark&&isBlackAccent(accent);document.documentElement.style.setProperty('--accent',neutral?'#ffffff':accent);document.documentElement.style.setProperty('--accent-ink',neutral?'#17151f':'#ffffff');}
