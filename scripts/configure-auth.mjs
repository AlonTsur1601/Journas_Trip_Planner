import { readFile } from 'node:fs/promises';
import { cert, initializeApp } from 'firebase-admin/app';
const credential = JSON.parse(await readFile(process.argv[2], 'utf8'));
const app = initializeApp({ credential: cert(credential) });
const { access_token } = await app.options.credential.getAccessToken();
const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${credential.project_id}/config`;
const response = await fetch(url, { headers });
if (!response.ok) throw new Error(`Cannot read Auth configuration: HTTP ${response.status}`);
const config = await response.json();
const domain = 'origin-trip-planner.vercel.app';
if (!config.authorizedDomains.includes(domain)) {
  const updated = await fetch(url + '?updateMask=authorizedDomains', { method: 'PATCH', headers, body: JSON.stringify({ authorizedDomains: [...config.authorizedDomains, domain] }) });
  if (!updated.ok) throw new Error(`Cannot authorize production domain: HTTP ${updated.status}`);
  const result = await updated.json();
  if (!result.authorizedDomains.includes(domain)) throw new Error('Production domain was not authorized');
}
console.log(JSON.stringify({ projectId: credential.project_id, emailPasswordEnabled: config.signIn?.email?.enabled, productionDomainAuthorized: true }));
