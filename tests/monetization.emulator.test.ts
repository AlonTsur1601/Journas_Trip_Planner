import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {firestoreStore,adminApp} from '../server/store';
import {getFirestore} from 'firebase-admin/firestore';
import {JournasService} from '../server/service';
import {retentionAt} from '../server/entitlements';
const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_AUTH_EMULATOR_HOST);
describe.skipIf(!enabled)('monetization against transactional Firestore',()=>{
 const uids:string[]=[],tripIds:string[]=[];
 const now=Date.parse('2026-10-26T12:00:00Z');let store:ReturnType<typeof firestoreStore>;
 beforeAll(()=>{process.env.FIREBASE_PROJECT_ID='demo-journas';store=firestoreStore();});
 afterAll(async()=>{const db=getFirestore(adminApp());for(const id of tripIds)await db.recursiveDelete(db.doc(`trips/${id}`));for(const uid of uids)await db.recursiveDelete(db.doc(`users/${uid}`));});
 async function account(plan='tourist'){const uid=`monetization_${randomUUID().replaceAll('-','')}`;uids.push(uid);await store.transaction(async tx=>tx.set(`users/${uid}`,{id:uid,tripCount:0,billing:{source:'test',plan},settings:{autoDelete:false}}));return uid;}
 async function create(service:JournasService,uid:string,startDate:string,endDate=startDate){const result=await service.execute(uid,{action:'trip.create',name:'Emulator test',startDate,endDate,lodging:{lng:2.3,lat:48.8},clientTimezone:'UTC'}) as any;tripIds.push(result.trip.id);return result.trip;}
 it('serializes competing creations for the final tourist trip slot',async()=>{const uid=await account(),service=new JournasService(store,()=>now,true);for(let i=1;i<=4;i++)await create(service,uid,`2026-11-0${i}`);const result=await Promise.allSettled([create(service,uid,'2026-11-05'),create(service,uid,'2026-11-06')]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);const list=await service.execute(uid,{action:'trip.list'}) as any;expect(list.trips).toHaveLength(5);},30000);
 it('enforces participant quota under competing joins',async()=>{const uid=await account(),service=new JournasService(store,()=>now,true),trip=await create(service,uid,'2026-11-01'),{token}=await service.execute(uid,{action:'share.create',tripId:trip.id,mode:'editor'});for(let i=0;i<3;i++)await service.execute(await account(),{action:'share.join',token});const a=await account(),b=await account(),result=await Promise.allSettled([service.execute(a,{action:'share.join',token}),service.execute(b,{action:'share.join',token})]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);const stored=await store.transaction(tx=>tx.get(`trips/${trip.id}`));expect(stored?.memberIds).toHaveLength(5);},30000);
 it('expires owner data for everyone and invalidates public share access',async()=>{const owner=await account(),guest=await account('adventurer');let clock=now;const service=new JournasService(store,()=>clock,true),trip=await create(service,owner,'2026-11-01'),{token}=await service.execute(owner,{action:'share.create',tripId:trip.id,mode:'editor'});await service.execute(guest,{action:'share.join',token});clock=retentionAt(trip,{billing:{source:'test',plan:'tourist'}},now)+1;await expect(service.execute(guest,{action:'trip.get',tripId:trip.id,date:'2026-11-01'})).rejects.toMatchObject({code:'TRIP_EXPIRED'});await expect(service.execute(null,{action:'share.read',token})).rejects.toMatchObject({code:'INVALID_SHARE'});await service.cleanup();const stored=await store.transaction(tx=>tx.get(`trips/${trip.id}`));expect(!stored||stored.deleted).toBe(true);},30000);
});
