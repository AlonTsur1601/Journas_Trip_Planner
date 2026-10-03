import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
/** Position the overlay using its actual content height. */
export function Popover({anchor,width=280,height=300,onClose,children,className='',...props}:any){
 const box=useRef<HTMLDivElement>(null);const [position,setPosition]=useState({left:0,top:0,width});
 useLayoutEffect(()=>{
  const place=()=>{const a=anchor.current?.getBoundingClientRect();if(!a)return;const modal=anchor.current.closest('[role=dialog]')?.getBoundingClientRect();const leftBound=Math.max(8,(modal?.left??0)+8),rightBound=Math.min(innerWidth-8,(modal?.right??innerWidth)-8);const w=Math.min(width,rightBound-leftBound);const topBound=8,bottomBound=innerHeight-8;const h=Math.min(box.current?.scrollHeight??height,bottomBound-topBound);const top=a.bottom+6+h<=bottomBound?a.bottom+6:a.top-6-h;setPosition({left:Math.max(leftBound,Math.min(a.left,rightBound-w)),top:Math.max(topBound,Math.min(top,bottomBound-h)),width:w});};
  place();window.addEventListener('resize',place);const observer=new ResizeObserver(place);if(box.current)observer.observe(box.current);
  const exclusive=(event:Event)=>{const target=(event as CustomEvent).detail;if(target!==anchor.current&&!box.current?.contains(target))onClose?.();};
  document.addEventListener('journas-picker-open',exclusive);
  document.dispatchEvent(new CustomEvent('journas-picker-open',{detail:anchor.current}));
  const outside=(e:PointerEvent)=>{if(!anchor.current?.contains(e.target as Node)&&!box.current?.contains(e.target as Node)&&!(e.target as Element)?.closest?.('.bounded-popover'))onClose?.();};document.addEventListener('pointerdown',outside);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);document.removeEventListener('pointerdown',outside);document.removeEventListener('journas-picker-open',exclusive);};
 },[anchor,width,height,onClose]);
 return createPortal(<div {...props} ref={box} className={'bounded-popover '+className} style={{position:'fixed',...position,maxHeight:'calc(100dvh - 24px)',zIndex:80}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose?.();}}}>{children}</div>,document.body);
}
