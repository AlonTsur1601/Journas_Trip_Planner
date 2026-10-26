import {defaultLayout,type Layout,type Trip,type Day} from './types';
import {lodgingForDate} from './map-start';
export type RestoredDay={trip:Trip;date:string;day:Day;layout:Layout|null};
export function dayLayout(storage:Pick<Storage,'getItem'>,uid:string,tripId:string|undefined,date:string):Layout|null{
 if(!tripId)return null;
 try{const value=JSON.parse(storage.getItem(`journas-layout:${uid}:${tripId}:${date}`)??'null');return value&&Array.isArray(value.center)&&value.center.length===2&&value.center.every(Number.isFinite)&&Number.isFinite(value.zoom)?{...defaultLayout(),...value}:null;}catch{return null;}
}
/** A home screen's placeholder camera is never a saved planner view. */
export function screenLayout(screen:any,uid:string,tripId:string|undefined,date:string):Layout|null{
 return tripId&&screen?.uid===uid&&screen.home===false&&screen.tripId===tripId&&screen.date===date&&screen.layout?screen.layout:null;
}
export function restoredDayMatches(restore:RestoredDay|null|undefined,tripId:string|undefined,date:string){
 return Boolean(restore&&restore.trip.id===tripId&&restore.date===date);
}
export function fallbackDayLayout(trip:Trip|null,date:string):Layout{
 const lodging=lodgingForDate(trip,date);
 return {...defaultLayout(),...(lodging?{center:[lodging.lng,lodging.lat] as [number,number],zoom:14}:{})};
}
