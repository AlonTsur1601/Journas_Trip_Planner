import {DeviceSession,sessionWeek} from './device-session';
import {ConcurrentReads,isReadAction} from './request-cache';
import {defaultSettings} from './types';
import {getPracticeSession,practiceRequest,type PracticeData} from "./practice";
import { initializeApp } from "firebase/app";
import {actionDescription,beginActivity} from './activity';
import { connectAuthEmulator, initializeAuth, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver, onIdTokenChanged, signOut, setPersistence, type User } from "firebase/auth";
const emulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";
const config = emulators
  ? {
      apiKey: "demo-journas-key",
      authDomain: "demo-journas.firebaseapp.com",
      projectId: "demo-journas",
      appId: "demo-journas-app",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
export const configured = Boolean(
  config.apiKey && config.projectId && config.appId,
);
const app = configured ? initializeApp(config) : null;
export const auth = app ? initializeAuth(app, { persistence: [browserLocalPersistence,browserSessionPersistence], popupRedirectResolver: browserPopupRedirectResolver }) : null;

if (emulators && auth) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
// Migrate existing tab-only sign-ins as well as setting the default for new ones.
const devicePersistenceReady=auth?setPersistence(auth,browserLocalPersistence).catch(()=>{/* Keep the SDK fallback if permanent storage is unavailable. */}):Promise.resolve();
// Publish only sessions that passed the device inactivity check, to every auth consumer.
const sessionListeners=new Set<(user:User|null)=>void>();
const deviceSession=new DeviceSession(window.localStorage);
let sessionUser:User|null=null,sessionReady=false,expiryTimer:ReturnType<typeof setTimeout>|undefined;
function publishSession(user:User|null){if(user)document.documentElement.dataset.appearanceUser=user.uid;else delete document.documentElement.dataset.appearanceUser;sessionUser=user;sessionReady=true;for(const listener of sessionListeners)listener(user);}
async function refreshDeviceSession(user:User|null){
 await devicePersistenceReady;
 if(user!==auth?.currentUser)return;
 clearTimeout(expiryTimer);
 if(!user){deviceSession.clear();publishSession(null);return;}
 if(!deviceSession.visit(user)){await signOut(auth!);return;}
 publishSession(user);
 expiryTimer=setTimeout(()=>{void refreshDeviceSession(auth?.currentUser??null);},sessionWeek);
}
if(auth){
 onIdTokenChanged(auth,user=>{void refreshDeviceSession(user);});
 window.addEventListener('focus',()=>{if(sessionReady)void refreshDeviceSession(auth?.currentUser??null);});
}
export function observeAuthSession(listener:(user:User|null)=>void){
 sessionListeners.add(listener);
 if(sessionReady)queueMicrotask(()=>{if(sessionListeners.has(listener))listener(sessionUser);});
 return ()=>{sessionListeners.delete(listener);};
}
async function request<T = unknown>(
  action: string,
  data: Record<string, unknown> = {},
  signal?:AbortSignal,
  background=false,
  practice:PracticeData|null=getPracticeSession(),
): Promise<T> {
  if(practice&&action.startsWith('share.'))throw Object.assign(new Error('Sharing is unavailable during the guided tutorial.'),{code:'PRACTICE_ONLY'});
  if(practice&&action==='planner.restore'&&practice.documents.length===0)return {trips:[],settings:{...defaultSettings},home:{pins:[],recentTrips:[],recentDays:[]},restore:null} as T;
  if(practice&&!action.startsWith('auth.')&&!action.startsWith('tour.')&&!action.startsWith('places.'))return practiceRequest<T>(practice,async practiceDocuments=>{
    const token=await auth?.currentUser?.getIdToken();
    const response=await fetch('/api/journas',{method:'POST',signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...data,practiceDocuments,screen:null})});
    const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error?.message??'Practice request failed'),{code:result.error?.code});if(result.practiceResult?.historyId)window.dispatchEvent(new Event('journas-action-saved'));if(!['trip.get','trip.list','history.status','planner.restore','settings.get'].includes(action))setTimeout(()=>window.dispatchEvent(new Event('journas-practice-updated')),0);return result;
  });
  const description=background?undefined:actionDescription(action,data);
  const finish=description?beginActivity(description,action==='item.patch'&&['pins','blocks','tasks'].includes(String(data.kind))?'overlay':undefined):()=>{};
  try{
  const token = action==='auth.confirm-verification'?undefined:await auth?.currentUser?.getIdToken();
  const response = await fetch("/api/journas", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, screen:JSON.parse(sessionStorage.getItem('journas-current-screen')??'null'), ...data }),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        result.error?.message ||
          result.error ||
          "Unable to save. Please try again.",
      ),
      {
        status: response.status,
        code: result.error?.code,
        details: result.error?.details,
        current: result.error?.details?.item ?? result.current,
      },
    );
  if(result.historyId)window.dispatchEvent(new Event('journas-action-saved'));
  return result as T;
  }finally{finish();}
}

const concurrentReads=new ConcurrentReads();
export function api<T=unknown>(action:string,data:Record<string,unknown>={},signal?:AbortSignal,background=false,practice:PracticeData|null=getPracticeSession()):Promise<T>{
 if(!signal&&!practice&&isReadAction(action))return concurrentReads.run(JSON.stringify([auth?.currentUser?.uid??null,action,data]),()=>request<T>(action,data,undefined,background,practice));
 return request<T>(action,data,signal,background,practice);
}
