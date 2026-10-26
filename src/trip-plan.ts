import {createContext,useContext} from 'react';
import type {PlanId} from '../shared/plans';
export const TripPlanContext=createContext<PlanId>('tourist');
export const useTripOwnerPlan=()=>useContext(TripPlanContext);
