import {lazy,Suspense,useEffect,useId,useRef,useState} from 'react';
import {Search,MapPin} from 'lucide-react';
import {api} from './firebase';
import {defaultLayout} from './types';
import type {Layout} from './types';
const MapPanel=lazy(()=>import('./MapPanel'));
export type Place={name:string;label:string;lng:number;lat:number};
export default function LocationPicker({value,onChange,mapPlacement=true,onMapPlacementChange,initialView,color='#7c5ce7',symbol='icon:stay',disabled=false}:{value?:{lng:number;lat:number;name?:string};onChange:(place:Place,source:'search'|'map'|'reverse')=>void;mapPlacement?:boolean;onMapPlacementChange?:(checked:boolean)=>void;initialView?:Layout;color?:string;symbol?:string;disabled?:boolean}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Place[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[active,setActive]=useState(-1),[open,setOpen]=useState(false),[label,setLabel]=useState(value?.name??'');
 const [view,setView]=useState<Layout>(()=>({...defaultLayout(),...initialView,...(value?{center:[value.lng,value.lat] as [number,number],zoom:15}:{})}));
 const searchedPoint=useRef<string|null>(null),mapPicked=useRef(false);
 const generation=useRef(0),latest=useRef(onChange);latest.current=onChange;const listId=useId();
 useEffect(()=>{const run=++generation.current;setResults([]);setActive(-1);setError('');setBusy(false);if(!open||query.trim().length<2)return;setBusy(true);
  const timer=setTimeout(()=>{setBusy(true);api<{places:Place[]}>('places.search',{query:query.trim()}).then(r=>{if(run===generation.current)setResults(r.places);}).catch(e=>{if(run===generation.current)setError(e.message);}).finally(()=>{if(run===generation.current)setBusy(false);});},600);
  return()=>{clearTimeout(timer);generation.current++;};
 },[query,open]);
 useEffect(()=>{if(!value)return;if(searchedPoint.current===`${value.lng},${value.lat}`){searchedPoint.current=null;return;}let cancelled=false;setLabel(value.name??'Looking up location…');api<{places:Place[]}>('places.reverse',{lng:value.lng,lat:value.lat}).then(r=>{if(cancelled)return;const found=r.places[0];const place={name:found?.name??'Unnamed location',label:found?.label??'Unnamed location',lng:value.lng,lat:value.lat};setLabel(place.label);if(mapPicked.current){setQuery(place.label);mapPicked.current=false;}latest.current(place,'reverse');}).catch(()=>{if(!cancelled)setLabel(value.name||'Unnamed location');});return()=>{cancelled=true;};},[value?.lng,value?.lat]);
 function choose(place:Place){searchedPoint.current=`${place.lng},${place.lat}`;mapPicked.current=false;generation.current++;setQuery(place.label);setLabel(place.label);setResults([]);setOpen(false);setView(v=>({...v,center:[place.lng,place.lat],zoom:15}));onChange(place,'search');}
 return <div className="location-picker">
  {onMapPlacementChange&&<label className="location-mode"><input type="checkbox" checked={mapPlacement} disabled={disabled} onChange={e=>onMapPlacementChange(e.target.checked)}/>Place pin on map</label>}
  {(!onMapPlacementChange||!mapPlacement)&&<div className="place-search"><label className="field"><span>Search location</span><div className="place-search-input"><Search size={17}/><input aria-label="Search location" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={active>=0?`${listId}-${active}`:undefined} value={query} maxLength={200} placeholder="Place, street or address" disabled={disabled} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,Math.min(results.length-1,a+(e.key==='ArrowDown'?1:-1))));}if(e.key==='Enter'){e.preventDefault();if(open&&results[active>=0?active:0])choose(results[active>=0?active:0]);}}}/></div></label>
   {open&&<div className="place-results" id={listId} role="listbox" aria-label="Matching locations">{busy?<div role="status">Searching…</div>:error?<div role="status">{error}</div>:results.length?results.map((place,i)=><button type="button" role="option" aria-selected={active===i} id={`${listId}-${i}`} key={`${place.lng},${place.lat},${i}`} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(place)}><MapPin size={16}/><span><strong>{place.name}</strong><small>{place.label}</small></span></button>):query.trim().length>=2?<div role="status">No matching locations.</div>:null}</div>}
  </div>}
  <div className="location-preview"><Suspense fallback={<div>Loading map…</div>}><MapPanel layout={view} pins={value?[{id:'location',title:value.name??label,note:'',color,symbol,lng:value.lng,lat:value.lat,versions:{}}]:[]} connections={[]} readonly={disabled||!mapPlacement} placementMode onPin={()=>{}} onView={(center,zoom)=>setView(v=>({...v,center,zoom}))} onAdd={(lng,lat)=>{mapPicked.current=true;generation.current++;setOpen(false);setQuery('');setLabel('Looking up location…');onChange({lng,lat,name:'Unnamed location',label:'Unnamed location'},'map');}}/></Suspense></div>
  <small className="location-selected">{value?label:mapPlacement?'Click the map to choose a location.':'Select a matching location to place your pin.'}</small>
  <small className="location-credit"><a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></small>
 </div>;
}
