import type {IncomingMessage,ServerResponse} from 'node:http';
import {assertStaging} from '../server/staging.js';
import {validSignature,applyBillingEvent} from '../server/billing.js';
import {billingNotices} from '../server/billing-mail.js';
import {firestoreStore} from '../server/store.js';
export const config={api:{bodyParser:false}};
export default async function handler(req:IncomingMessage,res:ServerResponse){
 res.setHeader('Cache-Control','no-store');
 try{assertStaging();if(req.method!=='POST'){res.statusCode=405;res.end();return;}let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1000000){res.statusCode=413;res.end();return;}}
  const secret=process.env.PADDLE_WEBHOOK_SECRET;if(!secret||!validSignature(raw,String(req.headers['paddle-signature']??''),secret)){res.statusCode=401;res.end();return;}
  await applyBillingEvent(firestoreStore(),JSON.parse(raw));await billingNotices(firestoreStore()).catch(()=>{});res.statusCode=200;res.end('ok');
 }catch{res.statusCode=503;res.end('Webhook processing unavailable; retry.');}
}
