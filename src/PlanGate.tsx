import {Children,cloneElement,isValidElement,type ReactElement} from 'react';
import {plans,requiredPlan,type Feature,type PlanId} from '../shared/plans';
import {usePlan} from './plan-state';
import {PlanRequirement} from './PlanBadge';
export function PlanGate({feature,ownerPlan,children}:{feature:Feature;ownerPlan?:PlanId;children:ReactElement<any>}){
 const {effective,practice}=usePlan(),needed=requiredPlan(feature),allowed=practice||(ownerPlan?plans[ownerPlan]:effective).features[feature];
 const child=Children.only(children),mark=(!allowed||practice)?<PlanRequirement inline plan={needed} both={needed==='traveler'}/>:null;
 if(child.type==='div'){
  const fields=Children.toArray(child.props.children);
  const heading=fields[0];
  if(isValidElement<any>(heading))fields[0]=cloneElement(heading,{},(heading as ReactElement<any>).props.children,mark);
  if(!allowed)fields[1]=<div key="entitlement-control" className="plan-control"><div inert>{fields[1]}</div></div>;
  return cloneElement(child,{},...fields);
 }
 if(child.type==='button')return cloneElement(child,{className:`${child.props.className??''}${allowed?'':' plan-locked-control'}`,onClick:allowed?child.props.onClick:undefined,disabled:!allowed||child.props.disabled},child.props.children,mark);
 return cloneElement(child,{entitlementMark:mark,entitlementLocked:!allowed});
}
