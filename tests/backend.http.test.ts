import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { adminAuth, adminApp, purgeExpiredRateLimits } from '../server/store.js';
import { getFirestore } from 'firebase-admin/firestore';
import { originHandler, cleanupHandler } from '../server/http.js';
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
describe.skipIf(!enabled)('HTTP API with real Firebase Auth emulator', () => {
    let server: Server, base: string, verified: string, unverified: string;
    const ids: string[] = [];
    async function account(emailVerified: boolean) {
        const uid = `http_${randomUUID()}`;
        ids.push(uid);
        await adminAuth().createUser({ uid, email: `${uid}@example.test`, emailVerified });
        const customToken = await adminAuth().createCustomToken(uid);
        const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
        const data = await response.json();
        if (!data.idToken)
            throw new Error('Auth emulator sign-in failed');
        return data.idToken as string;
    }
    beforeAll(async () => {
        process.env.FIREBASE_PROJECT_ID = 'demo-origin';
        verified = await account(true);
        unverified = await account(false);
        server = createServer((req, res) => { if (req.url === '/api/cleanup')
            void cleanupHandler(req, res);
        else
            void originHandler(req, res); });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('Test server did not start');
        base = `http://127.0.0.1:${address.port}`;
    });
    afterAll(async () => { await new Promise<void>(resolve => server?.close(() => resolve())); for (const uid of ids)
        await adminAuth().deleteUser(uid); });
    const post = (payload: unknown, token?: string) => fetch(base + '/api/origin', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
    it('requires server-verified identity and verified email', async () => {
        expect((await post({ action: 'trip.list' })).status).toBe(401);
        expect((await post({ action: 'trip.list' }, 'forged-token')).status).toBe(401);
        const rejected = await post({ action: 'trip.list' }, unverified);
        expect(rejected.status).toBe(403);
        expect((await rejected.json()).error.code).toBe('EMAIL_UNVERIFIED');
        expect((await post({ action: 'trip.list' }, verified)).status).toBe(200);
    });
    it('allows validated public previews only and rejects oversized or wrong-format input', async () => {
        expect((await post({ action: 'share.read', token: 'invalid' })).status).toBe(404);
        expect((await post({ action: 'settings.save', settings: { displayName: 'x'.repeat(100001) } }, verified)).status).toBe(413);
        expect((await fetch(base + '/api/origin', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
        expect((await fetch(base + '/api/origin')).status).toBe(405);
    });
    it('creates and removes a trip through the authenticated HTTP path', async () => {
        const response = await post({ action: 'trip.create', name: 'HTTP trip', startDate: '2026-10-01', endDate: '2026-10-01', clientTimezone: 'UTC' }, verified);
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.trip.memberIds).toEqual([ids[0]]);
        const removed = await post({ action: 'trip.remove', tripId: data.trip.id }, verified);
        expect(removed.status).toBe(200);
        expect(await removed.json()).toEqual({ global: true });
    });
    it('protects daily cleanup with a secret and never runs on missing authorization', async () => {
        expect((await fetch(base + '/api/cleanup')).status).toBe(401);
        expect((await fetch(base + '/api/cleanup', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    });
    it('purges expired rate-limit records while keeping active records', async () => {
        const db = getFirestore(adminApp()), key = randomUUID();
        const expired = db.doc(`rateLimits/expired_${key}`), active = db.doc(`rateLimits/active_${key}`);
        await expired.set({ expiresAt: Date.now() - 1000 });
        await active.set({ expiresAt: Date.now() + 86400000 });
        await purgeExpiredRateLimits();
        expect((await expired.get()).exists).toBe(false);
        expect((await active.get()).exists).toBe(true);
        await active.delete();
    });
});
