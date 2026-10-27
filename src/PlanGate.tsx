import {Children,cloneElement,type ReactElement} from 'react';
import {plans,requiredPlan,type Feature,type PlanId} from '../shared/plans';
import {openUpgrade,usePlan} from './plan-state';
import {PlanRequirement} from './PlanBadge';
export function PlanGate({feature,ownerPlan,children}:{feature:Feature;ownerPlan?:PlanId;children:ReactElement<any>}){
 const {effective,practice}=usePlan(),needed=requiredPlan(feature),allowed=practice||(ownerPlan?plans[ownerPlan]:effective).features[feature];
 const child=Children.only(children),mark=(!allowed||practice)?<PlanRequirement inline plan={needed} both={needed==='traveler'}/>:null;
 if(child.type==='button')return cloneElement(child,{className:`${child.props.className??''}${allowed?'':' plan-locked-control'}`,onClick:allowed?child.props.onClick:()=>openUpgrade(feature,needed)},child.props.children,mark);
 return cloneElement(child,{entitlementMark:mark,entitlementLocked:!allowed,entitlementAction:()=>openUpgrade(feature,needed)});
}
