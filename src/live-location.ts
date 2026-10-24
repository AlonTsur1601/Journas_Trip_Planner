import {useCallback,useEffect,useState} from 'react';
import {createLocationStabilizer} from './location-stability';

export type LiveLocation={lng:number;lat:number;accuracy:number};
export type LocationStatus='idle'|'pending'|'active'|'denied'|'unavailable';
/** A device-only watch, released as soon as the planner is left. */
export function useLiveLocation(enabled:boolean){
 const [position,setPosition]=useState<LiveLocation|null>(null);
 const [status,setStatus]=useState<LocationStatus>('idle');
 const [attempt,retry]=useState(0);
 const request=useCallback(()=>retry(value=>value+1),[]);
 useEffect(()=>{
  if(!enabled){setPosition(null);setStatus('idle');return;}
  if(!navigator.geolocation){setPosition(null);setStatus('unavailable');return;}
  let current=true;
  const stabilize=createLocationStabilizer();
  let latestTimestamp=-Infinity;
  setStatus('pending');
  const watch=navigator.geolocation.watchPosition(({coords,timestamp})=>{
   if(!current||timestamp<latestTimestamp)return;
   latestTimestamp=timestamp;
   const stable=stabilize({lng:coords.longitude,lat:coords.latitude,accuracy:coords.accuracy});
   if(stable){setPosition(stable);setStatus('active');}
  },error=>{if(current){setPosition(null);setStatus(error.code===1?'denied':'unavailable');}},
  {enableHighAccuracy:true,maximumAge:30000,timeout:15000});
  return()=>{current=false;navigator.geolocation.clearWatch(watch);};
 },[enabled,attempt]);
 return {position,status,request};
}
