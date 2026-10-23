import type {Pin,PinCopyOrigin} from './types';
export type CopiedPin={sourceTripId:string;sourceDate:string;sourceId:string;origin:PinCopyOrigin};
export function canPasteCopiedPin(clipboard:CopiedPin|null,tripId:string|null|undefined,date:string,pins:ReadonlyArray<Pick<Pin,'id'|'copyOrigin'>>){
 if(!clipboard||!tripId||date===clipboard.sourceDate||date===clipboard.origin.date)return false;
 return !pins.some(pin=>{const origin=pin.copyOrigin??{tripId,date,id:pin.id};return origin.tripId===clipboard.origin.tripId&&origin.date===clipboard.origin.date&&origin.id===clipboard.origin.id;});
}
