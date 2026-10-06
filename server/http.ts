import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError, type Data } from './types.js';
import { adminAuth, firestoreStore, purgeExpiredRateLimits } from './store.js';
import { JournasService } from './service.js';
import {places} from './places.js';
import {sendVerificationEmail} from './verification-email.js';
export type Request = IncomingMessage & {
    body?: unknown;
};
function headers(res: ServerResponse) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); }
function send(res: ServerResponse, status: number, value: unknown) { headers(res); res.statusCode = status; res.end(JSON.stringify(value)); }
async function body(req: Request): Promise<Data> {
    let parsed = req.body;
    if (!parsed) {
        let raw = '';
        for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw) > 100000)
                throw new ApiError(413, 'TOO_LARGE', 'Request is too large');
        }
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON request');
        }
    }
    if (Buffer.byteLength(JSON.stringify(parsed)) > 100000)
        throw new ApiError(413, 'TOO_LARGE', 'Request is too large');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new ApiError(400, 'INVALID_INPUT', 'Expected a JSON object');
    return parsed as Data;
}
function errors(res: ServerResponse, error: unknown) {
    if (error instanceof ApiError)
        return send(res, error.status, { error: { code: error.code, message: error.message, details: error.details } });
    console.error('Journas request failed', { type: error instanceof Error ? error.name : 'Unknown' });
    send(res, 503, { error: { code: 'UNAVAILABLE', message: 'The service is temporarily unavailable. Please retry.' } });
}
export async function journasHandler(req: Request, res: ServerResponse) {
    if (req.method !== 'POST')
        return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
    try {
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json'))
            throw new ApiError(415, 'CONTENT_TYPE', 'Use application/json');
        const input = await body(req);
        let uid: string | null = null;
        if (input.action !== 'share.read') {
            const authorization = req.headers.authorization ?? '';
            if (!authorization.startsWith('Bearer '))
                throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue');
            try {
                const token = await adminAuth().verifyIdToken(authorization.slice(7), true);
                uid = token.uid;
                if (!token.email_verified && input.action!=='auth.email-verification')
                    throw new ApiError(403, 'EMAIL_UNVERIFIED', 'Verify your email address to continue');
            }
            catch (error) {
                if (error instanceof ApiError)
                    throw error;
                const code = (error as {
                    code?: string;
                })?.code ?? '';
                if (['auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token', 'auth/argument-error', 'auth/user-disabled', 'auth/user-not-found'].includes(code))
                    throw new ApiError(401, 'UNAUTHENTICATED', 'Your sign-in session has expired');
                throw error;
            }
        }
        if(input.action==='auth.email-verification')return send(res,200,await sendVerificationEmail(uid!));
        if(input.action==='places.search'||input.action==='places.reverse')return send(res,200,await places(input,uid!));
        // Public previews are limited by a hashed network address; authenticated operations by account.
        // Only the platform's network header is used in production; no raw IP or token is persisted.
        const address = process.env.VERCEL ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0] : req.socket.remoteAddress;
        const bucket = uid ?? `public_${createHash('sha256').update(address ?? 'unknown').digest('hex')}`;
        const store = firestoreStore();
        const minute = Math.floor(Date.now() / 60000);
        await store.transaction(async (tx) => {
            const path = `rateLimits/${bucket}`;
            const current = await tx.get(path);
            const count = current?.minute === minute ? Number(current.count) + 1 : 1;
            if (count > 120)
                throw new ApiError(429, 'RATE_LIMIT', 'Too many requests. Retry in one minute.');
            tx.set(path, { minute, count, expiresAt: Date.now() + 86400000 });
            return null;
        });
        const result=await new JournasService(firestoreStore()).execute(uid,input);
        if(input.action==='trip.members'){
            const members=result.members as any[];const profiles=(await Promise.all(Array.from({length:Math.ceil(members.length/100)},(_,i)=>adminAuth().getUsers(members.slice(i*100,(i+1)*100).map(m=>({uid:m.id})))))).flatMap(r=>r.users);
            result.members=members.map(m=>{const profile=profiles.find(p=>p.uid===m.id);return {...m,displayName:m.displayName==='Traveler'?(profile?.displayName??'Traveler'):m.displayName,photoURL:m.photoURL??profile?.photoURL??null};});
        }
        send(res,200,result);
    }
    catch (error) {
        errors(res, error);
    }
}
export async function cleanupHandler(req: Request, res: ServerResponse) {
    if (req.method !== 'GET')
        return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
    const secret = process.env.CRON_SECRET;
    const supplied = req.headers.authorization ?? '';
    const expected = `Bearer ${secret ?? ''}`;
    if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
        return send(res, 401, { error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } });
    try {
        const result = await new JournasService(firestoreStore()).cleanup();
        const expiredRateLimits = await purgeExpiredRateLimits();
        send(res, 200, { ...result, expiredRateLimits });
    }
    catch (error) {
        errors(res, error);
    }
}
