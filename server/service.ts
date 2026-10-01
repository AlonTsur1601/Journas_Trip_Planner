import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiError, defaultSettings, type Data, type Item, type Kind, type Store, type Transaction, type Trip } from './types.js';
import { resolveWallTime } from './time.js';
const kinds: Kind[] = ['pins', 'blocks', 'tasks', 'connections'];
const fields: Record<Kind, string[]> = { pins: ['title', 'note', 'color', 'symbol', 'lng', 'lat'], blocks: ['start', 'end', 'title', 'detail', 'color', 'symbol', 'pinId', 'overrides', 'timezone', 'disambiguation'], tasks: ['title', 'checked', 'pinId', 'blockId'], connections: ['from', 'to', 'arrow'] };
function fail(status: number, code: string, message: string, details?: unknown): never { throw new ApiError(status, code, message, details); }
const identifier = (value: unknown): string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : fail(400, 'INVALID_ID', 'Invalid identifier');
const text = (value: unknown, max = 200): string => typeof value === 'string' && value.length <= max ? value : fail(400, 'INVALID_TEXT', `Text must contain at most ${max} characters`);
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : fail(400, 'INVALID_INPUT', 'Expected an object');
const date = (value: unknown): string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return fail(400, 'INVALID_DATE', 'Invalid calendar date');
    const parsed = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
        return fail(400, 'INVALID_DATE', 'Invalid calendar date');
    return value;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const tripPath = (id: string) => `trips/${id}`;
const userPath = (uid: string) => `users/${uid}`;
const membershipPath = (uid: string, id: string) => `users/${uid}/trips/${id}`;
const itemsPath = (id: string, day: string) => `trips/${id}/days/${day}/items`;
const layoutPath = (uid: string, id: string, day: string) => `users/${uid}/layouts/${id}_${day}`;
const isColor = (x: unknown) => typeof x === 'string' && /^#[a-fA-F0-9]{6}$/.test(x);
const finite = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
function validTimezone(value: unknown) {
    if (value === '')
        return true;
    if (typeof value !== 'string' || value.length > 80)
        return false;
    try {
        new Intl.DateTimeFormat('en', { timeZone: value }).format();
        return true;
    }
    catch {
        return false;
    }
}
function validateSettings(value: Data) {
    const allowed = ['theme', 'accent', 'clock', 'autoDelete', 'retentionDays', 'timezone', 'displayName', 'photoURL'];
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            fail(400, 'INVALID_SETTINGS', `Unknown setting ${key}`);
    if (value.theme !== undefined && !['light', 'dark', 'system'].includes(String(value.theme)))
        fail(400, 'INVALID_SETTINGS', 'Invalid theme');
    if (value.accent !== undefined && !isColor(value.accent))
        fail(400, 'INVALID_SETTINGS', 'Invalid accent');
    if (value.clock !== undefined && !['local', 'destination', 'utc'].includes(String(value.clock)))
        fail(400, 'INVALID_SETTINGS', 'Invalid clock');
    if (value.autoDelete !== undefined && typeof value.autoDelete !== 'boolean')
        fail(400, 'INVALID_SETTINGS', 'Invalid automatic deletion preference');
    if (value.retentionDays !== undefined && (typeof value.retentionDays !== 'number' || ![30, 90, 365].includes(value.retentionDays)))
        fail(400, 'INVALID_SETTINGS', 'Invalid retention');
    if (value.timezone !== undefined && !validTimezone(value.timezone))
        fail(400, 'INVALID_SETTINGS', 'Unknown timezone');
    if (value.displayName !== undefined)
        text(value.displayName, 80);
    if (value.photoURL !== undefined) {
        const photo = text(value.photoURL, 70000);
        if (photo && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) && !/^https:\/\/[^\s]{1,2048}$/.test(photo))
            fail(400, 'INVALID_SETTINGS', 'Invalid profile image');
    }
}
function validateItem(kind: Kind, item: Data) {
    for (const key of fields[kind])
        if (!(key in item))
            fail(400, 'MISSING_FIELD', `Missing ${key}`);
    if ('title' in item && !text(item.title, 200).trim())
        fail(400, 'INVALID_ITEM', 'A title is required');
    if ('note' in item)
        text(item.note, 4000);
    if ('detail' in item)
        text(item.detail, 4000);
    if ('color' in item && !isColor(item.color))
        fail(400, 'INVALID_ITEM', 'Invalid color');
    if ('symbol' in item)
        text(item.symbol, 40);
    if (kind === 'pins' && (!finite(item.lng, -180, 180) || !finite(item.lat, -85, 85)))
        fail(400, 'INVALID_ITEM', 'Invalid map coordinates');
    if (kind === 'blocks') {
        if (typeof item.timezone !== 'string' || item.timezone === '' || !validTimezone(item.timezone))
            fail(400, 'INVALID_TIMEZONE', 'Choose a valid IANA timezone');
        if (item.disambiguation !== null && item.disambiguation !== 'earlier' && item.disambiguation !== 'later')
            fail(400, 'INVALID_ITEM', 'Choose an occurrence for a repeated hour');
        const time = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!time.test(String(item.start)) || !(time.test(String(item.end)) || item.end === '24:00') || String(item.start) >= String(item.end))
            fail(400, 'INVALID_TIME', 'End time must follow start time within this day');
        if (!Array.isArray(item.overrides) || item.overrides.length > 4 || item.overrides.some(x => !['title', 'detail', 'color', 'symbol'].includes(String(x))))
            fail(400, 'INVALID_ITEM', 'Invalid overrides');
    }
    for (const key of ['pinId', 'blockId'])
        if (key in item && item[key] !== null)
            identifier(item[key]);
    if (kind === 'tasks' && typeof item.checked !== 'boolean')
        fail(400, 'INVALID_ITEM', 'Invalid checkbox');
    if (kind === 'connections') {
        identifier(item.from);
        identifier(item.to);
        if (item.from === item.to || typeof item.arrow !== 'boolean')
            fail(400, 'INVALID_ITEM', 'Invalid connection');
    }
}
function validateLayout(layout: Data) {
    const allowed = ['map', 'timeline', 'todo', 'split', 'todoX', 'todoY', 'todoWidth', 'todoHeight', 'center', 'zoom', 'scroll'];
    for (const key of Object.keys(layout))
        if (!allowed.includes(key))
            fail(400, 'INVALID_LAYOUT', 'Unknown layout field');
    if (['map', 'timeline', 'todo'].some(key => typeof layout[key] !== 'boolean') || !(layout.map || layout.timeline || layout.todo))
        fail(400, 'INVALID_LAYOUT', 'Select at least one window');
    if (!finite(layout.split, 10, 90) || !finite(layout.zoom, 0, 22) || !finite(layout.scroll, 0, 100000))
        fail(400, 'INVALID_LAYOUT', 'Invalid window position');
    for (const key of ['todoX', 'todoY'])
        if (!finite(layout[key], 0, 20000))
            fail(400, 'INVALID_LAYOUT', 'Invalid task position');
    for (const key of ['todoWidth', 'todoHeight'])
        if (!finite(layout[key], 100, 20000))
            fail(400, 'INVALID_LAYOUT', 'Invalid task size');
    if (!Array.isArray(layout.center) || layout.center.length !== 2 || !finite(layout.center[0], -180, 180) || !finite(layout.center[1], -85, 85))
        fail(400, 'INVALID_LAYOUT', 'Invalid map center');
}
function versions(value: unknown): Record<string, number> {
    const v = object(value ?? {});
    for (const n of Object.values(v))
        if (!Number.isInteger(n) || Number(n) < 0)
            fail(400, 'INVALID_VERSION', 'Invalid revision');
    return v as Record<string, number>;
}
function bump(item: Item, patch: Data): Item {
    const next = { ...item, ...patch, versions: { ...item.versions } };
    for (const key of Object.keys(patch))
        next.versions[key] = (next.versions[key] ?? 0) + 1;
    return next;
}
export class JournasService {
    constructor(private store: Store, private now: () => number = Date.now) { }
    private async member(tx: Transaction, id: string, uid: string): Promise<Trip> {
        const trip = await tx.get(tripPath(id)) as Trip | undefined;
        if (!trip || trip.deleted)
            fail(404, 'NOT_FOUND', 'Trip not found');
        if (!trip.memberIds.includes(uid))
            fail(403, 'FORBIDDEN', 'You do not have access to this trip');
        return trip;
    }
    private async owner(tx: Transaction, id: string, uid: string) {
        const trip = await this.member(tx, id, uid);
        if (trip.ownerId !== uid)
            fail(403, 'FORBIDDEN', 'Only the owner can manage sharing');
        return trip;
    }
    private async checkQuota(tx: Transaction, uid: string) {
        const user = await tx.get(userPath(uid)) ?? { id: uid, settings: defaultSettings, tripCount: 0 };
        if (Number(user.tripCount) >= 100)
            fail(409, 'TRIP_LIMIT', 'You have reached the 100-trip limit');
        return user;
    }
    private async day(tx: Transaction, id: string, day: string) { const entries = await tx.list(itemsPath(id, day)); return Object.fromEntries(kinds.map(kind => [kind, entries.filter(x => x.kind === kind)])); }
    private dayWithin(trip: Trip, day: string) {
        if (day < trip.startDate || day > trip.endDate)
            fail(400, 'DATE_OUTSIDE_TRIP', 'Choose a date within this trip');
    }
    private cleanupAt(endDate: string, settingsInput: unknown) { const settings = { ...defaultSettings, ...object(settingsInput ?? {}) }; return settings.autoDelete ? Date.parse(`${endDate}T23:59:59.999Z`) + Number(settings.retentionDays) * 86400000 : Number.MAX_SAFE_INTEGER; }
    private membership(uid: string, trip: Trip, settings: unknown) { return { id: trip.id, uid, endDate: trip.endDate, joinedAt: this.now(), cleanupAt: this.cleanupAt(trip.endDate, settings) }; }
    async execute(uid: string | null, input: Data): Promise<Data> {
        const action = text(input.action, 50);
        if (action === 'share.read')
            return this.readShare(input);
        if (!uid)
            fail(401, 'UNAUTHENTICATED', 'Sign in to continue');
        const userId = identifier(uid);
        return this.store.transaction(async (tx) => {
            if (action === 'settings.get') {
                const user = await tx.get(userPath(userId));
                return { settings: { ...defaultSettings, ...object(user?.settings ?? {}) } };
            }
            if (action === 'settings.save' || action === 'profile.save') {
                const patch = object(input.settings ?? input.profile);
                validateSettings(patch);
                const user = await tx.get(userPath(userId)) ?? { id: userId, tripCount: 0 };
                const settings = { ...defaultSettings, ...object(user.settings ?? {}), ...patch };
                if ('autoDelete' in patch || 'retentionDays' in patch)
                    for (const ref of await tx.list(`users/${userId}/trips`))
                        tx.set(membershipPath(userId, identifier(ref.id)), { ...ref, cleanupAt: this.cleanupAt(date(ref.endDate), settings) });
                tx.set(userPath(userId), { ...user, settings });
                return { settings };
            }
            if (action === 'trip.list') {
                const refs = await tx.list(`users/${userId}/trips`);
                const trips = await Promise.all(refs.map(ref => tx.get(tripPath(identifier(ref.id)))));
                return { trips: trips.filter(trip => trip && !trip.deleted && (trip.memberIds as string[]).includes(userId)) };
            }
            if (action === 'trip.create') {
                const name = text(input.name, 120).trim();
                if (!name)
                    fail(400, 'INVALID_TRIP', 'A trip name is required');
                const startDate = date(input.startDate), endDate = date(input.endDate);
                const zone = input.clientTimezone ?? 'UTC';
                if (!validTimezone(zone) || zone === '')
                    fail(400, 'INVALID_TIMEZONE', 'Invalid local timezone');
                const parts = new Intl.DateTimeFormat('en', { timeZone: String(zone), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(this.now());
                const part = (type: string) => parts.find(value => value.type === type)!.value;
                const today = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`), latest = new Date(today);
                latest.setUTCFullYear(latest.getUTCFullYear() + 1);
                if (latest.getUTCMonth() !== today.getUTCMonth())
                    latest.setUTCDate(0);
                if (startDate > endDate || endDate > latest.toISOString().slice(0, 10) || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 366)
                    fail(400, 'INVALID_TRIP', 'Trips must span at most one year and cannot be planned more than one year ahead');
                const user = await this.checkQuota(tx, userId);
                const id = randomUUID();
                const trip: Trip = { id, name, startDate, endDate, ownerId: userId, memberIds: [userId], deleted: false, createdAt: this.now(), updatedAt: this.now(), shareVersion: 0 };
                tx.set(tripPath(id), trip);
                tx.set(membershipPath(userId, id), this.membership(userId, trip, user.settings));
                tx.set(userPath(userId), { ...user, tripCount: Number(user.tripCount ?? 0) + 1 });
                return { trip };
            }
            if (action === 'share.join') {
                const share = await this.share(tx, input.token);
                if (share.mode !== 'editor')
                    fail(403, 'VIEW_ONLY', 'This link allows viewing only');
                const id = identifier(share.tripId);
                const trip = await tx.get(tripPath(id)) as Trip;
                if (trip.memberIds.includes(userId))
                    return { trip };
                const user = await this.checkQuota(tx, userId);
                if (trip.memberIds.length >= 100)
                    fail(409, 'MEMBER_LIMIT', 'This trip has reached its participant limit');
                const updated = { ...trip, memberIds: [...trip.memberIds, userId], updatedAt: this.now() };
                tx.set(tripPath(id), updated);
                tx.set(membershipPath(userId, id), this.membership(userId, trip, user.settings));
                tx.delete(`cleanupJobs/${userId}_${id}`);
                tx.set(userPath(userId), { ...user, tripCount: Number(user.tripCount ?? 0) + 1 });
                return { trip: updated };
            }
            const id = identifier(input.tripId);
            if (action === 'trip.remove') {
                const trip = await this.member(tx, id, userId);
                if (trip.ownerId === userId) {
                    await this.globalDelete(tx, trip);
                    return { global: true };
                }
                await this.personalRemove(tx, trip, userId);
                return { global: false };
            }
            if (action === 'share.create') {
                const trip = await this.owner(tx, id, userId);
                if (!['viewer', 'editor'].includes(String(input.mode)))
                    fail(400, 'INVALID_SHARE', 'Choose a sharing mode');
                const token = randomBytes(32).toString('base64url');
                const shares = await tx.list(`trips/${id}/shares`);
                if (shares.length >= 20)
                    fail(409, 'SHARE_LIMIT', 'Revoke existing links before creating more');
                const key = hash(token);
                const share = { tripId: id, mode: input.mode, version: trip.shareVersion ?? 0, createdAt: this.now() };
                tx.set(`shares/${key}`, share);
                tx.set(`trips/${id}/shares/${key}`, { id: key });
                return { token };
            }
            if (action === 'share.revoke') {
                const trip = await this.owner(tx, id, userId);
                const shares = await tx.list(`trips/${id}/shares`);
                for (const share of shares) {
                    tx.delete(`shares/${share.id}`);
                    tx.delete(`trips/${id}/shares/${share.id}`);
                }
                tx.set(tripPath(id), { ...trip, shareVersion: Number(trip.shareVersion ?? 0) + 1 });
                return { ok: true };
            }
            if (action === 'member.remove') {
                const trip = await this.owner(tx, id, userId);
                const target = identifier(input.userId);
                if (target === trip.ownerId)
                    fail(400, 'OWNER_REMOVAL', 'The owner cannot be removed using participant management');
                if (trip.memberIds.includes(target))
                    await this.personalRemove(tx, trip, target);
                return { ok: true };
            }
            const trip = await this.member(tx, id, userId);
            const day = date(input.date);
            this.dayWithin(trip, day);
            if (action === 'trip.get')
                return { trip, day: await this.day(tx, id, day), layout: (await tx.get(layoutPath(userId, id, day)))?.layout ?? null };
            if (action === 'layout.save') {
                const layout = object(input.layout);
                validateLayout(layout);
                tx.set(layoutPath(userId, id, day), { tripId: id, date: day, layout, updatedAt: this.now() });
                return { ok: true };
            }
            if (action !== 'item.patch' && action !== 'item.delete')
                fail(400, 'UNKNOWN_ACTION', 'Unknown operation');
            const kind = input.kind as Kind;
            if (!kinds.includes(kind))
                fail(400, 'INVALID_KIND', 'Unknown item type');
            const itemId = identifier(input.id), path = `${itemsPath(id, day)}/${itemId}`;
            const current = await tx.get(path) as Item | undefined;
            if (current && current.kind !== kind)
                fail(409, 'ITEM_KIND', 'This identifier belongs to another item type');
            const base = versions(input.baseVersions);
            const patch = action === 'item.patch' ? object(input.patch) : {};
            const changed = action === 'item.delete' ? Object.keys(current?.versions ?? {}) : Object.keys(patch);
            if (!changed.length && action === 'item.patch')
                fail(400, 'EMPTY_PATCH', 'Nothing to update');
            for (const key of Object.keys(patch))
                if (!fields[kind].includes(key))
                    fail(400, 'INVALID_FIELD', `Cannot update ${key}`);
            const conflicts = changed.filter(key => (current?.versions[key] ?? 0) !== (base[key] ?? 0));
            if (conflicts.length)
                fail(409, 'CONFLICT', 'This item changed while you were editing it', { item: current, fields: conflicts });
            const all = await tx.list(itemsPath(id, day)) as Item[];
            if (action === 'item.delete') {
                if (current)
                    await this.deleteItem(tx, id, day, current, all);
                return { ok: true };
            }
            if (!current && (all.filter(x => x.kind === kind).length >= 200 || all.length >= 400))
                fail(409, 'DAY_LIMIT', 'This day has reached its item limit (200 per type, 400 total)');
            let item = bump(current ?? { id: itemId, kind, versions: {} }, patch);
            if (kind === 'blocks') {
                if (!('timezone' in item))
                    item = bump(item, { timezone: input.clientTimezone ?? 'UTC' });
                if (!('disambiguation' in item))
                    item = bump(item, { disambiguation: null });
            }
            if (kind === 'blocks' && item.pinId) {
                const pin = all.find(x => x.id === item.pinId && x.kind === 'pins');
                if (!pin)
                    fail(400, 'INVALID_LINK', 'Linked place does not exist');
                const overrides = Array.isArray(item.overrides) ? item.overrides as string[] : [];
                const defaults: Data = { title: pin.title, detail: pin.note, color: pin.color, symbol: pin.symbol };
                for (const key of Object.keys(defaults))
                    if (!overrides.includes(key) && item[key] !== defaults[key])
                        item = bump(item, { [key]: defaults[key] });
            }
            validateItem(kind, item);
            if (kind === 'blocks') {
                const startEpoch = resolveWallTime(day, String(item.start), String(item.timezone), item.disambiguation);
                const endEpoch = resolveWallTime(day, String(item.end), String(item.timezone), item.disambiguation);
                if (endEpoch <= startEpoch)
                    fail(400, 'INVALID_TIME', 'End time must follow start time');
                const derived: Data = {};
                if (item.startEpoch !== startEpoch)
                    derived.startEpoch = startEpoch;
                if (item.endEpoch !== endEpoch)
                    derived.endEpoch = endEpoch;
                if (Object.keys(derived).length)
                    item = bump(item, derived);
            }
            const linked = (key: string, target: Kind) => {
                if (item[key] && !all.some(x => x.id === item[key] && x.kind === target))
                    fail(400, 'INVALID_LINK', 'Linked item does not exist');
            };
            if (kind === 'tasks') {
                linked('pinId', 'pins');
                linked('blockId', 'blocks');
            }
            if (kind === 'connections') {
                linked('from', 'pins');
                linked('to', 'pins');
            }
            tx.set(path, item);
            tx.set(`trips/${id}/days/${day}`, { date: day, updatedAt: this.now() });
            if (kind === 'pins')
                for (const block of all.filter(x => x.kind === 'blocks' && x.pinId === itemId)) {
                    const inherited: Data = {};
                    const values: Data = { title: item.title, detail: item.note, color: item.color, symbol: item.symbol };
                    for (const key of Object.keys(values))
                        if (!(block.overrides as string[]).includes(key) && block[key] !== values[key])
                            inherited[key] = values[key];
                    if (Object.keys(inherited).length)
                        tx.set(`${itemsPath(id, day)}/${block.id}`, bump(block, inherited));
                }
            return { item };
        });
    }
    private async share(tx: Transaction, tokenInput: unknown) {
        const token = text(tokenInput, 100);
        if (!/^[A-Za-z0-9_-]{43}$/.test(token))
            fail(404, 'INVALID_SHARE', 'Sharing link is invalid or expired');
        const share = await tx.get(`shares/${hash(token)}`);
        if (!share)
            fail(404, 'INVALID_SHARE', 'Sharing link is invalid or expired');
        const trip = await tx.get(tripPath(identifier(share.tripId)));
        if (!trip || trip.deleted || trip.shareVersion !== share.version)
            fail(404, 'INVALID_SHARE', 'Sharing link is invalid or expired');
        return share;
    }
    private async readShare(input: Data) { return this.store.transaction(async (tx) => { const share = await this.share(tx, input.token); const trip = await tx.get(tripPath(identifier(share.tripId))) as Trip; const day = input.date ? date(input.date) : trip.startDate; this.dayWithin(trip, day); return { trip: { ...trip, memberIds: [], ownerId: '' }, day: await this.day(tx, trip.id, day), mode: share.mode }; }); }
    private async deleteItem(tx: Transaction, id: string, day: string, item: Item, all: Item[]) {
        tx.delete(`${itemsPath(id, day)}/${item.id}`);
        for (const related of all) {
            const patch: Data = {};
            if (item.kind === 'pins') {
                if (related.kind === 'connections' && (related.from === item.id || related.to === item.id)) {
                    tx.delete(`${itemsPath(id, day)}/${related.id}`);
                    continue;
                }
                if (related.pinId === item.id)
                    patch.pinId = null;
            }
            if (item.kind === 'blocks' && related.blockId === item.id)
                patch.blockId = null;
            if (Object.keys(patch).length)
                tx.set(`${itemsPath(id, day)}/${related.id}`, bump(related, patch));
        }
        tx.set(`trips/${id}/days/${day}`, { date: day, updatedAt: this.now() });
    }
    private async personalRemove(tx: Transaction, trip: Trip, uid: string) {
        const user = await tx.get(userPath(uid));
        const members = trip.memberIds.filter(id => id !== uid);
        tx.delete(membershipPath(uid, trip.id));
        if (user)
            tx.set(userPath(uid), { ...user, tripCount: Math.max(0, Number(user.tripCount ?? 0) - 1) });
        tx.set(`cleanupJobs/${uid}_${trip.id}`, { uid, tripId: trip.id, removedAt: this.now(), version: randomUUID() });
        tx.set(tripPath(trip.id), { ...trip, memberIds: members, deleted: members.length === 0, updatedAt: this.now() });
        if (!members.length)
            await this.revokeAll(tx, trip);
    }
    private async revokeAll(tx: Transaction, trip: Trip) {
        const shares = await tx.list(`trips/${trip.id}/shares`);
        for (const share of shares) {
            tx.delete(`shares/${share.id}`);
            tx.delete(`trips/${trip.id}/shares/${share.id}`);
        }
    }
    private async globalDelete(tx: Transaction, trip: Trip) {
        for (const uid of trip.memberIds) {
            const user = await tx.get(userPath(uid));
            tx.delete(membershipPath(uid, trip.id));
            if (user)
                tx.set(userPath(uid), { ...user, tripCount: Math.max(0, Number(user.tripCount ?? 0) - 1) });
            tx.set(`cleanupJobs/${uid}_${trip.id}`, { uid, tripId: trip.id, removedAt: this.now(), version: randomUUID() });
        }
        await this.revokeAll(tx, trip);
        tx.set(tripPath(trip.id), { ...trip, deleted: true, memberIds: [], updatedAt: this.now() });
    }
    async cleanup(): Promise<Data> {
        let removed = 0, purged = 0;
        for (const candidate of await this.store.dueMemberships(this.now(), 100)) {
            const uid = identifier(candidate.uid), id = identifier(candidate.id);
            const didRemove = await this.store.transaction(async (tx) => {
                const trip = await tx.get(tripPath(id)) as Trip | undefined;
                const membership = await tx.get(membershipPath(uid, id));
                if (!membership)
                    return false;
                if (!trip || trip.deleted || !trip.memberIds.includes(uid)) {
                    tx.delete(membershipPath(uid, id));
                    return false;
                }
                const user = await tx.get(userPath(uid));
                const cleanupAt = this.cleanupAt(trip.endDate, user?.settings);
                if (cleanupAt > this.now()) {
                    tx.set(membershipPath(uid, id), { ...membership, cleanupAt });
                    return false;
                }
                await this.personalRemove(tx, trip, uid);
                return true;
            });
            if (didRemove)
                removed++;
        }
        for (const job of await this.store.list('cleanupJobs', 100)) {
            const uid = identifier(job.uid), tripId = identifier(job.tripId);
            await this.store.purgeLayouts(uid, tripId, Number(job.removedAt));
            const trip = await this.store.transaction(tx => tx.get(tripPath(tripId)));
            if (trip?.deleted) {
                await this.store.purgeTrip(tripId);
                purged++;
            }
            await this.store.transaction(async (tx) => {
                const current = await tx.get(`cleanupJobs/${uid}_${tripId}`);
                if (current?.version === job.version)
                    tx.delete(`cleanupJobs/${uid}_${tripId}`);
                return null;
            });
        }
        return { removed, purged };
    }
}
