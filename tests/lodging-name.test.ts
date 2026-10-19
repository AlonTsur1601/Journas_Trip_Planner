import {it,expect} from 'vitest';
import {lodgingName} from '../src/lodging-name';
it('labels unnamed coordinate-only lodging consistently',()=>{for(const name of ['Unnamed location','Unknown location',''])expect(lodgingName(undefined,name,false)).toBe('Lodging');});
it('allows a real reverse-geocoded name while preserving a manual name',()=>{expect(lodgingName('Lodging','Hotel A',false)).toBe('Hotel A');expect(lodgingName('My cabin','Hotel A',true)).toBe('My cabin');expect(lodgingName('My cabin','Unnamed location',true)).toBe('My cabin');});
