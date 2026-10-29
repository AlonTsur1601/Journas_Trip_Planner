import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!enabled)('Firestore rules against the real emulator', () => {
    let env: RulesTestEnvironment;
    beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-journas-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); await setDoc(doc(db, 'trips/trip'), { id: 'trip', ownerId: 'alice', memberIds: ['alice', 'bob'], deleted: false }); await setDoc(doc(db, 'trips/trip/days/2026-10-01/items/pin'), { id: 'pin', kind: 'pins', title: 'Museum' }); await setDoc(doc(db, 'users/alice/trips/trip'), {id:'trip',cleanupAt:9007199254740991}); await setDoc(doc(db, 'users/bob/trips/trip'), {id:'trip',cleanupAt:9007199254740991}); await setDoc(doc(db, 'users/alice'), { settings: { autoDelete: true }, tripCount: 1, verificationCampaign:'email-confirmation-2026-10-17',verifiedEmail:'user@example.test' }); await setDoc(doc(db, 'users/bob'), {verificationCampaign:'email-confirmation-2026-10-17',verifiedEmail:'user@example.test'}); await setDoc(doc(db, 'users/alice/layouts/trip_2026-10-01'), { tripId: 'trip', date: '2026-10-01', layout: { map: true } }); await setDoc(doc(db, 'shares/token'), { tripId: 'trip', mode: 'editor' }); }); });
    afterAll(async () => { await env?.cleanup(); });
    it('rejects stale campaign and mismatched email despite verified tokens', async () => { const stale=env.authenticatedContext('bob',{email_verified:true,email:'other@example.test'}).firestore(); await assertFails(getDoc(doc(stale,'trips/trip'))); await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'users/bob'),{verificationCampaign:'old',verifiedEmail:'user@example.test'})); const db=env.authenticatedContext('bob',{email_verified:true,email:'user@example.test'}).firestore(); await assertFails(getDoc(doc(db,'trips/trip'))); await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'users/bob'),{verificationCampaign:'email-confirmation-2026-10-17',verifiedEmail:'user@example.test'})); });
    it('members can watch the active day query', async () => { const db = env.authenticatedContext('bob', { email_verified: true, email: 'user@example.test' }).firestore(); await assertSucceeds(getDocs(collection(db, 'trips/trip/days/2026-10-01/items'))); });
    it('unverified, public viewers and unrelated users cannot read a private trip', async () => { for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('eve', { email_verified: true, email: 'user@example.test' }).firestore(), env.authenticatedContext('alice', { email_verified: false }).firestore()])
        await assertFails(getDoc(doc(db, 'trips/trip'))); });
    it('even the owner cannot bypass server validation, quota or sharing', async () => { const db = env.authenticatedContext('alice', { email_verified: true, email: 'user@example.test' }).firestore(); await assertFails(setDoc(doc(db, 'trips/trip'), { memberIds: ['eve'] })); await assertFails(setDoc(doc(db, 'trips/trip/days/2026-10-01/items/pin'), { title: 'Bypass' })); await assertFails(setDoc(doc(db, 'users/alice'), { tripCount: 0 })); await assertFails(getDoc(doc(db, 'shares/token'))); });
    it('personal layout and settings are inaccessible to other members', async () => { const db = env.authenticatedContext('bob', { email_verified: true, email: 'user@example.test' }).firestore(); await assertFails(getDoc(doc(db, 'users/alice'))); await assertFails(getDoc(doc(db, 'users/alice/layouts/trip_2026-10-01'))); });
    it('denies personal and owner retention deadlines before physical deletion', async () => {
        await env.withSecurityRulesDisabled(async ctx => {
            const db=ctx.firestore();
            await setDoc(doc(db,'trips/expired'),{id:'expired',ownerId:'alice',memberIds:['alice','bob'],deleted:false,ownerCleanupAt:Date.now()+86400000});
            await setDoc(doc(db,'users/bob/trips/expired'),{id:'expired',cleanupAt:Date.now()-1000});
        });
        const db=env.authenticatedContext('bob',{email_verified:true,email:'user@example.test'}).firestore();
        await assertFails(getDoc(doc(db,'trips/expired')));
        await env.withSecurityRulesDisabled(async ctx => {
            await setDoc(doc(ctx.firestore(),'users/bob/trips/expired'),{id:'expired',cleanupAt:Date.now()+86400000});
            await setDoc(doc(ctx.firestore(),'trips/expired'),{id:'expired',ownerId:'alice',memberIds:['alice','bob'],deleted:false,ownerCleanupAt:Date.now()-1000});
        });
        await assertFails(getDoc(doc(db,'trips/expired')));
    });
    it('removal immediately denies former member reads even with a valid session', async () => { await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'trips/trip'), { id: 'trip', ownerId: 'alice', memberIds: ['alice'], deleted: false })); const db = env.authenticatedContext('bob', { email_verified: true, email: 'user@example.test' }).firestore(); await assertFails(getDoc(doc(db, 'trips/trip'))); await assertFails(getDocs(collection(db, 'trips/trip/days/2026-10-01/items'))); });
    it('global tombstone immediately denies all reads, including old layout records', async () => { await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'trips/trip'), { id: 'trip', ownerId: 'alice', memberIds: ['alice'], deleted: true })); const db = env.authenticatedContext('alice', { email_verified: true, email: 'user@example.test' }).firestore(); await assertFails(getDoc(doc(db, 'trips/trip'))); await assertFails(getDoc(doc(db, 'users/alice/layouts/trip_2026-10-01'))); });
});
