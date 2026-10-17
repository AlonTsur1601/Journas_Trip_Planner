import {it,expect} from 'vitest';
import {initializeApp as adminApp,deleteApp as deleteAdmin} from 'firebase-admin/app';
import {getAuth as adminAuth} from 'firebase-admin/auth';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {createEmailVerification} from '../src/email-verification-action';
it.skipIf(!process.env.FIREBASE_AUTH_EMULATOR_HOST)('applies a real Firebase verification code for another account',async()=>{
 const projectId='demo-journas';const admin=adminApp({projectId},'verification-test');
 const client=initializeApp({projectId,apiKey:'demo-emulator-only'},'verification-test');
 try{
  const auth=getAuth(client);connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});
  const target=await adminAuth(admin).createUser({email:'target@example.test'});
  const other=await adminAuth(admin).createUser({email:'other@example.test',password:'emulator-only-password'});
  await signInWithEmailAndPassword(auth,'other@example.test','emulator-only-password');
  const link=await adminAuth(admin).generateEmailVerificationLink('target@example.test');
  const code=new URL(link).searchParams.get('oobCode');
  expect(await createEmailVerification(auth,code)()).toBe('target@example.test');
  expect((await adminAuth(admin).getUser(target.uid)).emailVerified).toBe(true);
  expect(auth.currentUser?.uid).toBe(other.uid);
  expect((await adminAuth(admin).getUser(other.uid)).emailVerified).toBe(false);
 }finally{await deleteApp(client);await deleteAdmin(admin);}
},20000);
