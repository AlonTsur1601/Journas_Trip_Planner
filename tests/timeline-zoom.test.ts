import {expect,it} from 'vitest';
import {timelineZoom,minHourHeight,maxHourHeight,outsideTimelineKey,outsideTimelineHeight} from '../src/timeline-zoom';
it('keeps the time under the cursor fixed while scaling',()=>{const next=timelineZoom(60,300,120,1.5,400);expect(next.hourHeight).toBe(90);expect((next.scroll+120)/next.hourHeight).toBe(7);});
it('keeps the center time fixed for keyboard zoom and allows zooming back',()=>{const next=timelineZoom(48,400,150,1.15,300),back=timelineZoom(next.hourHeight,next.scroll,150,1/1.15,300);expect(back.hourHeight).toBe(48);expect(back.scroll).toBeCloseTo(400);});
it('limits extreme scale and scroll values to the visible day',()=>{const large=timelineZoom(60,0,0,1e8,500),small=timelineZoom(60,1400,200,1e-8,500);expect(large.hourHeight).toBe(maxHourHeight);expect(small.hourHeight).toBe(minHourHeight);expect(small.scroll).toBe(76);});

it('restores non-trip spacing by user and date without leaking it into another day',()=>{const storage={getItem:(key:string)=>key===outsideTimelineKey('u','2026-10-26')?'95':null};expect(outsideTimelineHeight(storage,'u','2026-10-26')).toBe(95);expect(outsideTimelineHeight(storage,'u','2026-10-27')).toBeUndefined();expect(outsideTimelineHeight(storage,'v','2026-10-26')).toBeUndefined();});
