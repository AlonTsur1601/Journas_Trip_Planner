import {useEffect,useId,useRef,useState} from 'react';
const rowHeight=40;
function TimeWheel({label,count,value,onChange}:{label:string;count:number;value:number;onChange:(n:number)=>void}){
 const root=useRef<HTMLDivElement>(null);const id=useId();
 // Keep momentum intact when the selected value came from scrolling.
 useEffect(()=>{const element=root.current;if(element&&Math.round(element.scrollTop/rowHeight)!==value)element.scrollTop=value*rowHeight;},[value]);
 const choose=(n:number)=>{onChange(Math.max(0,Math.min(count-1,n)));};
 return <div className="time-wheel-column"><span>{label}</span><div ref={root} className="time-wheel" role="listbox" aria-label={label} aria-activedescendant={`${id}-${value}`} tabIndex={0} onScroll={event=>choose(Math.round(event.currentTarget.scrollTop/rowHeight))} onKeyDown={event=>{const move=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:event.key==='PageUp'?-5:event.key==='PageDown'?5:0;if(move||event.key==='Home'||event.key==='End'){event.preventDefault();choose(event.key==='Home'?0:event.key==='End'?count-1:value+move);}}}>{Array.from({length:count},(_,n)=><button key={n} id={`${id}-${n}`} type="button" role="option" aria-selected={n===value} tabIndex={-1} className={n===value?'selected':''} onClick={()=>choose(n)}>{String(n).padStart(2,'0')}</button>)}</div></div>;
}
export default function TimePicker({value,onApply,onCancel}:{value:string;onApply:(time:string)=>void;onCancel:()=>void}){
 const initial=value.split(':').map(Number);const [hour,setHour]=useState(Math.min(23,Math.max(0,initial[0]||0))),[minute,setMinute]=useState(Math.min(59,Math.max(0,initial[1]||0)));
 return <div className="time-picker"><strong>Set time</strong><div className="time-picker-wheels"><TimeWheel label="Hours" count={24} value={hour} onChange={setHour}/><span className="time-picker-colon">:</span><TimeWheel label="Minutes" count={60} value={minute} onChange={setMinute}/></div><div className="time-picker-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button type="button" className="button primary" onClick={()=>onApply(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`)}>Done</button></div></div>;
}
