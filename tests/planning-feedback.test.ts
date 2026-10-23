import {describe,it,expect} from 'vitest';
import {changeBlockPlace} from '../src/block-link';
import {activitySnapshot,beginActivity} from '../src/activity';
const pin={id:'new-place',title:'New place',note:'New note',color:'#112233',symbol:'icon:stay',lat:51,lng:0,versions:{}};
const block={id:'block',title:'My title',detail:'My details',color:'#abcdef',symbol:'icon:walk',pinId:'old-place',start:'09:00',end:'10:00',overrides:[] as string[],versions:{}};
describe('changing a time block linked place',()=>{
 it('inherits fields that have not been customized',()=>expect(changeBlockPlace(block,pin)).toMatchObject({pinId:pin.id,title:pin.title,detail:pin.note,color:pin.color,symbol:pin.symbol}));
 for(const field of ['title','detail','color','symbol'] as const)it(`preserves a manually chosen ${field} while inheriting other fields`,()=>{const customized={...block,overrides:[field]};const next=changeBlockPlace(customized,pin);expect(next[field]).toBe(block[field]);expect(next.overrides).toEqual([field]);for(const other of ['title','detail','color','symbol'] as const)if(other!==field)expect(next[other]).toBe(other==='detail'?pin.note:pin[other]);expect(customized.pinId).toBe('old-place');});
 it('preserves all four custom fields across switching and unlinking',()=>{const original={...block,overrides:['title','detail','color','symbol']};const switched=changeBlockPlace(original,pin);const unlinked=changeBlockPlace(switched,undefined);expect(unlinked).toEqual({...original,pinId:null,connectionId:null});});
});
describe('item saving overlay',()=>{
 it('carries the translucent presentation without changing default loading activities',()=>{const end=beginActivity('Saving your place…','overlay');expect(activitySnapshot()[0].presentation).toBe('overlay');end();const finish=beginActivity('Loading trips');expect(activitySnapshot()[0]).not.toHaveProperty('presentation');finish();expect(activitySnapshot()).toEqual([]);});
});
