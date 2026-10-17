import {useEffect,useId,useRef,useState} from 'react';
const rowHeight=40;
function TimeWheel({label,count,value,onChange,disabled=false}:{label:string;count:number;value:number;onChange:(n:number)=>void;disabled?:boolean}){
 const root=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const id=useId();
 useEffect(()=>{if(root.current)root.current.scrollTop=value*rowHeight;},[value]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const choose=(n:number)=>{if(!disabled)onChange(Math.max(0,Math.min(count-1,n)));};
 return <div className="time-wheel-column"><span>{label}</span><div ref={root} className="time-wheel" role="listbox" aria-label={label} aria-activedescendant={`${id}-${value}`} aria-disabled={disabled} tabIndex={disabled?-1:0} onScroll={event=>{if(disabled)return;clearTimeout(timer.current);const element=event.currentTarget;timer.current=setTimeout(()=>choose(Math.round(element.scrollTop/rowHeight)),100);}} onKeyDown={event=>{const move=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:event.key==='PageUp'?-5:event.key==='PageDown'?5:0;if(move||event.key==='Home'||event.key==='End'){event.preventDefault();choose(event.key==='Home'?0:event.key==='End'?count-1:value+move);}}}>{Array.from({length:count},(_,n)=><button key={n} id={`${id}-${n}`} type="button" role="option" aria-selected={n===value} disabled={disabled&&n!==0} tabIndex={-1} className={n===value?'selected':''} onClick={()=>choose(n)}>{String(n).padStart(2,'0')}</button>)}</div></div>;
}
export default function TimePicker({value,allowMidnight,onApply,onCancel}:{value:string;allowMidnight:boolean;onApply:(time:string)=>void;onCancel:()=>void}){
 const initial=value.split(':').map(Number);const [hour,setHour]=useState(Math.min(allowMidnight?24:23,Math.max(0,initial[0]||0))),[minute,setMinute]=useState(Math.min(59,Math.max(0,initial[1]||0)));
 return <div className="time-picker"><strong>Set time</strong><div className="time-picker-wheels"><TimeWheel label="Hours" count={allowMidnight?25:24} value={hour} onChange={next=>{setHour(next);if(next===24)setMinute(0);}}/><span className="time-picker-colon">:</span><TimeWheel label="Minutes" count={60} value={hour===24?0:minute} onChange={setMinute} disabled={hour===24}/></div><div className="time-picker-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button type="button" className="button primary" onClick={()=>onApply(`${String(hour).padStart(2,'0')}:${String(hour===24?0:minute).padStart(2,'0')}`)}>Done</button></div></div>;
}
