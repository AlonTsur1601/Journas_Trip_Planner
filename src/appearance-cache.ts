import type {Settings} from './types';
export const appearanceKey='journas-appearance';
export function readAppearance(storage:Pick<Storage,'getItem'>=localStorage):Partial<Pick<Settings,'theme'|'accent'>>{
 try{const value=JSON.parse(storage.getItem(appearanceKey)??'{}');return {...(['light','dark','system'].includes(value?.theme)?{theme:value.theme}:{}),...(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value?.accent)?{accent:value.accent}:{})};}catch{return {};}
}
export function cacheAppearance(settings:Pick<Settings,'theme'|'accent'>){try{localStorage.setItem(appearanceKey,JSON.stringify({theme:settings.theme,accent:settings.accent}));}catch{/* Storage can be disabled. */}}
