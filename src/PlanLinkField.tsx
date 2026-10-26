import {Dropdown} from './Controls';
import {connectionTitle} from './connection-label';
import type {Connection,Pin} from './types';
import {PlanGate} from './PlanGate';
import {useTripOwnerPlan} from './trip-plan';
export function PlanLinkField({pinId,connectionId,pins,connections,onChange,emptyLabel,disabled=false,groupTabs=false}:{pinId?:string|null;connectionId?:string|null;pins:Pin[];connections:Connection[];onChange:(kind:'pins'|'connections'|null,id:string|null)=>void;emptyLabel:string;disabled?:boolean;groupTabs?:boolean}){
 const ownerPlan=useTripOwnerPlan();
 return <PlanGate feature="linkedPlanning" ownerPlan={ownerPlan}><div className="field"><span>Linked place or connection</span><Dropdown searchable groupTabs={groupTabs} disabled={disabled} aria-label="Linked place or connection" value={connectionId?`connection:${connectionId}`:pinId?`pin:${pinId}`:''} onChange={(e:any)=>{const value=String(e.target.value);onChange(value.startsWith('connection:')?'connections':value?'pins':null,value?value.slice(value.indexOf(':')+1):null);}}><option value="">{emptyLabel}</option><optgroup label="Places">{[...pins].sort((a,b)=>a.title.localeCompare(b.title)).map(pin=><option key={`pin:${pin.id}`} value={`pin:${pin.id}`}>{pin.title}</option>)}</optgroup><optgroup label="Connections">{[...connections].sort((a,b)=>connectionTitle(a,pins).localeCompare(connectionTitle(b,pins))).map(connection=><option key={`connection:${connection.id}`} value={`connection:${connection.id}`}>{connectionTitle(connection,pins)}</option>)}</optgroup></Dropdown>{(pinId||connectionId)&&<button type="button" className="text-button" onClick={()=>onChange(null,null)}>Make independent</button>}</div></PlanGate>;
}
