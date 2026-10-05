import {ApiError, type Data} from './types.js';
const cache = new Map<string,{expires:number;places:Place[]}>();
const budgets = new Map<string,{minute:number;count:number}>();
type Place = {name:string;label:string;lng:number;lat:number};
export async function places(input:Data, uid:string):Promise<{places:Place[]}> {
  const reverse=input.action==='places.reverse';
  const url=new URL(reverse?'https://photon.komoot.io/reverse':'https://photon.komoot.io/api/');
  url.searchParams.set('lang','en');url.searchParams.set('limit',reverse?'1':'6');
  if(reverse){
    if(typeof input.lng!=='number'||typeof input.lat!=='number'||!Number.isFinite(input.lng)||!Number.isFinite(input.lat)||Math.abs(input.lng)>180||Math.abs(input.lat)>85)throw new ApiError(400,'INVALID_LOCATION','Choose a valid location.');
    url.searchParams.set('lon',String(input.lng));url.searchParams.set('lat',String(input.lat));url.searchParams.set('radius','0.1');
  }else{
    if(typeof input.query!=='string'||input.query.trim().length<2||input.query.length>200)throw new ApiError(400,'INVALID_SEARCH','Enter between 2 and 200 characters.');
    url.searchParams.set('q',input.query.trim());
  }
  const key=url.toString(),stored=cache.get(key);
  if(stored&&stored.expires>Date.now())return {places:stored.places};
  const minute=Math.floor(Date.now()/60000),budget=budgets.get(uid);
  const count=budget?.minute===minute?budget.count+1:1;
  if(count>40)throw new ApiError(429,'SEARCH_RATE_LIMIT','Please wait a moment before searching again.');
  budgets.set(uid,{minute,count});
  if(budgets.size>2000)for(const [id,value] of budgets)if(value.minute<minute)budgets.delete(id);
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','User-Agent':'Journas/1.0 (+https://journas-trip-planner.vercel.app)'}});
    if(!response.ok)throw new Error('Geocoder unavailable');
    const raw=await response.text();if(raw.length>200000)throw new Error('Oversized response');
    const data=JSON.parse(raw);
    const result:Place[]=(Array.isArray(data.features)?data.features:[]).slice(0,6).flatMap((feature:any)=>{
      const [lng,lat]=feature.geometry?.coordinates??[];
      if(!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lng)>180||Math.abs(lat)>85)return [];
      const p=feature.properties??{},text=(value:unknown)=>typeof value==='string'?value.slice(0,200):'';
      const street=[text(p.street),text(p.housenumber)].filter(Boolean).join(' ');
      const name=text(p.name)||street||text(p.city)||text(p.country)||'Unnamed location';
      const label=[name,street,text(p.city),text(p.state),text(p.country)].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ').slice(0,500);
      return [{name,label,lng,lat}];
    });
    if(cache.size>=500)cache.delete(cache.keys().next().value!);
    cache.set(key,{expires:Date.now()+600000,places:result});return {places:result};
  }catch{throw new ApiError(503,'SEARCH_UNAVAILABLE','Place search is unavailable. You can still choose a location on the map.');}
}
