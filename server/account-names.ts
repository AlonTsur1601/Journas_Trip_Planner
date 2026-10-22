import {createHash} from 'node:crypto';
import {ApiError,type Transaction} from './types.js';
export function accountNameKey(value:unknown){
 if(typeof value!=='string'||value.length>80||!value.trim()||/[\p{Cc}\p{Cf}]/u.test(value))throw new ApiError(400,'INVALID_ACCOUNT_NAME','Enter an account name of 1 to 80 visible characters.');
 return value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
}
const pathFor=(key:string)=>`accountNames/${createHash('sha256').update(key).digest('hex')}`;
export async function initializeAccountNames(tx:Transaction){
 if(await tx.get('accountNameRegistry/state'))return;
 const users=await tx.list('users'),owners=new Map<string,string[]>();
 for(const user of users){const name=(user.settings as any)?.displayName;if(typeof name!=='string'||!name.trim())continue;let key:string;try{key=accountNameKey(name);}catch{continue;}if(typeof user.id!=='string')throw new Error('Account name migration requires user identities');const list=owners.get(key)??[];list.push(user.id);owners.set(key,list);}
 for(const[key,ownerIds]of owners)tx.set(pathFor(key),{ownerIds});
 tx.set('accountNameRegistry/state',{version:1});
}
export async function accountNameAvailable(tx:Transaction,uid:string,value:unknown){
 const key=accountNameKey(value);await initializeAccountNames(tx);
 const entry=await tx.get(pathFor(key));return !entry||(entry.ownerIds as string[]).every(owner=>owner===uid);
}
export async function claimAccountName(tx:Transaction,uid:string,value:unknown,previous:unknown){
 const key=accountNameKey(value);await initializeAccountNames(tx);
 let oldKey:string|undefined;try{oldKey=accountNameKey(previous);}catch{}
 // Existing duplicate names can be kept, but nobody else can claim them.
 if(key===oldKey)return;
 const path=pathFor(key),entry=await tx.get(path);
 if(entry&&(entry.ownerIds as string[]).some(owner=>owner!==uid))throw new ApiError(409,'ACCOUNT_NAME_TAKEN','This account name is already taken. Choose another name.');
 if(oldKey){const oldPath=pathFor(oldKey),old=await tx.get(oldPath);if(old){const ownerIds=(old.ownerIds as string[]).filter(owner=>owner!==uid);if(ownerIds.length)tx.set(oldPath,{ownerIds});else tx.delete(oldPath);}}
 tx.set(path,{ownerIds:[uid]});
}
