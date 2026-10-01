import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
const emulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";
const config = emulators
  ? {
      apiKey: "demo-tevel-key",
      authDomain: "demo-tevel.firebaseapp.com",
      projectId: "demo-tevel",
      appId: "demo-tevel-app",
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
export const auth = app ? getAuth(app) : null;
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
  const response = await fetch("/api/tevel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...data }),
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
  return result as T;
}
