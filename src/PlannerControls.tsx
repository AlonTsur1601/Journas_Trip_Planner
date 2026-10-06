import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Dropdown } from './Controls';
import {Popover} from './Popover';
import type emojiData from 'emojibase-data/en/compact.json';

const iso = (d: Date) => d.toLocaleDateString('en-CA');
export function MonthCalendar({value,onChange,min,max}:any) {
  const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(`${v}T12:00:00`).getTime())&&iso(new Date(`${v}T12:00:00`))===v;
  const [month,setMonth]=useState((validDate(value??'') ? value : iso(new Date())).slice(0,7));
  const shift=(n:number)=>{const d=new Date(`${month}-15T12:00:00`);d.setMonth(d.getMonth()+n);setMonth(iso(d).slice(0,7));};
  return <div className="month-calendar"><header><button type="button" className="icon" aria-label="Next month" onClick={()=>shift(1)}><ChevronLeft size={18}/></button><strong>{new Date(`${month}-15T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button type="button" className="icon" aria-label="Previous month" onClick={()=>shift(-1)}><ChevronRight size={18}/></button></header><div className="calendar-grid">{['S','M','T','W','T','F','S'].map((x,i)=><small key={i}>{x}</small>)}{Array.from({length:new Date(`${month}-01T12:00:00`).getDay()},(_,i)=><span key={'b'+i}/>)}{Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()},(_,i)=>{const d=`${month}-${String(i+1).padStart(2,'0')}`;return <button type="button" key={d} disabled={Boolean(min&&d<min||max&&d>max)} className={value===d?'selected':''} onClick={()=>onChange(d)}>{i+1}</button>;})}</div></div>;
}
export function DateField({label,value,defaultValue,name,onChange,min,max,required}:any) {
 const initial=defaultValue??value??'';const [parts,setParts]=useState(initial?initial.split('-').slice(0,3):['','','']);const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const inputs=useRef<(HTMLInputElement|null)[]>([]);
 useEffect(()=>{if(value!==undefined)setParts(value?value.split('-'):['','','']);},[value]);
 const current=parts.join('-'),valid=/^\d{4}-\d{2}-\d{2}$/.test(current)&&!Number.isNaN(Date.parse(current))&&iso(new Date(current+'T12:00:00'))===current&&(!min||current>=min)&&(!max||current<=max);
 const update=(index:number,v:string)=>{if(!/^\d*$/.test(v)||v.length>(index===0?4:2)||index===1&&Number(v)>12||index===2&&Number(v)>31)return;const next=[...parts];next[index]=v;setParts(next);const full=next.join('-');if(next[0].length===4&&next[1].length===2&&next[2].length===2)onChange?.({target:{value:full},currentTarget:{value:full}});if(v.length===(index===0?4:2)){const order=[1,2,0],following=order[order.indexOf(index)+1];if(following===undefined)inputs.current[index]?.blur();else inputs.current[following]?.focus();}};
 useEffect(()=>{inputs.current[0]?.setCustomValidity(parts.every((p:string)=>p.length)&&!valid?'Choose a valid date within the trip limits.':'');},[current,valid]);
 return <div className="field date-field" ref={root}><label>{label}</label><div className="date-field-row"><div className="segmented-date" role="group" aria-label={label}>{[1,2,0].map((index,i)=><span className="date-segment" key={index}>{i>0&&<span>/</span>}<input ref={e=>{inputs.current[index]=e;}} aria-label={`${label} ${['year','month','day'][index]}`} type="text" inputMode="numeric" required={required} maxLength={index===0?4:2} placeholder={['YYYY','MM','DD'][index]} value={parts[index]??''} onFocus={e=>e.currentTarget.select()} onClick={e=>e.currentTarget.select()} onChange={e=>update(index,e.target.value)} onKeyDown={e=>{const order=[1,2,0],at=order.indexOf(index);if(e.key==='ArrowRight'&&at<2||e.key==='ArrowLeft'&&at>0){e.preventDefault();inputs.current[order[at+(e.key==='ArrowRight'?1:-1)]]?.focus();}}}/></span>)}<input type="hidden" name={name} value={valid?current:''}/></div><button type="button" className="icon" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} onClick={()=>setOpen(!open)}><CalendarDays size={18}/></button></div>{open&&<Popover anchor={root} className="field-calendar" width={280} height={292} onClose={()=>setOpen(false)}><MonthCalendar value={valid?current:initial} min={min} max={max} onChange={(v:string)=>{setParts(v.split('-'));onChange?.({target:{value:v},currentTarget:{value:v}});setOpen(false);}}/></Popover>}</div>;
}
export function TimeField({label,value='',onChange,onInput,required,name}:any){
 const inputs=useRef<(HTMLInputElement|null)[]>([]);const parts=String(value).split(':');
 const update=(index:number,v:string)=>{if(!/^\d{0,2}$/.test(v)||Number(v)>(index===0&&label==='Ends at'?24:index===0?23:59))return;const next=[parts[0]??'',parts[1]??''];next[index]=v;(onChange??onInput)?.({target:{value:next.join(':')},currentTarget:{value:next.join(':')}});};
 return <div className="field"><span>{label}</span><div className="time-field segmented-time" role="group" aria-label={label}>{[0,1].map(index=><input key={index} ref={e=>{inputs.current[index]=e;}} aria-label={`${label} ${index?'minute':'hour'}`} type="text" inputMode="numeric" maxLength={2} required={required} pattern={index?'[0-5][0-9]':'(?:[01][0-9]|2[0-4])'} value={parts[index]??''} onFocus={e=>e.currentTarget.select()} onClick={e=>e.currentTarget.select()} onChange={e=>{update(index,e.target.value);if(/^\d{2}$/.test(e.target.value)&&Number(e.target.value)<=(index?59:label==='Ends at'?24:23)){if(index===0)inputs.current[1]?.focus();else e.currentTarget.blur();}}} onBlur={e=>{if(e.target.value)update(index,e.target.value.padStart(2,'0'));}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();inputs.current[index?0:1]?.focus();}if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const max=index?60:label==='Ends at'?25:24;update(index,String((Number(parts[index])+(e.key==='ArrowUp'?1:max-1))%max).padStart(2,'0'));}}}/>).flatMap((input,index)=>index?[<span key="colon">:</span>,input]:[input])}<Clock3 size={17} aria-hidden="true"/>{name&&<input type="hidden" name={name} value={value}/>}</div></div>;
}

// Thirty original compact line symbols, sharing the map's 24-unit drawing grid.
export const pinSymbols=[
 ['stay','Lodging','M3 20V8h18v12M7 8V4h10v4M8 20v-5h8v5M7 11h2m6 0h2'],
 ['camp','Camping','M2 20L12 4l10 16H2m6 0l4-8 4 8M12 4V2'],
 ['peak','Mountain','M2 20l7-14 4 8 3-6 6 12H2m4-8l3 2 2-2'],
 ['coast','Beach','M3 10c4-8 14-8 18 0H3m9-8v16m0-8l5 12M2 21h20'],
 ['coffee','Coffee','M4 7h12v8a6 6 0 01-12 0V7m12 1h2a3 3 0 010 6h-2M3 22h16M7 2v2m5-2v2'],
 ['meal','Restaurant','M4 2v7c0 4 6 4 6 0V2M7 2v20M18 2c-4 4-4 9 0 9h2V2m0 9v11'],
 ['museum','Museum','M2 7l10-5 10 5H2m2 3v9m5-9v9m6-9v9m5-9v9M2 22h20'],
 ['gallery','Gallery','M3 3h18v18H3V3m0 14l6-6 5 5 3-3 4 4M16 7h.01'],
 ['garden','Garden','M12 22V10M12 14C2 14 2 3 2 3s10 0 10 11m0-4c0-8 10-8 10-8s0 10-10 10'],
 ['forest','Forest','M12 2L5 10h3l-5 8h18l-5-8h3L12 2m0 16v4'],
 ['waterfall','Waterfall','M3 3h18M7 3v11c0 4-4 4-4 7m9-18v19m5-19v11c0 4 4 4 4 7M2 22h20'],
 ['lake','Lake','M2 9l6-6 4 5 4-6 6 7M2 13c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 19c3-3 5 3 8 0s5 3 8 0 3 0 4 0'],
 ['bridge','Bridge','M2 19h20M5 19V4m14 15V4M5 8c3 8 11 8 14 0M9 13v6m6-6v6'],
 ['castle','Castle','M3 21V5h4V2h3v5h4V2h3v3h4v16H3m6 0v-6a3 3 0 016 0v6'],
 ['temple','Temple','M2 9h20M4 9l8-7 8 7M5 9v12m14-12v12M3 22h18M10 13h4v8'],
 ['market','Market','M3 9l2-6h14l2 6M3 9c0 5 6 5 6 0 0 5 6 5 6 0 0 5 6 5 6 0M4 12v9h16v-9M8 21v-6h8v6'],
 ['shop','Shopping','M4 7h16l2 15H2L4 7m4 0V5a4 4 0 018 0v2'],
 ['view','Viewpoint','M2 12c5-9 15-9 20 0-5 9-15 9-20 0m7 0a3 3 0 106 0 3 3 0 10-6 0'],
 ['photo','Photography','M3 7h4l2-4h6l2 4h4v14H3V7m5 6a4 4 0 108 0 4 4 0 10-8 0'],
 ['walk','Walking','M15 4a2 2 0 1 0-4 0 2 2 0 0 0 4 0M13 6l-1 2-2 6M12 8l-4 1-2 3M12 8l4 3h3M10 14l-3 5-2 2M10 14l5 3 2 4'],
 ['cycle','Cycling','M2 17a4 4 0 108 0 4 4 0 10-8 0m12 0a4 4 0 108 0 4 4 0 10-8 0M6 17l5-10 7 10M9 5h5m2-2h3'],
 ['train','Railway','M6 3h12v15H6V3m0 7h12M9 18l-3 4m9-4l3 4M9 14h.01m6 0h.01'],
 ['flight','Airport','M2 13l8-3V3l2-2 2 2v7l8 3v3l-8-2v5l3 2v1H7v-1l3-2v-5l-8 2v-3'],
 ['boat','Harbor','M3 13l9-3 9 3-3 7H6l-3-7m5-2V5h8v6m-4-6V2M2 22c3-2 5 2 8 0s5 2 8 0h4'],
 ['bus','Bus stop','M4 4h16v15H4V4m0 8h16M7 19v3m10-3v3M8 16h.01m8 0h.01'],
 ['music','Music','M10 17V4l10-2v13M4 18a3 3 0 106 0 3 3 0 10-6 0m10-2a3 3 0 106 0 3 3 0 10-6 0'],
 ['ticket','Tickets','M2 6h20v4a2 2 0 000 4v4H2v-4a2 2 0 000-4V6m12 0v2m0 2v4m0 2v2'],
 ['spa','Spa','M12 20C0 17 2 8 2 8c4 0 7 3 10 7m0 5c12-3 10-12 10-12-4 0-7 3-10 7m0 5c-7-6-4-15 0-18 4 3 7 12 0 18'],
 ['sport','Sports','M12 2a10 10 0 100 20 10 10 0 100-20m0 0v20M2 12h20M5 5c9 3 9 11 0 14m14-14c-9 3-9 11 0 14'],
 ['star','Favorite','M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7']
] as const;
export function symbolMarkup(value:string){const item=pinSymbols.find(x=>`icon:${x[0]}`===value);return item?`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${item[2]}"/></svg>`:null;}
export function SymbolIcon({value}: {value:string}){const item=pinSymbols.find(x=>`icon:${x[0]}`===value);return item?<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item[2]}/></svg>:<>{value}</>;}
const emojiGroups = ['Smileys & emotion','People & body','Animals & nature','Food & drink','Travel & places','Activities','Objects','Symbols','Flags'];

export function SymbolPicker({value,onChange}:any){
 const [emojiEntries,setEmojiEntries]=useState<typeof emojiData>([]);useEffect(()=>{import('emojibase-data/en/compact.json').then(m=>setEmojiEntries(m.default.filter(e=>e.group!==undefined&&e.group!==2).sort((a,b)=>(a.order??0)-(b.order??0))));},[]);
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[categoryIndex,setCategoryIndex]=useState(0),[tab,setTab]=useState('symbols'),[page,setPage]=useState(0);const root=useRef<HTMLDivElement>(null);const q=search.trim().toLowerCase();
 const custom=pinSymbols.filter(s=>s[1].toLowerCase().includes(q)).map(s=>({id:`icon:${s[0]}`,label:s[1]}));
 const emoji=emojiEntries.filter(e=>q?(e.label+' '+(e.tags??[]).join(' ')).toLowerCase().includes(q):e.group===categoryIndex).map(e=>({id:e.unicode,label:e.label}));
 const choices=q?[...custom,...emoji]:tab==='symbols'?custom:emoji;const pages=Math.max(1,Math.ceil(choices.length/30));const current=Math.min(page,pages-1);
 return <div className="field symbol-picker" ref={root}><span>Symbol</span><button type="button" className="button symbol-trigger" aria-label="Choose symbol" aria-expanded={open} onClick={()=>setOpen(!open)}><SymbolIcon value={value}/> Choose symbol</button>{open&&<Popover anchor={root} width={340} height={354} className="symbol-menu" onClose={()=>setOpen(false)}><input aria-label="Search symbols and emoji" placeholder="Search symbols and emoji" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><div className="symbol-tabs"><button type="button" className={tab==='symbols'?'selected':''} onClick={()=>{setTab('symbols');setPage(0);}}>Journas symbols</button><button type="button" className={tab==='emoji'?'selected':''} onClick={()=>{setTab('emoji');setPage(0);}}>Emoji</button></div><div className="symbol-category">{tab==='emoji'&&!q&&<Dropdown aria-label="Emoji category" value={categoryIndex} onChange={(e:any)=>{setCategoryIndex(Number(e.target.value));setPage(0);}}>{emojiGroups.map((g,i)=><option key={g} value={i<2?i:i+1}>{g}</option>)}</Dropdown>}</div><div className="symbol-grid">{choices.slice(current*30,current*30+30).map(choice=><button type="button" key={choice.id} title={choice.label} aria-label={choice.label} aria-pressed={value===choice.id} onClick={()=>{onChange({target:{value:choice.id}});setOpen(false);}}><SymbolIcon value={choice.id}/></button>)}</div>{pages>1&&<div className="picker-pages"><button type="button" className="icon" aria-label="Previous symbols page" disabled={!current} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/></button><span>{current+1} / {pages}</span><button type="button" className="icon" aria-label="Next symbols page" disabled={current>=pages-1} onClick={()=>setPage(current+1)}><ChevronRight size={16}/></button></div>}{!choices.length&&<span>No matching symbols</span>}</Popover>}</div>;
}
export function TimezonePicker({value,onChange}:any){const zones=Array.from(new Set(['', 'UTC',value,...Intl.supportedValuesOf('timeZone')]));return <div className="field"><span>Destination time zone</span><Dropdown aria-label="Destination time zone" searchable value={value} onChange={onChange}>{zones.map(zone=><option key={zone} value={zone}>{zone?zone.replaceAll('_',' '):'Automatic from planned places'}</option>)}</Dropdown></div>;}

export function FloatingChecklist({children,layout}:any){const [,refresh]=useState(0);useEffect(()=>{const resize=()=>refresh(n=>n+1);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);const topbar=document.querySelector('.topbar')?.getBoundingClientRect().bottom??48;const mobile=innerWidth<=700;const x=mobile?0:Math.max(0,Math.min(layout.todoX,innerWidth-Math.min(layout.todoWidth,innerWidth))),y=mobile?topbar:Math.max(topbar,Math.min(topbar+layout.todoY,innerHeight-Math.min(layout.todoHeight,innerHeight-topbar)));return createPortal(<section className="todo-panel panel" style={{position:'fixed',left:x,top:y,width:mobile?innerWidth:Math.min(layout.todoWidth,innerWidth),height:mobile?innerHeight-topbar:Math.min(layout.todoHeight,innerHeight-topbar),'--todo-left':x+'px','--todo-top':y+'px','--todo-width':(mobile?innerWidth:Math.min(layout.todoWidth,innerWidth))+'px'} as React.CSSProperties}>{children({x,y,topbar})}</section>,document.body);}
