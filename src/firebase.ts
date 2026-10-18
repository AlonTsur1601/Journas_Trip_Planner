import {defaultSettings} from './types';
import {getPracticeSession,practiceRequest,type PracticeData} from "./practice";
import { initializeApp } from "firebase/app";
import {actionDescription,beginActivity} from './activity';
import { connectAuthEmulator, initializeAuth, browserSessionPersistence, browserPopupRedirectResolver } from "firebase/auth";
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
export const auth = app ? initializeAuth(app, { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver }) : null;

if (emulators && auth) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
export async function api<T = unknown>(
  action: string,
  data: Record<string, unknown> = {},
  signal?:AbortSignal,
  background=false,
  practice:PracticeData|null=getPracticeSession(),
): Promise<T> {
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
