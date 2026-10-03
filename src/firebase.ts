import { initializeApp } from "firebase/app";
import { connectAuthEmulator, initializeAuth, browserSessionPersistence, browserPopupRedirectResolver } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
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
export const db = app ? getFirestore(app) : null;
if (emulators && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export async function api<T = unknown>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  const response = await fetch("/api/journas", {
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
}
