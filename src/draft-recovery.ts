import type {Day} from './types';
type Draft={kind:keyof Day;item:Record<string,any>;base?:Record<string,any>};
const ignored=new Set(['id','kind','versions','updatedAt','updatedBy','createdAt','startEpoch','endEpoch','startDate','endDate']);
/** Remove only drafts whose intended field changes are already on the server. */
export function draftIsSaved(draft:Draft,day:Day){
 const current=day[draft.kind]?.find(item=>item.id===draft.item?.id) as Record<string,any>|undefined;
 if(!current)return false;
 const changed=Object.keys(draft.item).filter(key=>!ignored.has(key)&&(!draft.base||JSON.stringify(draft.item[key])!==JSON.stringify(draft.base[key])));
 return changed.every(key=>JSON.stringify(current[key])===JSON.stringify(draft.item[key]));
}
