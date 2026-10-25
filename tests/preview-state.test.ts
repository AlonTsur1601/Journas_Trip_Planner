import{expect,it}from'vitest';
import{locationPreviewPins,previewPinId}from'../src/location-preview';
import{visibleConnections}from'../src/connection-preview';
import{isManualLodgingName,lodgingName}from'../src/lodging-name';
const pin=(id:string)=>({id,title:id,note:'',color:'#8b5cf6',symbol:'icon:stay',lng:2,lat:48,versions:{}});
it('keeps every other day pin and replaces the edited endpoint exactly once',()=>{
 const pins=[pin('trip-lodging'),pin('museum'),pin('cafe')];
 const result=locationPreviewPins(pins,'museum',{lng:3,lat:49,name:'New museum'},'#06b6d4','icon:museum');
 expect(result.map(p=>p.id)).toEqual(['trip-lodging','cafe','museum']);expect(result[2]).toMatchObject({lng:3,title:'New museum'});expect(pins[1].lng).toBe(2);
 expect(locationPreviewPins(pins,undefined,{lng:3,lat:49},'#06b6d4','icon:stay').map(p=>p.id)).toEqual(['trip-lodging','museum','cafe',previewPinId]);
 expect(locationPreviewPins(pins,undefined,undefined,'#06b6d4','icon:stay')).toEqual(pins);
});
it('shows a pending connection immediately only on its own trip and day and reconciles without duplicates',()=>{
 const connection={id:'route',from:'a',to:'b',arrow:true,versions:{}};
 const pending=[{tripId:'trip',date:'2026-10-25',connection}];
 expect(visibleConnections([],pending,'trip','2026-10-25')).toEqual([connection]);
 expect(visibleConnections([],pending,'other','2026-10-25')).toEqual([]);
 expect(visibleConnections([],pending,'trip','2026-10-26')).toEqual([]);
 const saved={...connection,versions:{from:1}};
 expect(visibleConnections([saved],pending,'trip','2026-10-25')).toEqual([saved]);
 expect(visibleConnections([],[],'trip','2026-10-25')).toEqual([]);
});
it('updates automatic lodging names across edits, preserves custom names and releases empty names',()=>{
 expect(lodgingName('Paris','London',isManualLodgingName({name:'Paris',nameSource:'location'}))).toBe('London');
 expect(lodgingName('Our cabin','London',isManualLodgingName({name:'Our cabin',nameSource:'custom'}))).toBe('Our cabin');
 for(const name of ['', '   '])expect(isManualLodgingName({name,nameSource:'custom'})).toBe(false);
 expect(lodgingName('','London',isManualLodgingName({name:'',nameSource:'custom'}))).toBe('London');
});
