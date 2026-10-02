import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import {Popover} from "./Popover";

export function Dropdown({ children, value, onChange, disabled, placeholder = "Choose", searchable=false, ...props }: any) {
  const [open, setOpen] = useState(false);
  const [search,setSearch]=useState("");const [page,setPage]=useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const options = Children.toArray(children).filter(isValidElement).map((element: any) => ({
    value: String(element.props.value ?? element.props.children),
    label: element.props.children,
    disabled: element.props.disabled,
  }));
  const filtered=options.filter(option=>String(option.label).toLowerCase().includes(search.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/6));const current=Math.min(page,pages-1);
  const toggle=()=>{setOpen(!open);setSearch('');setPage(0);};
  return <div ref={root} className="dropdown" onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); root.current?.querySelector<HTMLButtonElement>("[role=combobox]")?.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) { toggle(); requestAnimationFrame(() => document.getElementById(id)?.querySelector<HTMLButtonElement>("[role=option]:not(:disabled)")?.focus()); return; }
      const items = [...(document.getElementById(id)?.querySelectorAll<HTMLButtonElement>("[role=option]:not(:disabled)") ?? [])];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[index]?.focus();
    }
    if (event.key === "Tab") setOpen(false);
  }}>
    <button type="button" role="combobox" aria-label={props["aria-label"]} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" className="dropdown-trigger" disabled={disabled} onClick={toggle}>
      <span>{options.find((option) => option.value === String(value))?.label ?? placeholder}</span><ChevronDown size={15} />
    </button>
    {open && <Popover anchor={root} width={Math.max(220,root.current?.getBoundingClientRect().width??220)} height={searchable?294:256} onClose={()=>setOpen(false)} id={id} role="listbox" aria-label={props["aria-label"]} className="dropdown-menu">
      {searchable&&<input aria-label={`Search ${props["aria-label"]??'options'}`} placeholder="Search…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>}
      {filtered.slice(current*6,current*6+6).map((option) => <button type="button" role="option" aria-selected={option.value === String(value)} disabled={option.disabled} key={option.value} onClick={() => {
        onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } }); setOpen(false); root.current?.querySelector<HTMLButtonElement>("[role=combobox]")?.focus();
      }}><span>{option.label}</span>{option.value === String(value) && <Check size={14} />}</button>)}
      {pages>1&&<div className="picker-pages"><button type="button" className="icon" aria-label="Previous options page" disabled={!current} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/></button><span>{current+1} / {pages}</span><button type="button" className="icon" aria-label="Next options page" disabled={current===pages-1} onClick={()=>setPage(current+1)}><ChevronRight size={15}/></button></div>}
      {!filtered.length&&<p>No matching options</p>}
    </Popover>}
  </div>;
}

const colors = ["#8b5cf6", "#3b82f6", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#64748b", "#292637"];
function hsv(hex:string){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;return {h:d?((max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60):270,s:max?d/max:0,v:max};}
function fromHsv(h:number,s:number,v:number){const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c;const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');}
export function ColorPicker({ label, value, onChange, onInput, disabled }: any) {
  const [advanced, setAdvanced] = useState(false);const root=useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState(value);
  const [hue,setHue]=useState(hsv(value).h);
  const sv=hsv(value);
  useEffect(() => setHex(value), [value]);
  const update = (color: string) => {
    const event = { target: { value: color }, currentTarget: { value: color } };
    (onChange ?? onInput)?.(event);
  };
  return <div className="field color-picker" ref={root}><span>{label}</span>
    <div className="color-swatches">{colors.map((color) => <button type="button" disabled={disabled} key={color} aria-label={`${label}: ${color}`} aria-pressed={value.toLowerCase() === color} style={{ background: color }} onClick={() => {setHue(hsv(color).h);update(color);}}>{value.toLowerCase() === color && <Check size={12} />}</button>)}</div>
    <button className="text-button advanced-color" type="button" disabled={disabled} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Advanced color selection</button>
    {advanced && <Popover anchor={root} width={280} height={238} onClose={()=>setAdvanced(false)} className="advanced-color-fields"><div className="color-plane" role="slider" tabIndex={disabled?-1:0} aria-label={`${label} saturation and brightness`} aria-valuetext={`Saturation ${Math.round(sv.s*100)}%, brightness ${Math.round(sv.v*100)}%`} style={{backgroundColor:fromHsv(hue,1,1)}} onPointerDown={e=>{if(disabled)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const element=e.currentTarget;const r=element.getBoundingClientRect();update(fromHsv(hue,Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height))));const move=(ev:PointerEvent)=>{const rect=element.getBoundingClientRect();update(fromHsv(hue,Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,1-(ev.clientY-rect.top)/rect.height))));};element.addEventListener('pointermove',move);element.addEventListener('lostpointercapture',()=>element.removeEventListener('pointermove',move),{once:true});}} onKeyDown={e=>{if(disabled)return;const n=e.shiftKey?.1:.02;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();update(fromHsv(hue,Math.max(0,Math.min(1,sv.s+(e.key==='ArrowRight'?n:e.key==='ArrowLeft'?-n:0))),Math.max(0,Math.min(1,sv.v+(e.key==='ArrowUp'?n:e.key==='ArrowDown'?-n:0)))));}}}><i style={{left:`${sv.s*100}%`,top:`${(1-sv.v)*100}%`}}/></div><input className="hue-slider" type="range" min="0" max="359" aria-label={`${label} hue`} disabled={disabled} value={hue} onChange={e=>{setHue(Number(e.target.value));update(fromHsv(Number(e.target.value),sv.s,sv.v));}}/><input aria-label={`${label} HEX`} disabled={disabled} value={hex} maxLength={7} onChange={(event) => { setHex(event.target.value); if (/^#[\da-f]{6}$/i.test(event.target.value)){setHue(hsv(event.target.value).h);update(event.target.value);} }} onBlur={() => setHex(value)} /></Popover>}
  </div>;
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [displayed, setDisplayed] = useState(message);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (message) { setDisplayed(message); setLeaving(false); return; }
    setLeaving(true);
    const timer = setTimeout(() => setDisplayed(""), 180);
    return () => clearTimeout(timer);
  }, [message]);
  if (!displayed) return null;
  return <div className={`toast${leaving ? " leaving" : ""}`} role="status">
    {displayed}<button onClick={onDismiss} aria-label="Dismiss"><X size={16} /></button>
  </div>;
}
