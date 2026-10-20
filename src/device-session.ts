export const sessionWeek=7*24*60*60*1000;
const sessionKey='journas-auth-visit';
type SessionUser={uid:string;metadata:{lastSignInTime?:string}};
/** A sliding device session, renewed only when the site is visited or active. */
export class DeviceSession {
 constructor(private storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,private now=Date.now){}
 visit(user:SessionUser):boolean{
  const now=this.now();let previous:{uid?:string;visited?:number}={};
  try{previous=JSON.parse(this.storage.getItem(sessionKey)??'{}')??{};}catch{}
  const signedIn=Date.parse(user.metadata.lastSignInTime??'');
  const last=previous.uid===user.uid&&Number.isFinite(previous.visited)?previous.visited!:signedIn;
  // A fresh explicit sign-in starts a new session even after the old one expired.
  if(Number.isFinite(last)&&now-last>=sessionWeek&&(!Number.isFinite(signedIn)||now-signedIn>=sessionWeek))return false;
  try{this.storage.setItem(sessionKey,JSON.stringify({uid:user.uid,visited:now}));}catch{}
  return true;
 }
 clear(){try{this.storage.removeItem(sessionKey);}catch{}}
}
