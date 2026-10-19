import {useSyncExternalStore} from 'react';
import {activitySnapshot,subscribeActivity,type Activity} from './activity';

let workspaceOpened=false;
export const hasOpenedWorkspace=()=>workspaceOpened;
export const finishStartup=()=>{workspaceOpened=true;};
export default function LoadingScreen({text='Getting your trips ready…',activity}:{text?:string;activity?:Activity}){
  return <BackgroundStatus text={activity?.text??text}/>;
}
export function ActivityOverlay(){
  const tasks=useSyncExternalStore(subscribeActivity,activitySnapshot);
  return tasks.length?<BackgroundStatus text={tasks.at(-1)!.text}/>:null;
}
export function BackgroundStatus({text}:{text:string}){
 return <div className="background-status" role="status" aria-live="polite"><span aria-hidden="true"/>{text}</div>;
}
