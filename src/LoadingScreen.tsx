import {Compass} from 'lucide-react';
import {useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import {activitySnapshot,subscribeActivity,type Activity} from './activity';

let workspaceOpened=false;
export const hasOpenedWorkspace=()=>workspaceOpened;
export const finishStartup=()=>{workspaceOpened=true;};
/** Keep rotation continuous when authentication replaces the loading screen. */
export function LoadingSpinner({startup=false}:{startup?:boolean}){
 const ref=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{for(const animation of ref.current?.getAnimations()??[])if(animation instanceof CSSAnimation&&animation.animationName==='startup-spin')animation.startTime=0;},[]);
 return <span ref={ref} className={`loading-spinner${startup?' startup-progress':''}`} aria-hidden="true"/>;
}
export default function LoadingScreen({text='Getting your trips ready…',activity,startup=false}:{text?:string;activity?:Activity;startup?:boolean}){
  if(startup&&!workspaceOpened)return <div className="home-page activity-screen" role="status" aria-live="polite"><div className="auth-map-background" aria-hidden="true"/><div className="activity-card"><div className="brand home-brand startup-brand"><Compass aria-hidden="true"/><strong>Journas</strong></div><h2>{text}</h2><LoadingSpinner startup/></div></div>;
  return <BackgroundStatus text={activity?.text??text}/>;
}
export function ActivityOverlay(){
  const tasks=useSyncExternalStore(subscribeActivity,activitySnapshot);
  return tasks.length?<BackgroundStatus text={tasks.at(-1)!.text}/>:null;
}
export function BackgroundStatus({text}:{text:string}){
 return <div className="background-status" role="status" aria-live="polite"><LoadingSpinner/>{text}</div>;
}
