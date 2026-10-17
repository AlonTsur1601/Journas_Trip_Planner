import type {Block,Pin} from './types';
/** Change inherited values without dropping the user's explicit overrides. */
export function changeBlockPlace<T extends Pick<Block,'title'|'detail'|'color'|'symbol'|'overrides'>>(block:T,pin:Pin|undefined){
 const next={...block,pinId:pin?.id??null};
 if(!pin)return next;
 const inherited={title:pin.title,detail:pin.note,color:pin.color,symbol:pin.symbol};
 for(const key of ['title','detail','color','symbol'] as const)if(!block.overrides.includes(key))next[key]=inherited[key];
 return next;
}
