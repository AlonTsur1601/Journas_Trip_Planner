import type {StyleSpecification} from 'maplibre-gl';

export const mapStyleUrl=(dark:boolean)=>dark?'/map-liberty-night.json':'https://tiles.openfreemap.org/styles/liberty';

/** Switching the base map must keep the trip's connection layers and sources. */
export function keepTripMapLayers(previous:StyleSpecification|undefined,next:StyleSpecification):StyleSpecification{
 const sources=Object.fromEntries(Object.entries(previous?.sources??{}).filter(([id])=>id.startsWith('route-')));
 const layers=(previous?.layers??[]).filter(layer=>layer.id.startsWith('route-'));
 return{...next,sources:{...next.sources,...sources},layers:[...next.layers,...layers]};
}

