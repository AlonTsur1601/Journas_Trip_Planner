import type {Pin} from './types';
export const previewPinId='location-preview-draft';
export function locationPreviewPins(context:Pin[],editingId:string|undefined,value:{lng:number;lat:number;name?:string}|undefined,color:string,symbol:string):Pin[]{
 const pins=context.filter(pin=>pin.id!==editingId);
 return value?[...pins,{id:editingId??previewPinId,title:value.name??'',note:'',color,symbol,lng:value.lng,lat:value.lat,versions:{}}]:pins;
}
