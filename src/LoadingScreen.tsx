import {Compass} from 'lucide-react';
import {useSyncExternalStore} from 'react';
import {activitySnapshot,subscribeActivity,type Activity} from './activity';

let workspaceOpened=false;
export const hasOpenedWorkspace=()=>workspaceOpened;
export const finishStartup=()=>{workspaceOpened=true;};
export default function LoadingScreen({text='Getting your trips ready…',activity,startup=false}:{text?:string;activity?:Activity;startup?:boolean}){
  if(startup&&!workspaceOpened)return <div className="home-page activity-screen" role="status" aria-live="polite"><div className="auth-map-background" aria-hidden="true"/><div className="activity-card"><Compass aria-hidden="true"/><strong>Journas</strong><h2>{text}</h2><span className="loading-spinner startup-progress" aria-hidden="true"/></div></div>;
  return <BackgroundStatus text={activity?.text??text}/>;
}
export function ActivityOverlay(){
  const tasks=useSyncExternalStore(subscribeActivity,activitySnapshot);
  return tasks.length?<BackgroundStatus text={tasks.at(-1)!.text}/>:null;
}
export function BackgroundStatus({text}:{text:string}){
 return <div className="background-status" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true"/>{text}</div>;
}
