import {useSyncExternalStore} from 'react';
import {plans,type BillingStatus,type PlanId,type Feature} from '../shared/plans';
import {practiceActive} from './practice';
export type {PlanId,Feature,BillingStatus};
let current:BillingStatus={plan:'tourist',source:'free',status:'free',periodEnd:null,pendingPlan:null};
const listeners=new Set<()=>void>();
export function acceptPlanResult(result:any){if(result?.billing){current=result.billing;for(const listener of listeners)listener();}}
export const resetPlan=()=>acceptPlanResult({billing:{plan:'tourist',source:'free',status:'free',periodEnd:null,pendingPlan:null}});
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function usePlan(){const billing=useSyncExternalStore(subscribe,()=>current);return {billing,personal:plans[billing.plan],effective:practiceActive()?plans.adventurer:plans[billing.plan],practice:practiceActive()};}
export function openUpgrade(feature?:string,requiredPlan?:PlanId){window.dispatchEvent(new CustomEvent('journas-upgrade',{detail:{feature,requiredPlan}}));}
export function requirePersonal(feature:Feature){return practiceActive()||plans[current.plan].features[feature];}
