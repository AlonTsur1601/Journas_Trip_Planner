import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
const credentialPath = process.argv[2];
if (!credentialPath) throw new Error('Pass the local service-account JSON path. Never paste its contents.');
const serviceAccount = JSON.parse(await readFile(credentialPath, 'utf8'));
const app = initializeApp({credential:cert(serviceAccount)});
const {access_token} = await app.options.credential.getAccessToken();
const headers = {Authorization:`Bearer ${access_token}`};
const endpoint = `https://firebase.googleapis.com/v1beta1/projects/${serviceAccount.project_id}`;
const response = await fetch(`${endpoint}/webApps`,{headers});
const listing = await response.json();
if (!response.ok) throw new Error(`Cannot read Web app config (${response.status}): ${listing.error?.message || 'Check Firebase permissions'}`);
const webApp = listing.apps?.[0];
if (!webApp) throw new Error('Add a Web app in Firebase Project settings first.');
const configResponse = await fetch(`https://firebase.googleapis.com/v1beta1/${webApp.name}/config`,{headers});
const config = await configResponse.json();
if (!configResponse.ok) throw new Error(`Web app config unavailable (${configResponse.status})`);
let cronSecret = randomBytes(32).toString('hex');
try { const existing = await readFile('.env.local','utf8'); cronSecret = existing.match(/^CRON_SECRET=(.+)$/m)?.[1] || cronSecret; } catch {}
const env = [
  `VITE_FIREBASE_API_KEY=${config.apiKey}`, `VITE_FIREBASE_AUTH_DOMAIN=${config.authDomain || serviceAccount.project_id+'.firebaseapp.com'}`,
  `VITE_FIREBASE_PROJECT_ID=${serviceAccount.project_id}`, `VITE_FIREBASE_APP_ID=${config.appId}`,
  `FIREBASE_PROJECT_ID=${serviceAccount.project_id}`, `GOOGLE_APPLICATION_CREDENTIALS=${JSON.stringify(credentialPath.replaceAll('\\','/'))}`,
  `CRON_SECRET=${cronSecret}`, ''
].join('\n');
await writeFile('.env.local',env);
console.log(JSON.stringify({projectId:serviceAccount.project_id,webAppConfigured:true,privateKeyCopied:false,envFile:'.env.local'}));
