import type {HomeState,HomeTarget,Trip,TripAppearance} from './types';
export const emptyHome=():HomeState=>({recentTrips:[],recentDays:[],pins:[]});
export const targetKey=(target:HomeTarget)=>`${target.tripId??''}:${target.date??''}`;
export function recordVisit(state:HomeState,target:HomeTarget):HomeState{
 return {...state,recentTrips:target.tripId?[target.tripId,...state.recentTrips.filter(id=>id!==target.tripId)].slice(0,100):state.recentTrips,recentDays:target.tripId&&target.date?[target,...state.recentDays.filter(day=>targetKey(day)!==targetKey(target))].slice(0,100):state.recentDays};
}
export function availableHome(state:HomeState,trips:Trip[]):HomeState{
 const ids=new Set(trips.map(trip=>trip.id));const valid=(target:HomeTarget)=>!target.tripId||ids.has(target.tripId)&&(!target.date||trips.some(trip=>trip.id===target.tripId&&target.date!>=trip.startDate&&target.date!<=trip.endDate));
 return {recentTrips:state.recentTrips.filter(id=>ids.has(id)),recentDays:state.recentDays.filter(valid),pins:state.pins.filter(valid)};
}
const colors=['#7c5ce7','#2563eb','#0891b2','#059669','#ca8a04','#ea580c','#dc2626','#db2777','#64748b','#475569'];
const symbols=['stay','peak','coffee','museum','garden','flight','boat','view','walk','coast'];
export function randomTripAppearance():TripAppearance {const values=crypto.getRandomValues(new Uint32Array(2));return {color:colors[values[0]%colors.length],symbol:`icon:${symbols[values[1]%symbols.length]}`,mode:'symbol',image:''};}
export const tripAppearance=(trip:Trip):TripAppearance=>trip.appearance??{color:'#7c5ce7',symbol:'icon:flight',mode:'symbol',image:''};
