import type {IncomingMessage,ServerResponse} from 'node:http';
import {assertStaging,assertStagingAccount} from '../server/staging.js';
import {adminAuth} from '../server/store.js';
const allowed=new Set(['/v1/accounts:signInWithPassword','/v1/accounts:lookup','/v1/accounts:update','/v1/token']);
export default async function handler(req:IncomingMessage&{body?:unknown},res:ServerResponse){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 try{assertStaging();const url=new URL(req.url??'','https://staging.invalid'),path=url.pathname.replace(/^\/api\/firebase-auth/,'')||`/${url.searchParams.get('authPath')??''}`;
  if(req.method!=='POST'||!allowed.has(path)){res.statusCode=404;res.end(JSON.stringify({error:{message:'OPERATION_NOT_ALLOWED'}}));return;}
  const contentType=String(req.headers['content-type']??'application/json');
  let raw=typeof req.body==='string'?req.body:req.body?(contentType.startsWith('application/x-www-form-urlencoded')?new URLSearchParams(req.body as Record<string,string>).toString():JSON.stringify(req.body)):'';if(!raw)for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>50000)throw Error('Request too large');}
  const key=process.env.FIREBASE_WEB_API_KEY;if(!key)throw Error('Not configured');
  if(path.endsWith('signInWithPassword')){const body=JSON.parse(raw);await assertStagingAccount(body.email);}
  if(path.endsWith('accounts:update')){const body=JSON.parse(raw),token=await adminAuth().verifyIdToken(String(body.idToken??''),true);await assertStagingAccount(token.email);if(Object.keys(body).some(k=>!['idToken','password','returnSecureToken','tenantId'].includes(k)))throw Error('Account changes are restricted in staging');}
  const host=path==='/v1/token'?'securetoken.googleapis.com':'identitytoolkit.googleapis.com';
  const upstream=await fetch(`https://${host}${path}?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':String(req.headers['content-type']??'application/json')},body:raw,signal:AbortSignal.timeout(10000)});
  const response=await upstream.json();
  res.statusCode=upstream.status;res.end(JSON.stringify(response));
 }catch{res.statusCode=403;res.end(JSON.stringify({error:{message:'OPERATION_NOT_ALLOWED'}}));}
}
