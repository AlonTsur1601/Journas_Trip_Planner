import {useState} from 'react';
import type {Trip} from './types';
import {usePlan} from './plan-state';
import {api} from './firebase';
import {AsyncButton} from './AsyncButton';
export default function ActiveTripSelector({trips}:{trips:Trip[]}){
 const {effective}=usePlan(),[selected,setSelected]=useState(()=>trips.filter(t=>!['trips','overlaps'].includes(t.access?.readonlyReason??'')).slice(0,effective.trips).map(t=>t.id)),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(trips.length<=effective.trips&&!trips.some(trip=>['trips','overlaps'].includes(trip.access?.readonlyReason??'')))return null;
 return <section className="active-trip-selector"><h2>Choose your active trips</h2><p>Your saved trips are safe. Choose up to {effective.trips} to keep active on your current plan; the others stay available to view. Overlapping trips you own cannot both be active on this plan. Other trip limits still apply.</p><div>{trips.map(trip=><label key={trip.id}><input type="checkbox" checked={selected.includes(trip.id)} disabled={!selected.includes(trip.id)&&selected.length>=effective.trips} onChange={e=>setSelected(list=>e.target.checked?[...list,trip.id]:list.filter(id=>id!==trip.id))}/>{trip.name}</label>)}</div><AsyncButton className="button primary" pending={busy} onClick={async()=>{setBusy(true);try{await api('trip.select-active',{tripIds:selected});location.reload();}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}}>Save active trips</AsyncButton>{message&&<p role="status">{message}</p>}</section>;
}
