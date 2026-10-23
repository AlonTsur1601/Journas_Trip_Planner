import {expect,it} from 'vitest';
import {tourClickAllowed} from '../src/tour-safety';

const target=(matches:string[])=>({closest:(selector:string)=>selector.split(',').some(part=>matches.includes(part.trim()))?{}:null}) as unknown as Element;
it('allows the home link only at the intended return-home stage',()=>{
 const link=target(['a[href]','.topbar .brand']);
 expect(tourClickAllowed('Return home',link)).toBe(true);
 expect(tourClickAllowed('Add your first place',link)).toBe(false);
});
it('allows the share request to report its refusal while blocking the trip editor',()=>{
 const create=target(['.share-modal > .button','[aria-label="Trip details"]']);
 const edit=target(['.share-modal > .button','.share-modal > .button:not(.primary)']);
 expect(tourClickAllowed('Share and collaborate',create)).toBe(true);
 expect(tourClickAllowed('Share and collaborate',edit)).toBe(false);
});
it('keeps account identity and task editors outside the tutorial flow',()=>{
 expect(tourClickAllowed('Choose your preferences',target(['.photo-picker-button']))).toBe(false);
 expect(tourClickAllowed('Check it off',target(['.task-row button']))).toBe(false);
 expect(tourClickAllowed('Check it off',target(['.task-row input']))).toBe(true);
});
