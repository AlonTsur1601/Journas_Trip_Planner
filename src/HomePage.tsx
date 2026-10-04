import {useEffect,useRef,useState,type ReactNode} from 'react';

import {ArrowUpRight,CalendarDays,Compass,Settings,Pin,Plus,MoreHorizontal,Trash2,X,LogOut,ChevronDown} from 'lucide-react';

import {Dropdown} from './Controls';

import {DateField,SymbolIcon} from './PlannerControls';

import {targetKey,tripAppearance} from './home-state';

import type {HomeState,HomeTarget,Settings as Preferences,Trip} from './types';



export function TripBadge({trip}: {trip:Trip}){const look=tripAppearance(trip);return <span className="trip-badge" style={{background:look.color}}>{look.mode==='image'&&look.image?<img src={look.image} alt=""/>:<SymbolIcon value={look.symbol}/>}</span>;}

const dateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

export default function HomePage({trips,state,preferences,name,avatar,resume,busy,onOpen,onUpdate,onCreate,onEdit,onDelete,onSettings,onLogout,onMessage}:{trips:Trip[];state:HomeState;preferences:Preferences;name:string;avatar:ReactNode;resume:HomeTarget|null;busy:boolean;onOpen:(target:HomeTarget)=>void;onUpdate:(state:HomeState)=>void;onCreate:()=>void;onEdit:(trip:Trip)=>void;onDelete:(trip:Trip)=>void;onSettings:()=>void;onLogout:()=>void;onMessage:(message:string)=>void}){

 const [showAll,setShowAll]=useState(false),[creator,setCreator]=useState(false),[kind,setKind]=useState('trip'),[selected,setSelected]=useState(''),[selectedDate,setSelectedDate]=useState(new Date().toLocaleDateString('en-CA'));

 const [menu,setMenu]=useState<{target:HomeTarget;source:'trip'|'day'|'pin'|'resume';x:number;y:number}|null>(null);const menuRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{if(!menu)return;const outside=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setMenu(null);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(null);};window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);};},[menu]);

 const find=(id:string|null)=>trips.find(trip=>trip.id===id);

 const addPin=(target:HomeTarget)=>{if(state.pins.some(pin=>targetKey(pin)===targetKey(target))){onMessage('Already pinned.');return;}if(state.pins.length>=9){onMessage('You can pin up to nine items. Remove a pin to make room.');return;}onUpdate({...state,pins:[...state.pins,target]});setMenu(null);};

 const context=(event:React.MouseEvent,target:HomeTarget,source:'trip'|'day'|'pin'|'resume')=>{event.preventDefault();setMenu({target,source,x:Math.max(8,Math.min(event.clientX,innerWidth-238)),y:Math.max(8,Math.min(event.clientY,innerHeight-238))});};

 const warning=(trip:Trip)=>{if(!preferences.autoDelete)return '';const until=Date.parse(`${trip.endDate}T23:59:59.999Z`)+preferences.retentionDays*86400000-Date.now();if(until>30*86400000)return '';return until<=0?'Scheduled for removal from your account':`Removed from your account in ${Math.max(1,Math.ceil(until/86400000))} ${Math.ceil(until/86400000)===1?'day':'days'}`;};

 const recent=state.recentTrips.map(id=>find(id)).filter(Boolean) as Trip[];

 const visibleTrips=showAll?[...recent,...trips.filter(trip=>!state.recentTrips.includes(trip.id))]:recent.slice(0,6);

 const chosen=find(selected);const menuTrip=find(menu?.target.tripId??null);

 const tile=(target:HomeTarget,source:'trip'|'day'|'pin',key:string)=>{const trip=find(target.tripId),label=target.date?dateLabel(target.date):trip?.name??'Date';return <div className={`home-tile ${source==='pin'?'pinned-tile':''}`} key={key} onContextMenu={event=>context(event,target,source)}><button className="home-tile-main" disabled={busy} onClick={()=>onOpen(target)}>{trip?<TripBadge trip={trip}/>:<span className="trip-badge date-badge"><CalendarDays size={22}/></span>}<span><strong>{label}</strong>{target.date&&trip&&<small>{trip.name}</small>}{!target.date&&trip&&<small>{dateLabel(trip.startDate)} — {dateLabel(trip.endDate)}</small>}{trip&&warning(trip)&&<small className="removal-warning">{warning(trip)}</small>}</span><ArrowUpRight size={18}/></button><button className="home-tile-menu icon" aria-label={`Options for ${label}${target.date&&trip?' in '+trip.name:''}`} onClick={event=>{const box=event.currentTarget.getBoundingClientRect();setMenu({target,source,x:Math.max(8,Math.min(box.right-226,innerWidth-238)),y:Math.max(8,Math.min(box.bottom,innerHeight-238))});}}><MoreHorizontal size={17}/></button></div>;};

 return <main className="home-page"><div className="auth-map-background" aria-hidden="true"/><div className="home-content">

  <div className="home-masthead"><div className="brand home-brand"><Compass/><strong>Journas</strong></div><div className="home-account">{avatar}<span><strong>{name}</strong></span><button className="icon" aria-label="Settings" title="Settings" onClick={onSettings}><Settings size={21}/></button><button className="icon" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={20}/></button></div></div>

  <section className="home-intro"><h1>Where will you go next?</h1><p>Pick up your plans or start a new trip.</p><div className="home-primary-actions"><button className="home-continue" disabled={busy} onContextMenu={event=>{if(resume)context(event,resume,'resume');}} onClick={()=>onOpen(resume??{tripId:null,date:null})}><span><strong>{busy?'Opening your plan…':'Continue where you left off'}</strong>{resume&&find(resume.tripId)&&<small>{find(resume.tripId)!.name}{resume.date?', '+dateLabel(resume.date):''}</small>}</span><ArrowUpRight size={26}/></button><button className="button home-create" disabled={trips.length>=100} onClick={onCreate}><Plus size={18}/>Create trip</button></div></section>

  <section className="home-section"><div className="home-section-heading"><h2><Pin size={18}/>Pins <span className="pins-remaining">{9-state.pins.length} remaining</span></h2></div><div className="home-pins">{state.pins.map((target,index)=>tile(target,'pin',String(index)))}{state.pins.length<9&&<button className="home-pin-create" onClick={()=>{setSelected(trips[0]?.id??'');setKind(trips.length?'trip':'date');setCreator(true);}}><Plus size={20}/><span>Create pin</span></button>}</div></section>

  <div className="home-recents"><section className="home-section"><div className="home-section-heading"><h2>Recent dates</h2></div><div className="home-list">{state.recentDays.slice(0,6).map(target=>tile(target,'day',targetKey(target)))}{!state.recentDays.length&&<p className="home-list-empty">Dates you open while planning will appear here.</p>}</div></section><section className="home-section"><div className="home-section-heading"><h2>{showAll?'All trips':'Recent trips'}</h2>{trips.length>0&&<button className="text-button" onClick={()=>setShowAll(!showAll)}>{showAll?'Show recent':'Show all'}<ChevronDown size={15} style={showAll?{transform:'rotate(180deg)'}:undefined}/></button>}</div><div className="home-list">{visibleTrips.map(trip=>tile({tripId:trip.id,date:null},'trip',trip.id))}{!visibleTrips.length&&<p className="home-list-empty">{trips.length?'Open a trip to keep it close at hand.':'Your trips will appear here once you create one.'}</p>}</div></section></div>

 </div>

 {menu&&<div className="home-context-menu" role="menu" ref={menuRef} style={{left:menu.x,top:menu.y}}>{menu.source==='pin'?<button role="menuitem" onClick={()=>{onUpdate({...state,pins:state.pins.filter(target=>targetKey(target)!==targetKey(menu.target))});setMenu(null);}}><X size={16}/>Remove pin</button>:<button role="menuitem" disabled={state.pins.length>=9||state.pins.some(target=>targetKey(target)===targetKey(menu.target))} onClick={()=>addPin(menu.target)}><Pin size={16}/>Add to pins</button>}{menu.source==='day'&&<button role="menuitem" onClick={()=>{onUpdate({...state,recentDays:state.recentDays.filter(target=>targetKey(target)!==targetKey(menu.target))});setMenu(null);}}><X size={16}/>Remove from recent dates</button>}{menu.source==='trip'&&menuTrip&&<><button role="menuitem" onClick={()=>{onUpdate({...state,recentTrips:state.recentTrips.filter(id=>id!==menuTrip.id)});setMenu(null);}}><X size={16}/>Remove from recent trips</button><button role="menuitem" onClick={()=>{onEdit(menuTrip);setMenu(null);}}><Settings size={16}/>Trip settings</button><button role="menuitem" className="danger" onClick={()=>{onDelete(menuTrip);setMenu(null);}}><Trash2 size={16}/>Delete trip</button></>}</div>}

 {creator&&<div className="modal-shade" onMouseDown={event=>{if(event.target===event.currentTarget)setCreator(false);}}><section className="modal home-pin-modal" role="dialog" aria-modal="true" aria-label="Create pin"><header><h2>Create pin</h2><button className="icon" aria-label="Close" onClick={()=>setCreator(false)}><X size={20}/></button></header><form onSubmit={event=>{event.preventDefault();addPin({tripId:kind==='date'?null:selected,date:kind==='trip'?null:selectedDate});setCreator(false);}}><div className="field"><span>Pin type</span><Dropdown aria-label="Pin type" value={kind} onChange={(event:any)=>{setKind(event.target.value);if(chosen)setSelectedDate(chosen.startDate);}}><option value="trip" disabled={!trips.length}>Trip</option><option value="trip-date" disabled={!trips.length}>Date in a trip</option><option value="date">Date without a trip</option></Dropdown></div>{kind!=='date'&&<div className="field"><span>Trip</span><Dropdown aria-label="Pinned trip" value={selected} onChange={(event:any)=>{setSelected(event.target.value);setSelectedDate(find(event.target.value)?.startDate??selectedDate);}}>{trips.map(trip=><option key={trip.id} value={trip.id}>{trip.name}</option>)}</Dropdown></div>}{kind!=='trip'&&<DateField label="Pinned date" value={selectedDate} min={kind==='trip-date'?chosen?.startDate:undefined} max={kind==='trip-date'?chosen?.endDate:undefined} required onChange={(event:any)=>setSelectedDate(event.target.value)}/>}<button className="button primary full" disabled={state.pins.length>=9}>Create pin</button></form></section></div>}

 </main>;

}

