import type {User} from 'firebase/auth';
export const accountName=(name:string|undefined,fallback='Account')=>name?.trim()||fallback;
/** Sign-in providers authenticate only; profile appearance belongs to Journas. */
export function accountPhoto(_user:Pick<User,'photoURL'|'providerData'>|null,_googleSession:boolean,customPhoto?:string){
 return customPhoto||undefined;
}
