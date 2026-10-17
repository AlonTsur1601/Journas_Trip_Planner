export type Activity = {id:number; text:string;presentation?:"overlay"};
let nextId=0;
let active:Activity[]=[];
const listeners=new Set<()=>void>();
export const activitySnapshot=()=>active;
export const subscribeActivity=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const emit=()=>listeners.forEach(listener=>listener());
export function beginActivity(text:string,presentation?:"overlay"){
  const task:Activity={id:++nextId,text,...(presentation?{presentation}:{})};
  active=[...active,task];emit();
  let ended=false;
  return ()=>{
    if(ended)return;ended=true;
    active=active.filter(item=>item.id!==task.id);emit();
  };
}
export async function withActivity<T>(text:string,work:()=>Promise<T>){
  const finish=beginActivity(text);
  try{return await work();}finally{finish();}
}
export function actionDescription(action:string,data:Record<string,unknown>):string|undefined{
  if(action==='item.patch'||action==='item.delete'){
    const kind=String(data.kind??'item');const noun=({pins:'place',blocks:'time block',tasks:'task',connections:'connection'} as Record<string,string>)[kind]??'change';
    return `${action==='item.delete'?'Removing':'Saving'} your ${noun}…`;
  }
  return ({'trip.get':'Loading your day and places…','trip.create':'Creating your trip…','trip.update':'Saving your trip details…','trip.remove':'Removing your trip…','share.join':'Adding the shared trip to your account…','share.create':'Creating your sharing link…','share.revoke':'Turning off trip sharing…','member.remove':'Updating traveler access…','settings.save':'Saving your preferences…','auth.email-verification':'Sending your verification email…','history.undo':'Undoing your last change…','history.redo':'Restoring your change…'} as Record<string,string>)[action];
}
