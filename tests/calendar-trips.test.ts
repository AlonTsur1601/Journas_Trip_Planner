import {expect,it} from 'vitest';
import {calendarTripsForDisplay} from '../src/calendar-trips';
import type {Trip} from '../src/types';

const trip=(id:string,overrides:Partial<Trip>={}):Trip=>({id,name:'Paris',startDate:'2026-11-01',endDate:'2026-11-03',ownerId:id,memberIds:[id],...overrides});

it('groups explicitly identified demo copies and keeps the currently open copy',()=>{
 const copies=['tourist','traveler','adventurer'].map(id=>trip(id,{calendarDemoGroup:'paris-demo'}));
 expect(calendarTripsForDisplay(copies,'traveler').map(t=>t.id)).toEqual(['traveler']);
});

it('keeps unrelated trips and demo copies with different dates separate',()=>{
 const trips=[trip('a',{calendarDemoGroup:'paris-demo'}),trip('b',{calendarDemoGroup:'paris-demo',endDate:'2026-11-04'}),trip('c'),trip('d')];
 expect(calendarTripsForDisplay(trips).map(t=>t.id)).toEqual(['a','b','c','d']);
});
