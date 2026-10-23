import {forwardRef,useRef,useState,type ButtonHTMLAttributes,type MouseEvent} from 'react';
import {LoadingSpinner} from './LoadingScreen';
import './AsyncButton.css';
export function ButtonSpinner(){return <span className="button-spinner" aria-hidden="true"><LoadingSpinner/></span>;}
type Props=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'onClick'> & {pending?:boolean;onClick?:(event:MouseEvent<HTMLButtonElement>)=>void|Promise<unknown>};
export const AsyncButton=forwardRef<HTMLButtonElement,Props>(function AsyncButton({pending=false,disabled,className='',children,onClick,...props},ref){
 const [running,setRunning]=useState(false),locked=useRef(false);const waiting=pending||running;
 return <button {...props} ref={ref} className={`async-button ${className}`.trim()} disabled={disabled||waiting} aria-busy={waiting||undefined} onClick={async event=>{if(locked.current||waiting)return;const result=onClick?.(event);if(!result||typeof result.then!=='function')return;locked.current=true;setRunning(true);try{await result;}finally{locked.current=false;setRunning(false);}}}>{waiting&&<ButtonSpinner/>}{children}</button>;
});
