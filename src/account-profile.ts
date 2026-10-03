import type {User} from 'firebase/auth';

export function accountPhoto(user:Pick<User,'photoURL'|'providerData'>|null,googleSession:boolean,customPhoto?:string){
  if(googleSession)return user?.providerData.find(provider=>provider.providerId==='google.com')?.photoURL||user?.photoURL||undefined;
  return customPhoto||user?.photoURL||undefined;
}
