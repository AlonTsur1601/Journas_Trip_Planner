import {Compass} from 'lucide-react';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {activitySnapshot,subscribeActivity,type Activity} from './activity';

let workspaceOpened=false;
export const hasOpenedWorkspace=()=>workspaceOpened;
export const finishStartup=()=>{workspaceOpened=true;};
/** Keep rotation continuous when authentication replaces the loading screen. */
export function LoadingSpinner({startup=false}:{startup?:boolean}){
 return <svg className={`loading-spinner${startup?' startup-progress':''}`} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle className="loading-spinner-track" cx="12" cy="12" r="9"/><g><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/><circle className="loading-spinner-arc" cx="12" cy="12" r="9"/></g></svg>;
}
export default function LoadingScreen({text='Getting your trips ready…',activity,startup=false}:{text?:string;activity?:Activity;startup?:boolean}){
  const [retryAvailable,setRetryAvailable]=useState(false);
  useEffect(()=>{if(!startup)return;const timer=setTimeout(()=>setRetryAvailable(true),12000);return()=>clearTimeout(timer);},[startup]);
  if(startup)return <div className="home-page activity-screen" role="status" aria-live="polite"><div className="auth-map-background" aria-hidden="true"/><div className="activity-card"><div className="brand home-brand startup-brand"><Compass aria-hidden="true"/><strong>Journas</strong></div><h2>{text}</h2><LoadingSpinner startup/>{retryAvailable&&<button className="button primary" onClick={()=>window.location.reload()}>Try again</button>}</div></div>;
  return <BackgroundStatus text={activity?.text??text}/>;
}
export function ActivityOverlay(){
  const tasks=useSyncExternalStore(subscribeActivity,activitySnapshot);
  return tasks.length?<BackgroundStatus text={tasks.at(-1)!.text}/>:null;
}
export function BackgroundStatus({text}:{text:string}){
 return <div className="background-status" role="status" aria-live="polite"><LoadingSpinner/>{text}</div>;
}
