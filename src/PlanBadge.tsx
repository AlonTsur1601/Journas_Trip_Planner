import type {PlanId} from '../shared/plans';
export function PlanIcon({plan,size=20}:{plan:PlanId;size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{plan==='tourist'?<><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="3"/></>:plan==='traveler'?<><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/></>:<path d="m3 20 9-16 9 16H3Zm6-10 3 3 3-3"/>}</svg>;
}
export function PlanBadge({plan,compact=false}:{plan:PlanId;compact?:boolean}){return <span className={`plan-badge plan-${plan}`} title={`${plan} plan`} aria-label={`${plan} plan`}><PlanIcon plan={plan} size={16}/>{!compact&&<span>{plan}</span>}</span>;}
