import {ApiError} from './types.js';
export const stagingEnabled=()=>process.env.JOURNAS_ENV==='monetization-staging';
export function assertStaging(){
 if(!stagingEnabled())throw new ApiError(503,'STAGING_REQUIRED','This version is available only in the isolated monetization staging environment.');
 const project=process.env.FIREBASE_PROJECT_ID??'';
 if(!project.includes('monetization')||process.env.BILLING_ENV!=='sandbox'||process.env.ADS_MODE!=='mock')throw new ApiError(503,'UNSAFE_ENVIRONMENT','Staging must use its isolated Firebase project, sandbox billing and mock ads.');
 if(process.env.VERCEL_PROJECT_PRODUCTION_URL==='journas-trip-planner.vercel.app')throw new ApiError(503,'UNSAFE_ENVIRONMENT','The regular production project cannot run this build.');
}
export async function assertStagingAccount(email:string|undefined){
 const allowed=(process.env.STAGING_ALLOWED_EMAILS??'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 if(!email||!allowed.includes(email.toLowerCase()))throw new ApiError(403,'STAGING_ACCOUNT_REQUIRED','This staging environment is restricted to authorized test accounts.');
}
