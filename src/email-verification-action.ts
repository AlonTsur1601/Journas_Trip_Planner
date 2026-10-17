import {applyActionCode,checkActionCode,type Auth} from 'firebase/auth';

export function createEmailVerification(auth:Auth|null,code:string|null){
  let pending:Promise<string|undefined>|undefined;
  return ()=>{
    if(pending)return pending;
    pending=(async()=>{
      if(!auth)throw Object.assign(new Error('Email verification is unavailable'),{code:'auth/internal-error'});
      if(!code)throw Object.assign(new Error('Missing verification code'),{code:'auth/invalid-action-code'});
      const info=await checkActionCode(auth,code);
      if(info.operation!=='VERIFY_EMAIL')throw Object.assign(new Error('Wrong action'),{code:'auth/invalid-action-code'});
      await applyActionCode(auth,code);
      return info.data.email??undefined;
    })().catch(error=>{pending=undefined;throw error;});
    return pending;
  };
}
export function verificationFailure(error:unknown){
  const code=(error as {code?:string})?.code;
  if(code==='INVALID_VERIFICATION')return {retryable:false,message:'This verification link is invalid or has expired. Request a new email in your original Journas window.'};
  if(code==='auth/expired-action-code'||code==='auth/invalid-action-code')return {retryable:false,message:'This verification link has expired or was already used. Request a new email in your original Journas window and open the newest message.'};
  if(code==='auth/user-disabled'||code==='auth/user-not-found')return {retryable:false,message:'This account is unavailable. Return to Journas to sign in or create an account.'};
  if(code==='auth/too-many-requests')return {retryable:true,message:'Too many verification attempts. Wait a little, then try again using the button below.'};
  return {retryable:true,message:'We could not reach the verification service. Check your connection and try again. Your verification link is still available.'};
}
