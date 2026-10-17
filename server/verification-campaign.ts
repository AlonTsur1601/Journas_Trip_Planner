import {randomBytes,createHash} from 'node:crypto';
import {adminAuth,firestoreStore} from './store.js';
import {ApiError} from './types.js';
export const verificationCampaign='email-confirmation-2026-10-17';
const proofPath=(proof:string)=>`rateLimits/verification_proof_${createHash('sha256').update(proof).digest('hex')}`;
export async function verificationStatus(uid:string){const account=await adminAuth().getUser(uid);const record=await firestoreStore().transaction(tx=>tx.get(`users/${uid}`));return {verified:!account.disabled&&account.emailVerified&&record?.verificationCampaign===verificationCampaign&&record?.verifiedEmail===account.email};}
export async function createVerificationProof(uid:string,email:string){const proof=randomBytes(32).toString('hex');await firestoreStore().transaction(async tx=>{tx.set(proofPath(proof),{uid,email,expiresAt:Date.now()+3600000});});return proof;}
export async function confirmVerification(value:unknown){
 if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new ApiError(400,'INVALID_VERIFICATION','This verification link is invalid or has expired.');
 const store=firestoreStore(),path=proofPath(value),proof=await store.transaction(tx=>tx.get(path));
 if(!proof||Number(proof.expiresAt)<Date.now())throw new ApiError(400,'INVALID_VERIFICATION','This verification link is invalid or has expired.');
 const uid=String(proof.uid),account=await adminAuth().getUser(uid);
 if(account.disabled||account.email!==proof.email)throw new ApiError(400,'INVALID_VERIFICATION','This verification link no longer matches the account.');
 if(!account.emailVerified)await adminAuth().updateUser(uid,{emailVerified:true});
 await store.transaction(async tx=>{const user=await tx.get(`users/${uid}`)??{};tx.set(`users/${uid}`,{...user,verificationCampaign,verifiedEmail:account.email});});
 return {email:account.email};
}

export async function discardVerificationProof(proof:string){await firestoreStore().transaction(async tx=>{tx.delete(proofPath(proof));});}
