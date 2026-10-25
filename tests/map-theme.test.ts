import {expect,it} from 'vitest';
import {mapStyleUrl,keepTripMapLayers} from '../src/map-theme';
import type {StyleSpecification} from 'maplibre-gl';
import {readFileSync} from 'node:fs';
it('ships a colorful night palette with distinct water, greenery, roads and buildings',()=>{
 const style=JSON.parse(readFileSync(new URL('../public/map-liberty-night.json',import.meta.url),'utf8')) as StyleSpecification;
 const paint=(id:string)=>style.layers.find(layer=>layer.id===id)?.paint as Record<string,unknown>;
 expect(paint('water')['fill-color']).toBe('#244f7c');
 expect(paint('park')['fill-color']).toBe('#36634b');
 expect(paint('landuse_hospital')['fill-color']).toBe('#684456');
 expect(paint('landuse_school')['fill-color']).toBe('#655f40');
 expect(paint('road_motorway')['line-color']).toBe('#d58b59');
 expect(paint('building')['fill-color']).toBe('#4d5264');
 expect(style.sprite).toBeTruthy();expect(style.glyphs).toBeTruthy();
});
it('chooses a real dark style and preserves Liberty for light mode',()=>{
 expect(mapStyleUrl(true)).toBe('/map-liberty-night.json');
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

