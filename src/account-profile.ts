import type {User} from 'firebase/auth';
export const accountName=(name:string|undefined,fallback='Account')=>name?.trim()||fallback;
/** Uploaded photos take priority for every sign-in method. Password sign-in uses initials otherwise. */
export function accountPhoto(user:Pick<User,'photoURL'|'providerData'>|null,googleSession:boolean,customPhoto?:string){
 if(customPhoto)return customPhoto;
 return googleSession?user?.providerData.find(provider=>provider.providerId==='google.com')?.photoURL||user?.photoURL||undefined:undefined;
}
