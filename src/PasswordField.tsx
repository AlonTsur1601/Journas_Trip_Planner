import {useState, type InputHTMLAttributes} from 'react';
import {Eye, EyeOff} from 'lucide-react';

export function PasswordField({label,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}) {
 const [visible,setVisible]=useState(false);
 return <label className="field"><span>{label}</span><div className="password-input"><input {...props} aria-label={label} type={visible?'text':'password'}/><button type="button" className="icon password-eye" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>;
}

