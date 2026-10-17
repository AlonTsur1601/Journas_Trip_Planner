import {useEffect,useSyncExternalStore} from 'react';
import {Compass} from 'lucide-react';
import {activitySnapshot,subscribeActivity,type Activity} from './activity';

export default function LoadingScreen({text='Getting your trips ready…',activity}:{text?:string;activity?:Activity}){
  return <div className="activity-screen" role="status" aria-live="polite" aria-busy="true"><div className="auth-map-background" aria-hidden="true"/><section className="activity-card" tabIndex={-1}><Compass aria-hidden="true"/><h2>{activity?.text??text}</h2></section></div>;
}
export function ActivityOverlay(){
  const tasks=useSyncExternalStore(subscribeActivity,activitySnapshot);
  useEffect(()=>{
    if(!tasks.length)return;
    const content=document.getElementById('site-content');
    const previous=document.activeElement as HTMLElement|null;
    if(content)content.inert=true;
    document.querySelector<HTMLElement>('.activity-card')?.focus();
    return()=>{if(content)content.inert=false;if(previous?.isConnected)previous.focus();};
  },[Boolean(tasks.length)]);
  return tasks.length?<LoadingScreen key={tasks[0].id} activity={tasks[0]}/>:null;
}
