import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';
// Credentials stay local. Only the allowlisted application files are transmitted.
const auth = JSON.parse(await readFile(join(homedir(), 'AppData/Roaming/com.vercel.cli/Data/auth.json'), 'utf8'));
const roots = ['api', 'server', 'src', 'public'];
const files = [];
async function collect(path) {
  if ((await stat(path)).isDirectory()) for (const name of await readdir(path)) await collect(join(path, name));
  else files.push({file: relative(process.cwd(), path).replaceAll('\\','/'), data: (await readFile(path)).toString('base64'), encoding: 'base64'});
}
for (const root of roots) await collect(root);
for (const path of ['package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'vercel.json']) await collect(path);
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const body = { name: 'origin-trip-planner', project: 'prj_gwUEDAaOWfIF8ihEGiskovutznbU', target: 'production', files, projectSettings: { framework: 'vite', buildCommand: config.buildCommand, outputDirectory: config.outputDirectory, installCommand: 'npm ci' } };
const response = await fetch('https://api.vercel.com/v13/deployments', {method:'POST', headers:{Authorization:`Bearer ${auth.token}`, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
const result = await response.json();
if (!response.ok) throw new Error(result.error?.message || `Deploy failed (${response.status})`);
console.log(JSON.stringify({id:result.id,url:result.url,state:result.readyState},null,2));
