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
it('opens the new list stages without allowing edits to derail the guide',()=>{
 expect(tourClickAllowed('Browse your places',target(['.map-panel [aria-label="Places"]']))).toBe(true);
 expect(tourClickAllowed('Browse your connections',target(['.map-panel [aria-label="Connections"]']))).toBe(true);
 expect(tourClickAllowed('Add your first place',target(['.map-panel [aria-label="Places"]']))).toBe(false);
 expect(tourClickAllowed('Browse your places',target(['.places-modal button[aria-label^="Edit place"]']))).toBe(false);
 expect(tourClickAllowed('Browse your connections',target(['.connections-list button']))).toBe(false);
 expect(tourClickAllowed('Add another place',target(['[aria-label="Close tasks"]']))).toBe(true);
});
it('blocks every part of home and all-trip cards in every guide stage',()=>{
 for(const stage of ['Find your plans again','Pin a shortcut','Choose your preferences','Add your first place']){
  for(const selector of ['.home-tile','.all-trips-list','.home-resume-card','.home-tile-main','.home-tile-menu','.home-context-menu'])expect(tourClickAllowed(stage,target([selector])),`${stage}: ${selector}`).toBe(false);
 }
});
it('keeps the map and schedule present while explaining workspace controls',()=>{
 expect(tourClickAllowed('Arrange your workspace',target(['[aria-label="Map"]']))).toBe(false);
 expect(tourClickAllowed('Arrange your workspace',target(['[aria-label="Schedule"]']))).toBe(false);
});
