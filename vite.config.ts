import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({command,mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 if(command==='build'&&(env.VITE_JOURNAS_ENV!=='monetization-staging'||!env.VITE_FIREBASE_PROJECT_ID?.includes('monetization')||env.JOURNAS_ENV!=='monetization-staging'||env.BILLING_ENV!=='sandbox'||env.ADS_MODE!=='mock'||env.FIREBASE_PROJECT_ID!==env.VITE_FIREBASE_PROJECT_ID))throw new Error('Unsafe build: configure isolated staging Firebase, sandbox billing and mock ads.');
 return {plugins:[react()],server:{proxy:{'/api':'http://127.0.0.1:3001'}}};
});
