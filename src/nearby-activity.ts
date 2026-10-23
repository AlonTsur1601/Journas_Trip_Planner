import type {Block,Pin,Task} from './types';
import type {LiveLocation} from './live-location';

export const nearbyPlaceMeters=150;
export function distanceMeters(a:{lng:number;lat:number},b:{lng:number;lat:number}){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function blockIsNow(block:Block,date:string,now:Date,fallbackZone:string){
 if(Number.isFinite(block.startEpoch)&&Number.isFinite(block.endEpoch))return now.getTime()>=block.startEpoch!&&now.getTime()<block.endEpoch!;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:block.timezone||fallbackZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(type:string)=>parts.find(value=>value.type===type)!.value;
 const today=`${part('year')}-${part('month')}-${part('day')}`,time=`${part('hour')}:${part('minute')}`;
 return today===date&&time>=block.start&&time<block.end;
}
export function nearbyActivities(blocks:ReadonlyArray<Block>,pins:ReadonlyArray<Pin>,date:string,location:LiveLocation|null,now:Date,zone:string){
 const blockIds:string[]=[],pinIds=new Set<string>();
 if(location)for(const block of blocks){
  const pin=block.pinId?pins.find(pin=>pin.id===block.pinId):undefined;
  if(pin&&distanceMeters(location,pin)<=nearbyPlaceMeters&&blockIsNow(block,date,now,zone)){blockIds.push(block.id);pinIds.add(pin.id);}
 }
 return {blockIds,pinIds:[...pinIds]};
}

export function nearbyTasks(tasks:ReadonlyArray<Task>,blocks:ReadonlyArray<Block>,pins:ReadonlyArray<Pin>,date:string,location:LiveLocation|null,now:Date,zone:string){
 const taskIds:string[]=[],pinIds=new Set<string>();
 if(location)for(const task of tasks){
  if(task.checked)continue;
  const block=task.blockId?blocks.find(block=>block.id===task.blockId):undefined;
  if(task.blockId&&!block)continue;
  const pinId=task.pinId??block?.pinId;
  const pin=pinId?pins.find(pin=>pin.id===pinId):undefined;
  const relevant=block?blockIsNow(block,date,now,zone):new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(now)===date;
  if(pin&&relevant&&distanceMeters(location,pin)<=nearbyPlaceMeters){taskIds.push(task.id);pinIds.add(pin.id);}
 }
 return {taskIds,pinIds:[...pinIds]};
}
