import {expect,it} from 'vitest';
import {dayLayout,screenLayout,restoredDayMatches,fallbackDayLayout} from '../src/view-restore';
import {defaultLayout,emptyDay,type Trip} from '../src/types';
const trip={id:'paris',startDate:'2026-10-23',endDate:'2026-10-28',lodging:{name:'Stay',lng:2.35,lat:48.85}} as Trip;
const layout={...defaultLayout(),center:[2.36,48.86] as [number,number],zoom:15.25,bearing:37,scroll:620};
it('reads views by account, trip and date without allowing a home placeholder to replace them',()=>{
 const storage={getItem:(key:string)=>key==='journas-layout:u:paris:2026-10-24'?JSON.stringify(layout):null};
 expect(dayLayout(storage,'u','paris','2026-10-24')).toEqual(layout);
 expect(dayLayout(storage,'other','paris','2026-10-24')).toBeNull();
 expect(dayLayout(storage,'u','paris','2026-10-25')).toBeNull();
 expect(screenLayout({uid:'u',tripId:'paris',date:'2026-10-24',home:true,layout:defaultLayout()},'u','paris','2026-10-24')).toBeNull();
});
it('accepts only the matching planner screen and preserves bearing and scroll',()=>{
 const screen={uid:'u',tripId:'paris',date:'2026-10-24',home:false,layout};
 expect(screenLayout(screen,'u','paris','2026-10-24')).toEqual(layout);
 expect(screenLayout(screen,'u','paris','2026-10-25')).toBeNull();
 expect(screenLayout(screen,'v','paris','2026-10-24')).toBeNull();
});
it('never treats another date in the same trip as the requested restore',()=>{
 const restored={trip,date:'2026-10-26',day:emptyDay(),layout};
 expect(restoredDayMatches(restored,'paris','2026-10-24')).toBe(false);
 expect(restoredDayMatches(restored,'paris','2026-10-26')).toBe(true);
 expect(restoredDayMatches(restored,'other','2026-10-26')).toBe(false);
});
it('ignores unreadable local views and uses lodging for an unsaved in-trip date',()=>{
 expect(dayLayout({getItem:()=>'{broken'},'u','paris','2026-10-24')).toBeNull();
 expect(dayLayout({getItem:()=>'{"center":[0],"zoom":3}'},'u','paris','2026-10-24')).toBeNull();
 expect(fallbackDayLayout(trip,'2026-10-24')).toMatchObject({center:[2.35,48.85],zoom:14});
 expect(fallbackDayLayout(trip,'2026-10-29')).toEqual(defaultLayout());
});
