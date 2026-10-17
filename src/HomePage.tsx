import {MotionSurface} from "./MotionSurface";
import {useEffect,useRef,useState,type ReactNode,type CSSProperties,type SyntheticEvent} from 'react';

import {CalendarDays,Compass,Settings,Pin,Plus,MoreHorizontal,Trash2,X,LogOut,ChevronDown} from 'lucide-react';

import {Dropdown} from './Controls';

import {DateField,SymbolIcon} from './PlannerControls';

import {targetKey,tripAppearance} from './home-state';

import type {HomeState,HomeTarget,Settings as Preferences,Trip} from './types';



const imageTints=new Map<string,string>();
function applyImageTint(event:SyntheticEvent<HTMLImageElement>){
 const image=event.currentTarget,tile=image.closest<HTMLElement>('.home-tile,.home-resume-card');
 if(!tile)return;
 let color=imageTints.get(image.src);
 if(!color){
  try{
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
   const context=canvas.getContext('2d');if(!context)return;
   context.drawImage(image,0,0,32,32);
   const pixels=context.getImageData(0,0,32,32).data;
   let r=0,g=0,b=0,weight=0;
   for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;r+=pixels[i]*alpha;g+=pixels[i+1]*alpha;b+=pixels[i+2]*alpha;weight+=alpha;}
   if(!weight)return;
   color=`rgb(${Math.round(r/weight)}, ${Math.round(g/weight)}, ${Math.round(b/weight)})`;
   imageTints.set(image.src,color);
  }catch{return;}
 }
 tile.style.setProperty('--trip-tint',color);
}

export function TripBadge({trip}: {trip:Trip}){const look=tripAppearance(trip);return <span className="trip-badge" style={{background:look.color}}>{look.mode==='image'&&look.image?<img src={look.image} alt="" onLoad={applyImageTint}/>:<SymbolIcon value={look.symbol}/>}</span>;}

const homeDateFormat=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'});
const dateLabel=(date:string)=>homeDateFormat.format(new Date(`${date}T12:00:00`));
const dateRangeLabel=(start:string,end:string)=>`${dateLabel(start)} - ${dateLabel(end)}`;
function TripListDialog({children,onClose}:{children:ReactNode;onClose:()=>void}){
 const box=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;box.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>previous?.focus();},[]);
 return <MotionSurface><div className="modal-shade" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={box} className="modal all-trips-modal" role="dialog" aria-modal="true" aria-label="All trips" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const buttons=Array.from(box.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><h2>All trips</h2><button className="icon" aria-label="Close all trips" onClick={onClose}><X size={20}/></button></header><div className="home-list all-trips-list">{children}</div></section></div></MotionSurface>;
}

export default function HomePage({trips,state,preferences,name,avatar,resume,busy,onOpen,onUpdate,onCreate,onEdit,onDelete,onSettings,onLogout,onMessage}:{trips:Trip[];state:HomeState;preferences:Preferences;name:string;avatar:ReactNode;resume:HomeTarget|null;busy:boolean;onOpen:(target:HomeTarget)=>void;onUpdate:(state:HomeState)=>void;onCreate:()=>void;onEdit:(trip:Trip)=>void;onDelete:(trip:Trip)=>void;onSettings:()=>void;onLogout:()=>void;onMessage:(message:string)=>void}){

 const [showAll,setShowAll]=useState(false),[creator,setCreator]=useState(false),[kind,setKind]=useState('trip'),[selected,setSelected]=useState(''),[selectedDate,setSelectedDate]=useState(new Date().toLocaleDateString('en-CA'));

 const [menu,setMenu]=useState<{target:HomeTarget;source:'trip'|'all'|'day'|'pin'|'resume';x:number;y:number}|null>(null);const menuRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{if(!menu)return;const outside=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setMenu(null);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(null);};window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);};},[menu]);

 const find=(id:string|null)=>trips.find(trip=>trip.id===id);

 const addPin=(target:HomeTarget)=>{if(state.pins.some(pin=>targetKey(pin)===targetKey(target))){onMessage('Already pinned.');return;}if(state.pins.length>=8){onMessage('You can pin up to eight items. Remove a pin to make room.');return;}onUpdate({...state,pins:[...state.pins,target]});setMenu(null);};

 const context=(event:React.MouseEvent,target:HomeTarget,source:'trip'|'all'|'day'|'pin'|'resume')=>{event.preventDefault();setMenu({target,source,x:Math.max(8,Math.min(event.clientX,innerWidth-238)),y:Math.max(8,Math.min(event.clientY,innerHeight-238))});};

 const warning=(trip:Trip)=>{if(!preferences.autoDelete)return '';const until=Date.parse(`${trip.endDate}T23:59:59.999Z`)+preferences.retentionDays*86400000-Date.now();if(until>30*86400000)return '';return until<=0?'Scheduled for removal from your account':`Removed from your account in ${Math.max(1,Math.ceil(until/86400000))} ${Math.ceil(until/86400000)===1?'day':'days'}`;};

 const recent=state.recentTrips.map(id=>find(id)).filter(Boolean) as Trip[];

 const visibleTrips=recent.slice(0,6);

 const chosen=find(selected);const menuTrip=find(menu?.target.tripId??null);
 const resumeTrip=find(resume?.tripId??null),resumeLook=resumeTrip?tripAppearance(resumeTrip):null;

 const tile=(target:HomeTarget,source:'trip'|'all'|'day'|'pin',key:string)=>{const trip=find(target.tripId),label=target.date?dateLabel(target.date):trip?.name??'Date';return <div className={`home-tile ${source==='pin'?'pinned-tile':''}`} style={{"--trip-tint":trip?tripAppearance(trip).color:preferences.accent} as CSSProperties} key={key} onContextMenu={event=>context(event,target,source)}><button className="home-tile-main" disabled={busy} onClick={()=>{setShowAll(false);onOpen(target);}}>{trip?<TripBadge trip={trip}/>:<span className="trip-badge date-badge"><CalendarDays size={22}/></span>}<span><strong title={label}>{label}</strong>{target.date&&trip&&<small>{trip.name}</small>}{!target.date&&trip&&<small className="home-trip-dates" title={`${dateLabel(trip.startDate)} — ${dateLabel(trip.endDate)}`}>{dateRangeLabel(trip.startDate,trip.endDate)}</small>}{(source==='trip'||source==='all')&&trip&&warning(trip)&&<small className="removal-warning">{warning(trip)}</small>}</span></button><button className="home-tile-menu icon" aria-label={`Options for ${label}${target.date&&trip?' in '+trip.name:''}`} onClick={event=>{const box=event.currentTarget.getBoundingClientRect();setMenu({target,source,x:Math.max(8,Math.min(box.right-226,innerWidth-238)),y:Math.max(8,Math.min(box.bottom,innerHeight-238))});}}><MoreHorizontal size={17}/></button></div>;};

 return <main className="home-page"><div className="auth-map-background" aria-hidden="true"/><div className="home-content">

  <div className="home-masthead"><div className="brand home-brand"><Compass/><strong>Journas</strong></div><div className="home-account">{avatar}<span><strong>{name}</strong></span><button className="icon" aria-label="Settings" title="Settings" onClick={onSettings}><Settings size={21}/></button><button className="icon" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={20}/></button></div></div>

  <section className="home-intro"><div className="home-intro-copy"><h1>Where will you go next?</h1><p>Pick up your plans or start a new trip.</p></div></section><div className="home-featured"><div className="home-resume-column"><button className="home-continue home-resume-card" style={{"--resume-color":resumeLook?.color??preferences.accent} as CSSProperties} disabled={busy} onContextMenu={event=>{if(resume)context(event,resume,'resume');}} onClick={()=>onOpen(resume??{tripId:null,date:null})}><span className="home-resume-art" aria-hidden="true">{resumeLook?.mode==='image'&&resumeLook.image?<img src={resumeLook.image} alt="" onLoad={applyImageTint}/>:resumeLook?<SymbolIcon value={resumeLook.symbol}/>:<Compass/>}</span><span className="home-resume-content"><span className="home-resume-label">{busy?'Opening your plan…':'Continue where you left off'}</span><strong>{resumeTrip?.name??(resume?.date?dateLabel(resume.date):'Your next adventure')}</strong><small><CalendarDays size={14}/>{resumeTrip?dateRangeLabel(resumeTrip.startDate,resumeTrip.endDate):resume?.date?dateLabel(resume.date):'Pick up your plans'}{resumeTrip&&resume?.date&&<span className="home-resume-day">Resume {dateLabel(resume.date)}</span>}</small></span></button><button className="button home-create" disabled={trips.length>=100} onClick={onCreate}><Plus size={18}/>Create new trip</button><button className="home-browse-trips" disabled={!trips.length} onClick={()=>setShowAll(true)}><Compass size={24}/><span><strong>All trips</strong><small>{trips.length} {trips.length===1?'trip':'trips'} saved</small></span></button></div>

  <section className="home-section home-pins-section"><div className="home-section-heading"><h2><Pin size={18}/>Pins <span className="pins-remaining">{Math.max(0,8-state.pins.length)} remaining</span></h2></div><div className="home-pins">{state.pins.slice(0,8).map((target,index)=>tile(target,'pin',String(index)))}{state.pins.length<8&&<button className="home-pin-create" onClick={()=>{setSelected(trips[0]?.id??'');setKind(trips.length?'trip':'date');setCreator(true);}}><Plus size={20}/><span>Create pin</span></button>}</div></section></div>

  <div className="home-recents"><section className="home-section"><div className="home-section-heading"><h2>Recent dates</h2></div><div className="home-list">{state.recentDays.slice(0,6).map(target=>tile(target,'day',targetKey(target)))}{!state.recentDays.length&&<p className="home-list-empty">Dates you open while planning will appear here.</p>}</div></section><section className="home-section"><div className="home-section-heading"><h2>Recent trips</h2></div><div className="home-list">{visibleTrips.map(trip=>tile({tripId:trip.id,date:null},'trip',trip.id))}{!visibleTrips.length&&<p className="home-list-empty">{trips.length?'Open a trip to keep it close at hand.':'Your trips will appear here once you create one.'}</p>}</div></section></div>

 </div>

 {menu&&<MotionSurface><div className="home-context-menu" role="menu" ref={menuRef} style={{left:menu.x,top:menu.y}}>{menu.source==='pin'?<button role="menuitem" onClick={()=>{onUpdate({...state,pins:state.pins.filter(target=>targetKey(target)!==targetKey(menu.target))});setMenu(null);}}><X size={16}/>Remove pin</button>:<button role="menuitem" disabled={state.pins.length>=8||state.pins.some(target=>targetKey(target)===targetKey(menu.target))} onClick={()=>addPin(menu.target)}><Pin size={16}/>Add to pins</button>}{menu.source==='day'&&<button role="menuitem" onClick={()=>{onUpdate({...state,recentDays:state.recentDays.filter(target=>targetKey(target)!==targetKey(menu.target))});setMenu(null);}}><X size={16}/>Remove from recent dates</button>}{(menu.source==='trip'||menu.source==='all')&&menuTrip&&<><button role="menuitem" onClick={()=>{onUpdate({...state,recentTrips:state.recentTrips.filter(id=>id!==menuTrip.id)});setMenu(null);}}><X size={16}/>Remove from recent trips</button><button role="menuitem" onClick={()=>{setShowAll(false);onEdit(menuTrip);setMenu(null);}}><Settings size={16}/>Trip settings</button><button role="menuitem" className="danger" onClick={()=>{onDelete(menuTrip);setMenu(null);}}><Trash2 size={16}/>Delete trip</button></>}</div></MotionSurface>}

 {showAll&&<TripListDialog onClose={()=>setShowAll(false)}>{trips.map(trip=>tile({tripId:trip.id,date:null},'all',trip.id))}</TripListDialog>}
 {creator&&<MotionSurface><div className="modal-shade" onMouseDown={event=>{if(event.target===event.currentTarget)setCreator(false);}}><section className="modal home-pin-modal" role="dialog" aria-modal="true" aria-label="Create pin"><header><h2>Create pin</h2><button className="icon" aria-label="Close" onClick={()=>setCreator(false)}><X size={20}/></button></header><form onSubmit={event=>{event.preventDefault();addPin({tripId:kind==='date'?null:selected,date:kind==='trip'?null:selectedDate});setCreator(false);}}><div className="field"><span>Pin type</span><Dropdown aria-label="Pin type" value={kind} onChange={(event:any)=>{setKind(event.target.value);if(chosen)setSelectedDate(chosen.startDate);}}><option value="trip" disabled={!trips.length}>Trip</option><option value="trip-date" disabled={!trips.length}>Date in a trip</option><option value="date">Date without a trip</option></Dropdown></div>{kind!=='date'&&<div className="field"><span>Trip</span><Dropdown aria-label="Pinned trip" value={selected} onChange={(event:any)=>{setSelected(event.target.value);setSelectedDate(find(event.target.value)?.startDate??selectedDate);}}>{trips.map(trip=><option key={trip.id} value={trip.id}>{trip.name}</option>)}</Dropdown></div>}{kind!=='trip'&&<DateField label="Pinned date" value={selectedDate} min={kind==='trip-date'?chosen?.startDate:undefined} max={kind==='trip-date'?chosen?.endDate:undefined} required onChange={(event:any)=>setSelectedDate(event.target.value)}/>}<button className="button primary full" disabled={state.pins.length>=8}>Create pin</button></form></section></div></MotionSurface>}

 </main>;

}

