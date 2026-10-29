import {useRef,useState} from 'react';
import type {ReactNode} from 'react';
/** Keep a small window of rows mounted while every choice remains scrollable. */
export function SymbolChoices({choices,value,onPick,renderIcon}:{choices:{id:string;label:string}[];value:string;onPick:(value:string,anchor:HTMLButtonElement)=>void;renderIcon:(value:string)=>ReactNode}){
 const viewport=useRef<HTMLDivElement>(null),[row,setRow]=useState(0),columns=6,rowHeight=38;
 const first=Math.max(0,row-2)*columns,last=Math.min(choices.length,(row+12)*columns);
 return <div ref={viewport} className="symbol-scroll" role="group" aria-label="Symbols and emoji" onScroll={e=>setRow(Math.floor(e.currentTarget.scrollTop/rowHeight))}><div className="symbol-grid" style={{display:'block',position:'relative',height:Math.ceil(choices.length/columns)*rowHeight}}>{choices.slice(first,last).map((choice,offset)=>{const index=first+offset;return <button type="button" key={choice.id} title={choice.label} aria-label={choice.label} aria-pressed={value===choice.id} style={{position:'absolute',top:Math.floor(index/columns)*rowHeight+2,left:`${index%columns*100/columns}%`,width:`calc(${100/columns}% - 4px)`,height:34}} onClick={e=>onPick(choice.id,e.currentTarget)}>{renderIcon(choice.id)}</button>;})}</div></div>;
}
