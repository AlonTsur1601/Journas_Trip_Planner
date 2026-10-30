import {useState,type ReactNode} from 'react';
import {SearchInput} from './SearchInput';

const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
export function matchesSearch(query:string,...fields:(string|undefined)[]){
 const text=normalize(fields.filter(Boolean).join(' '));
 return normalize(query).trim().split(/\s+/).every(word=>text.includes(word));
}
export function SearchableList<T>({items,label,searchText,renderItem,className,emptyText}:{items:T[];label:string;searchText:(item:T)=>string;renderItem:(item:T)=>ReactNode;className:string;emptyText:string}){
 const [query,setQuery]=useState('');
 const filtered=items.filter(item=>matchesSearch(query,searchText(item)));
 return <><SearchInput aria-label={label} placeholder={`${label}…`} value={query} onValueChange={setQuery}/><div className={className}>{filtered.length?filtered.map(renderItem):<p className="dropdown-empty" role="status">{items.length?'No results found':emptyText}</p>}</div></>;
}
