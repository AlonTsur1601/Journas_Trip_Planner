import {expect,it} from 'vitest';
import {calendarTripColors,colorContrast} from '../src/calendar-colors';
const trips=Array.from({length:12},(_,i)=>({id:`trip-${i}`}));
for(const dark of [false,true])for(const accent of ['#8b5cf6','#3b82f6','#06b6d4','#22c55e','#eab308','#f97316','#ef4444','#ec4899','#64748b','#292637','#ffffff']){
 it(`keeps 12 trip markers distinct on selected and unselected dates (${accent}, dark=${dark})`,()=>{
  const colors=calendarTripColors(trips,accent,dark),selected=dark&&accent==='#292637'?'#ffffff':accent;
  expect(new Set(Object.values(colors)).size).toBe(12);
  for(const color of Object.values(colors)){expect(colorContrast(color,selected)).toBeGreaterThanOrEqual(2.2);expect(colorContrast(color,dark?'#211f2d':'#fff')).toBeGreaterThanOrEqual(2.2);}
  expect(calendarTripColors([...trips].reverse(),accent,dark)).toEqual(colors);
 });
}
