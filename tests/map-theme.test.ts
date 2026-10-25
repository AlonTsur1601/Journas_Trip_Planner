import {expect,it} from 'vitest';
import {mapStyleUrl,keepTripMapLayers} from '../src/map-theme';
import type {StyleSpecification} from 'maplibre-gl';
it('chooses a real dark style and preserves Liberty for light mode',()=>{
 expect(mapStyleUrl(true)).toBe('https://tiles.openfreemap.org/styles/dark');
 expect(mapStyleUrl(false)).toBe('https://tiles.openfreemap.org/styles/liberty');
});
it('keeps trip connections while replacing the base map without changing either input',()=>{
 const previous:StyleSpecification={version:8,sources:{old:{type:'geojson',data:{type:'FeatureCollection',features:[]}},'route-one':{type:'geojson',data:{type:'FeatureCollection',features:[]}}},layers:[{id:'old-base',type:'background'},{id:'route-one',type:'line',source:'route-one'},{id:'route-one:hit',type:'line',source:'route-one'}]};
 const next:StyleSpecification={version:8,sources:{new:{type:'geojson',data:{type:'FeatureCollection',features:[]}}},layers:[{id:'new-base',type:'background'}]};
 const merged=keepTripMapLayers(previous,next);
 expect(Object.keys(merged.sources)).toEqual(['new','route-one']);
 expect(merged.layers.map(layer=>layer.id)).toEqual(['new-base','route-one','route-one:hit']);
 expect(previous.layers.length).toBe(3);expect(next.layers.length).toBe(1);
});
it('handles a style change before any previous trip layers exist',()=>{
 const next:StyleSpecification={version:8,sources:{},layers:[]};
 expect(keepTripMapLayers(undefined,next)).toEqual(next);
});
