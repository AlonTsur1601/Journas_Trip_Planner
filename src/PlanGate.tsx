import type {ReactNode} from 'react';
import {plans,requiredPlan,type Feature,type PlanId} from '../shared/plans';
import {openUpgrade,usePlan} from './plan-state';
import {PlanBadge} from './PlanBadge';
export function PlanGate({feature,ownerPlan,children}:{feature:Feature;ownerPlan?:PlanId;children:ReactNode}){
 const {effective,practice}=usePlan(),needed=requiredPlan(feature),allowed=practice||(ownerPlan?plans[ownerPlan]:effective).features[feature];
 return <div className={`plan-gate${allowed?'':' plan-locked'}`}>
 {(!allowed||practice)&&<button type="button" className="plan-requirement" onClick={()=>{if(!practice)openUpgrade(feature,needed);}}><span aria-hidden="true">{practice?'◇':'🔒'}</span><PlanBadge plan={needed}/>{practice&&<small>Included in this tutorial</small>}</button>}
 {allowed&&ownerPlan&&ownerPlan!==effective.plan&&!effective.features[feature]&&<small className="plan-included">Included by trip owner</small>}
 <div {...(!allowed?{inert:true}:{})}>{children}</div>{!allowed&&<button type="button" className="plan-gate-hit" aria-label={`Upgrade to ${needed} for ${feature}`} onClick={()=>openUpgrade(feature,needed)}/>}
 </div>;
}
