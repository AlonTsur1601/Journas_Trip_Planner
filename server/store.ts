import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldPath, getFirestore, type Transaction as FirebaseTransaction } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Data, Store, Transaction } from './types.js';
export function adminApp() {
    if (getApps().length)
        return getApps()[0]!;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId)
        throw new Error('FIREBASE_PROJECT_ID is not configured');
    if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST)
        return initializeApp({ projectId });
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!clientEmail || !privateKey) {
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS)
            return initializeApp({ projectId, credential: applicationDefault() });
        throw new Error('Firebase Admin credentials are not configured');
    }
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
export const adminAuth = () => getAuth(adminApp());
export async function purgeExpiredRateLimits(now = Date.now()) {
    const db = getFirestore(adminApp());
    const expired = await db.collection('rateLimits').where('expiresAt', '<=', now).limit(100).get();
    const batch = db.batch();
    for (const document of expired.docs) batch.delete(document.ref, { lastUpdateTime: document.updateTime });
    if (expired.size) await batch.commit();
    return expired.size;
}
export function firestoreStore(): Store {
    const db = getFirestore(adminApp());
    return {
        async transaction(fn) {
            return db.runTransaction(async (firebaseTx: FirebaseTransaction) => {
                // Firestore requires all reads before writes. Buffer mutations until the domain operation completes.
                const writes = new Map<string, Data | null>();
                const tx: Transaction = {
                    async get(path) { if (writes.has(path))
                        return writes.get(path) ?? undefined; return (await firebaseTx.get(db.doc(path))).data(); },
                    async list(path) { const snapshot = await firebaseTx.get(db.collection(path)); const found = new Map(snapshot.docs.map(doc => [doc.ref.path, doc.data()])); for (const [key, value] of writes) {
                        if (key.slice(0, key.lastIndexOf('/')) === path) {
                            if (value)
                                found.set(key, value);
                            else
                                found.delete(key);
                        }
                    } return [...found.values()]; },
                    set(path, value) { writes.set(path, value); }, delete(path) { writes.set(path, null); },
                };
                const result = await fn(tx);
                for (const [path, value] of writes) {
                    if (value)
                        firebaseTx.set(db.doc(path), value);
                    else
                        firebaseTx.delete(db.doc(path));
                }
                return result;
            });
        },
        async list(path, limit = 100) { return (await db.collection(path).limit(limit).get()).docs.map(doc => doc.data()); },
        async scanTrips(after, limit) { const query = db.collection('trips').orderBy(FieldPath.documentId()).limit(limit); return (await (after ? query.startAfter(after) : query).get()).docs.map(doc => doc.data()); },
        async dueMemberships(now, limit) { return (await db.collectionGroup('trips').where('cleanupAt', '<=', now).orderBy('cleanupAt').limit(limit).get()).docs.map(doc => doc.data()); },
        async purgeTrip(id) { await db.recursiveDelete(db.doc(`trips/${id}`)); },
        async purgeLayouts(uid, tripId, before) {
            const writer = db.bulkWriter();
            const layouts = await db.collection(`users/${uid}/layouts`).where('tripId', '==', tripId).get();
            const deletes: Promise<unknown>[] = [];
            for (const layout of layouts.docs)
                if (Number(layout.data().updatedAt) <= before)
                    deletes.push(writer.delete(layout.ref, { lastUpdateTime: layout.updateTime }).catch(error => { if (error.code !== 9)
                        throw error; }));
            await writer.close();
            await Promise.all(deletes);
        },
    };
}
