import {useSyncExternalStore} from 'react';
import {Compass} from 'lucide-react';
import {activitySnapshot,subscribeActivity,type Activity} from './activity';

let workspaceOpened=false;
export const hasOpenedWorkspace=()=>workspaceOpened;
export const finishStartup=()=>{workspaceOpened=true;};
export default function LoadingScreen({text='Getting your trips ready…',activity}:{text?:string;activity?:Activity}){
  if(workspaceOpened)return <BackgroundStatus text={activity?.text??text}/>;
  return <div className="activity-screen activity-translucent" role="status" aria-live="polite" aria-busy="true"><div className="auth-map-background" aria-hidden="true"/><section className="activity-card" tabIndex={-1}><Compass aria-hidden="true"/><h2>{activity?.text??text}</h2></section></div>;
}
export function ActivityOverlay(){
  const tasks=useSyncExternalStore(subscribeActivity,activitySnapshot);
  return tasks.length?<BackgroundStatus text={tasks.at(-1)!.text}/>:null;
}
export function BackgroundStatus({text}:{text:string}){
 return <div className="background-status" role="status" aria-live="polite"><span aria-hidden="true"/>{text}</div>;
}
