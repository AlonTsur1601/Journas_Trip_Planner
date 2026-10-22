import {Dropdown} from './Controls';
import {connectionTitle} from './connection-label';
import type {Connection,Pin} from './types';
export function PlanLinkField({pinId,connectionId,pins,connections,onChange,emptyLabel,disabled=false}:{pinId?:string|null;connectionId?:string|null;pins:Pin[];connections:Connection[];onChange:(kind:'pins'|'connections'|null,id:string|null)=>void;emptyLabel:string;disabled?:boolean}){
 return <div className="field"><span>Linked place or connection</span><Dropdown disabled={disabled} aria-label="Linked place or connection" value={connectionId?`connection:${connectionId}`:pinId?`pin:${pinId}`:''} onChange={(e:any)=>{const value=String(e.target.value);onChange(value.startsWith('connection:')?'connections':value?'pins':null,value?value.slice(value.indexOf(':')+1):null);}}><option value="">{emptyLabel}</option>{pins.map(pin=><option key={`pin:${pin.id}`} value={`pin:${pin.id}`}>{`Place: ${pin.title}`}</option>)}{connections.map(connection=><option key={`connection:${connection.id}`} value={`connection:${connection.id}`}>{`Connection: ${connectionTitle(connection,pins)}`}</option>)}</Dropdown></div>;
}
