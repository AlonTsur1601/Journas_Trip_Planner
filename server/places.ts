import {ApiError, type Data} from './types.js';
import {setTimeout as delay} from 'node:timers/promises';
const cache = new Map<string,{expires:number;places:Place[]}>();
const budgets = new Map<string,{minute:number;count:number}>();
type Place = {name:string;label:string;lng:number;lat:number;sourceUrl?:string;detail?:string};
export async function places(input:Data, uid:string):Promise<{places:Place[]}> {
  const reverse=input.action==='places.reverse';
  const landmark=input.action==='places.landmarks';
  const query=typeof input.query==='string'?input.query.trim():'';
  const ordinals:Record<string,string>={first:'1st',second:'2nd',third:'3rd',fourth:'4th',fifth:'5th',sixth:'6th',seventh:'7th',eighth:'8th',ninth:'9th',tenth:'10th'};
  const searchQuery=query.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?=\s+(?:avenue|street|road|lane|boulevard)\b)/gi,word=>ordinals[word.toLowerCase()]);
  const houseNumber=query.split(/\s+/).find(word=>/^\d{1,5}[a-zא-ת]?$/i.test(word));
  const language=/\p{Script=Hebrew}/u.test(query)?'he':/\p{Script=Arabic}/u.test(query)?'ar':/\p{Script=Cyrillic}/u.test(query)?'ru':'en';
  const url=new URL(landmark?`https://${language}.wikipedia.org/w/api.php`:reverse?'https://photon.koalasec.org/reverse':'https://photon.koalasec.org/api');
  url.searchParams.set('lang','en');url.searchParams.set('limit',reverse?'1':'20');
  if(reverse){
    if(typeof input.lng!=='number'||typeof input.lat!=='number'||!Number.isFinite(input.lng)||!Number.isFinite(input.lat)||Math.abs(input.lng)>180||Math.abs(input.lat)>85)throw new ApiError(400,'INVALID_LOCATION','Choose a valid location.');
    url.searchParams.set('lon',String(input.lng));url.searchParams.set('lat',String(input.lat));url.searchParams.set('radius','0.1');
  }else{
    if(typeof input.query!=='string'||input.query.trim().length<2||input.query.length>200)throw new ApiError(400,'INVALID_SEARCH','Enter between 2 and 200 characters.');
    url.searchParams.set('q',searchQuery);
    if(landmark){url.search='';for(const [k,v] of Object.entries({action:'query',generator:'search',gsrsearch:query,gsrlimit:'6',prop:'coordinates|description',colimit:'max',format:'json',formatversion:'2'}))url.searchParams.set(k,v);}
  }
  const key=url.toString(),stored=cache.get(key);
  if(stored&&stored.expires>Date.now())return {places:stored.places};
  const minute=Math.floor(Date.now()/60000),budget=budgets.get(uid);
  const count=budget?.minute===minute?budget.count+1:1;
  if(count>120)throw new ApiError(429,'SEARCH_RATE_LIMIT','Please wait a moment before searching again.');
  budgets.set(uid,{minute,count});
  if(budgets.size>2000)for(const [id,value] of budgets)if(value.minute<minute)budgets.delete(id);
  try{
    if(landmark){
      const response=await fetch(url,{signal:AbortSignal.timeout(4000),headers:{Accept:'application/json','User-Agent':'Journas/1.0 (+https://journas-trip-planner.vercel.app)'}});
      if(!response.ok)throw new Error('Landmark search unavailable');
      const raw=await response.text();if(raw.length>200000)throw new Error('Oversized response');
      const data=JSON.parse(raw);
      const result:Place[]=(Array.isArray(data.query?.pages)?data.query.pages:[]).sort((a:any,b:any)=>a.index-b.index).flatMap((page:any)=>{
        const point=page.coordinates?.find((c:any)=>c.primary&&c.globe==='earth');
        if(!point||!Number.isFinite(point.lon)||!Number.isFinite(point.lat)||Math.abs(point.lon)>180||Math.abs(point.lat)>85||typeof page.title!=='string')return [];
        const name=page.title.slice(0,200),description=typeof page.description==='string'?page.description.slice(0,300):'';
        return [{name,label:[name,description].filter(Boolean).join(', '),lng:point.lon,lat:point.lat,sourceUrl:`https://${language}.wikipedia.org/?curid=${Number(page.pageid)}`}];
      });
      if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+600000,places:result});return {places:result};
    }
    const compatibleAddress=(feature:any)=>{
      const p=feature.properties??{};
      if(!reverse&&houseNumber&&p.housenumber&&String(p.housenumber).toLowerCase()!==houseNumber.toLowerCase()){
        const range=String(p.housenumber).match(/^(\d+)-(\d+)$/);
        if(!range||!/^\d+$/.test(houseNumber)||Number(houseNumber)<Number(range[1])||Number(houseNumber)>Number(range[2]))return false;
      }
      if(reverse||!p.housenumber||!/\d/.test(query)||!/^[\x00-\x7f]+$/.test(query)||typeof p.street!=='string')return true;
      const phonetic=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g,'').replace(/[aeiouy]/g,'').split(/\s+/).filter(s=>s.length>=3);
      const streetWords=phonetic(p.street),queryWords=phonetic(searchQuery);
      return !streetWords.length||streetWords.some(word=>queryWords.includes(word))||(typeof p.name==='string'&&query.toLowerCase().includes(p.name.toLowerCase()));
    };
    const request=async(target:URL,timeout:number,signal?:AbortSignal,requireMatches=false)=>{
      const response=await fetch(target,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),headers:{Accept:'application/json','User-Agent':'Journas/1.0 (+https://journas-trip-planner.vercel.app)'}});
      if(!response.ok)throw new Error('Geocoder unavailable');
      const raw=await response.text();if(raw.length>200000)throw new Error('Oversized response');
      const data=JSON.parse(raw);if(!Array.isArray(data.features))throw new Error('Invalid geocoder response');
      data.features=data.features.filter(compatibleAddress);if(requireMatches&&!data.features.length)throw new Error('No geocoder matches');return data;
    };
    let data:any;
    {
      const controller=new AbortController();
      try{
        data=await Promise.any([request(url,3000,controller.signal,true),(async()=>{
          await delay(200,undefined,{signal:controller.signal});
          const backup=new URL(url);backup.hostname='photon.donsomhong.net';return request(backup,3000,controller.signal,true);
        })()]);
      }catch{const fallback=new URL(url);fallback.hostname='photon.komoot.io';data=await request(fallback,15000);}
      finally{controller.abort();}
    }
    const seen=new Set<string>();
    const result:Place[]=(Array.isArray(data.features)?data.features:[]).slice(0,20).flatMap((feature:any)=>{
      const [lng,lat]=feature.geometry?.coordinates??[];
      if(!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lng)>180||Math.abs(lat)>85)return [];
      const p=feature.properties??{},text=(value:unknown)=>typeof value==='string'?value.slice(0,200):'';
      const street=[text(p.street),text(p.housenumber)].filter(Boolean).join(' ');
      const name=text(p.name)||street||text(p.city)||text(p.country)||'Unnamed location';
      const addressNote=!reverse&&houseNumber&&!p.housenumber&&(p.type==='street'||p.street)?'Street only; exact house number not found':'';
      const label=[name,street,text(p.city),text(p.state),text(p.country),addressNote].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ').slice(0,500);
      const identity=label.toLowerCase();if(seen.has(identity))return [];seen.add(identity);
      const detail=[street!==name?street:'',text(p.city)||text(p.state),text(p.country),addressNote?'Street only; no house number':''].filter(Boolean).join(' · ');
      return [{name,label,detail,lng,lat}];
    });
    if(cache.size>=500)cache.delete(cache.keys().next().value!);
    cache.set(key,{expires:Date.now()+600000,places:result});return {places:result};
  }catch{throw new ApiError(503,'SEARCH_UNAVAILABLE','Place search is unavailable. You can still choose a location on the map.');}
}
