import { readFile } from 'node:fs/promises';
import { cert, initializeApp } from 'firebase-admin/app';

// Direct Rules and Firestore Admin APIs avoid unrelated Service Usage checks in the CLI.
// IAM permissions must already exist; this script never changes IAM or billing.
const credentialPath = process.argv[2];
if (!credentialPath) throw new Error('Pass the external service-account JSON path. Never paste its contents.');
const serviceAccount = JSON.parse(await readFile(credentialPath, 'utf8'));
const project = serviceAccount.project_id;
const app = initializeApp({ credential: cert(serviceAccount) });
const { access_token } = await app.options.credential.getAccessToken();
const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
async function request(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    const reason = (data.error?.details ?? []).map(detail=>detail.reason).filter(Boolean).join(',');
    const error = new Error(`${method} ${new URL(url).hostname}: HTTP ${response.status} (${data.error?.status ?? 'FAILED'}${reason ? `; ${reason}` : ''})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

if (!process.argv.includes('--index-only')) {
const base = `https://firebaserules.googleapis.com/v1/projects/${project}`;
const releaseName = `projects/${project}/releases/cloud.firestore`;
let previous;
try { previous = await request(`${base}/releases/cloud.firestore`); }
catch (error) { if (error.status !== 404) throw error; }
const content = await readFile('firestore.rules', 'utf8');
const ruleset = await request(`${base}/rulesets`, 'POST', { source: { files: [{ name: 'firestore.rules', content }] } });
if (previous) await request(`${base}/releases/cloud.firestore`, 'PATCH', { release: { name: releaseName, rulesetName: ruleset.name }, updateMask: 'rulesetName' });
else await request(`${base}/releases`, 'POST', { name: releaseName, rulesetName: ruleset.name });
const published = await request(`${base}/releases/cloud.firestore`);
if (published.rulesetName !== ruleset.name) throw new Error('Rules release did not match the requested ruleset');
console.log(JSON.stringify({ projectId: project, rulesPublished: true, rulesetName: ruleset.name }));
}

const config = JSON.parse(await readFile('firestore.indexes.json', 'utf8'));
for (const override of config.fieldOverrides) {
  const fieldName = `projects/${project}/databases/(default)/collectionGroups/${override.collectionGroup}/fields/${override.fieldPath}`;
  const url = `https://firestore.googleapis.com/v1/${fieldName}`;
  const existing = await request(url);
  const desired = override.indexes.map(index => ({ queryScope: index.queryScope, fields: [{ fieldPath: override.fieldPath, order: index.order }] }));
  const ready = desired.every(index => existing.indexConfig?.indexes?.some(current => current.queryScope === index.queryScope && current.fields?.some(field => field.fieldPath === override.fieldPath && field.order === index.fields[0].order)));
  if (ready) { console.log(JSON.stringify({ field: override.fieldPath, configured: true, changed: false })); continue; }
  const operation = await request(`${url}?updateMask=indexConfig`, 'PATCH', { name: fieldName, indexConfig: { indexes: desired } });
  console.log(JSON.stringify({ field: override.fieldPath, accepted: true, operationName: operation.name, ready: !!operation.done }));
}
