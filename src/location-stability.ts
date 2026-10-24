import type {LiveLocation} from './live-location';
import {distanceMeters} from './nearby-activity';

/** Keep GPS uncertainty and isolated outliers from moving a stationary marker. */
export function createLocationStabilizer(){
 let accepted:LiveLocation|null=null,pending:LiveLocation|null=null;
 return (next:LiveLocation):LiveLocation|null=>{
  if(!Number.isFinite(next.lng)||!Number.isFinite(next.lat)||!Number.isFinite(next.accuracy)||Math.abs(next.lng)>180||Math.abs(next.lat)>90||next.accuracy<0)return accepted;
  if(!accepted){accepted=next;return accepted;}
  // A substantially better initial fix may correct an imprecise first reading.
  const betterFix=next.accuracy<=25&&next.accuracy<accepted.accuracy/2;
  const distance=distanceMeters(accepted,next);
  if(betterFix){accepted=distance>8?next:{...accepted,accuracy:next.accuracy};pending=null;return accepted;}
  const uncertainty=Math.max(8,accepted.accuracy,next.accuracy);
  if(distance<=uncertainty){pending=null;return accepted;}
  const confirmed=pending&&distanceMeters(pending,next)<=Math.max(8,pending.accuracy,next.accuracy);
  if(confirmed){accepted=next;pending=null;}
  else pending=next;
  return accepted;
 };
}
