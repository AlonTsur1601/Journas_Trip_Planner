import {locationPreviewPins,previewPinId} from './location-preview';
import {SearchInput} from './SearchInput';
import {MotionSurface} from "./MotionSurface";
import {lazy,Suspense,useEffect,useId,useRef,useState,useMemo} from 'react';
import {Search,MapPin} from 'lucide-react';
import {api} from './firebase';
import {defaultLayout} from './types';
import type {Layout,Pin,Connection} from './types';
const noPins:Pin[]=[],noConnections:Connection[]=[];
const MapPanel=lazy(()=>import('./MapPanel'));
export type Place={name:string;label:string;lng:number;lat:number;sourceUrl?:string;detail?:string};
export default function LocationPicker({contextPins=noPins,contextConnections=noConnections,editingPinId,value,onChange,mapPlacement=true,onMapPlacementChange,initialView,color='#7c5ce7',symbol='icon:stay',disabled=false,showHints=true}:{contextPins?:Pin[];contextConnections?:Connection[];editingPinId?:string;value?:{lng:number;lat:number;name?:string};onChange:(place:Place,source:'search'|'map'|'reverse')=>void;mapPlacement?:boolean;onMapPlacementChange?:(checked:boolean)=>void;initialView?:Layout;color?:string;symbol?:string;disabled?:boolean;showHints?:boolean}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Place[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[active,setActive]=useState(-1),[open,setOpen]=useState(false),[label,setLabel]=useState(value?.name??'');
 const [view,setView]=useState<Layout>(()=>({...defaultLayout(),...initialView,...(value?{center:[value.lng,value.lat] as [number,number],zoom:15}:{})}));
 const previewPins=useMemo(()=>locationPreviewPins(contextPins,editingPinId,value,color,symbol),[contextPins,editingPinId,value?.lng,value?.lat,value?.name,color,symbol]);
 const searchedPoint=useRef<string|null>(null),mapPicked=useRef(false);
 const generation=useRef(0),latest=useRef(onChange);latest.current=onChange;const listId=useId();
 const searchCache=useRef(new Map<string,Place[]>());
 useEffect(()=>{const run=++generation.current,key=query.trim().toLowerCase();setActive(-1);setError('');setBusy(false);if(!open||key.length<2){setResults([]);return;}
  const cached=searchCache.current.get(key);
  if(cached){setResults(cached);return;}
  setResults(previous=>previous.filter(place=>place.label.toLowerCase().includes(key)));setBusy(true);
  const controller=new AbortController();
  let found:Place[]=[],completed=0,failures=0,lastError='';
  const actions=['places.search',...(!/\d/.test(key)&&key.length>=3?['places.landmarks']:[])];
  for(const action of actions)void api<{places:Place[]}>(action,{query:query.trim()},controller.signal).then(r=>{if(run!==generation.current)return;
    found=[...found,...r.places];
    const normalized=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu,'');
    const score=(p:Place)=>{const name=normalized(p.name),q=normalized(key);return (name===q?100:name.startsWith(q)?50:name.includes(q)?25:0)+(p.sourceUrl?10:0);};
    found.sort((a,b)=>score(b)-score(a));
    found=found.filter((place,i,all)=>!all.slice(0,i).some(other=>normalized(other.name)===normalized(place.name)&&Math.abs(other.lng-place.lng)<.001&&Math.abs(other.lat-place.lat)<.001));
    setResults([...found]);setError('');
  }).catch(e=>{if(!controller.signal.aborted&&run===generation.current){failures++;lastError=e.message;}}).finally(()=>{if(run!==generation.current)return;if(++completed===actions.length){setBusy(false);if(failures===actions.length)setError(lastError);else{if(searchCache.current.size>=100)searchCache.current.delete(searchCache.current.keys().next().value!);searchCache.current.set(key,found);}}});
  return()=>{controller.abort();generation.current++;};
 },[query,open]);
 useEffect(()=>{if(!value)return;if(searchedPoint.current===`${value.lng},${value.lat}`){searchedPoint.current=null;return;}let cancelled=false;const coordinates=`${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`;setLabel('');api<{places:Place[]}>('places.reverse',{lng:value.lng,lat:value.lat}).then(r=>{if(cancelled)return;const found=r.places[0];const place={name:found?.name??'Unnamed location',label:found?.label??coordinates,lng:value.lng,lat:value.lat};setLabel(place.label);if(mapPicked.current){setQuery(place.label);mapPicked.current=false;}latest.current(place,'reverse');}).catch(()=>{if(cancelled)return;setLabel('');if(mapPicked.current){setQuery('');mapPicked.current=false;}});return()=>{cancelled=true;};},[value?.lng,value?.lat]);
 function choose(place:Place){searchedPoint.current=`${place.lng},${place.lat}`;mapPicked.current=false;generation.current++;setQuery(place.label);setLabel(place.label);setResults([]);setOpen(false);setView(v=>({...v,center:[place.lng,place.lat],zoom:15}));onChange(place,'search');}
 return <div className="location-picker">
  {onMapPlacementChange&&<label className="location-mode"><input type="checkbox" checked={mapPlacement} disabled={disabled} onChange={e=>onMapPlacementChange(e.target.checked)}/>Place pin on map</label>}
  {(!onMapPlacementChange||!mapPlacement)&&<div className="place-search"><label className="field"><div className="place-search-input"><Search size={17}/><SearchInput aria-label="Search location" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={active>=0?`${listId}-${active}`:undefined} value={query} maxLength={200} placeholder="Place, street or address" disabled={disabled} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onValueChange={value=>{mapPicked.current=false;setQuery(value);setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,Math.min(results.length-1,a+(e.key==='ArrowDown'?1:-1))));}if(e.key==='Enter'){e.preventDefault();if(open&&results[active>=0?active:0])choose(results[active>=0?active:0]);}}}/></div></label>
   {open&&<MotionSurface><div className="place-results" id={listId} role="listbox" aria-label="Matching locations">{results.length?results.map((place,i)=><button type="button" role="option" aria-selected={active===i} id={`${listId}-${i}`} key={`${place.lng},${place.lat},${i}`} title={place.label} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(place)}><MapPin size={16}/><span><strong>{place.name}</strong><small>{place.detail??(place.label.startsWith(place.name+', ')?place.label.slice(place.name.length+2):place.label)}</small></span></button>):busy?<div role="status">Searching…</div>:error?<div role="status">{error}</div>:query.trim().length>=2?<div role="status">No matching locations.</div>:null}</div></MotionSurface>}
  </div>}
  <div className="location-preview"><Suspense fallback={<div>Loading map…</div>}><MapPanel layout={view} pins={previewPins} connections={contextConnections} readonly={disabled||!mapPlacement} placementMode placementPinId={editingPinId??previewPinId} onPin={()=>{}} onView={(center,zoom)=>setView(v=>({...v,center,zoom}))} onAdd={(lng,lat)=>{mapPicked.current=true;searchedPoint.current=null;generation.current++;setOpen(false);const coordinates=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;setQuery('');setLabel('');onChange({lng,lat,name:'Unnamed location',label:coordinates},'map');}}/></Suspense></div>
  {<small className="location-selected">{value?label:showHints?(mapPlacement?'Click the map to choose a location.':'Select a matching location to place your pin.'):''}</small>}
  {showHints&&<small className="location-credit"><a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></small>}
 </div>;
}
