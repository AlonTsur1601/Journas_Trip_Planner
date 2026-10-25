import {useRef,type InputHTMLAttributes} from 'react';
import {X} from 'lucide-react';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {
 value:string;onValueChange:(value:string)=>void;
};
export function SearchInput({value,onValueChange,...props}:Props){
 const input=useRef<HTMLInputElement>(null);
 return <div className="search-input"><input {...props} ref={input} value={value} onChange={event=>onValueChange(event.target.value)}/>{value&&<button type="button" className="search-clear icon" disabled={props.disabled} aria-label={`Clear ${props['aria-label']??'search'}`} title="Clear search" onMouseDown={event=>event.preventDefault()} onClick={event=>{event.stopPropagation();onValueChange('');input.current?.focus();}}><X size={16}/></button>}</div>;
}
