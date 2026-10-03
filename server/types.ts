export type Data = Record<string, unknown>;
export type Kind = 'pins' | 'blocks' | 'tasks' | 'connections';
export interface Trip extends Data {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    ownerId: string;
    memberIds: string[];
    deleted: boolean;
    createdAt: number;
    updatedAt: number;
}
export interface Item extends Data {
    id: string;
    kind: Kind;
    versions: Record<string, number>;
}
export interface Settings extends Data {
    theme: 'light' | 'dark' | 'system';
    accent: string;
    clock: 'local' | 'destination' | 'utc' | 'lodging';
    autoDelete: boolean;
    retentionDays: 30 | 90 | 365;
    timezone: string;
    displayName?: string;
    photoURL?: string;
}
export const defaultSettings: Settings = { theme: 'system', accent: '#8b5cf6', clock: 'lodging', autoDelete: true, retentionDays: 365, timezone: '' };
export interface Transaction {
    get(path: string): Promise<Data | undefined>;
    list(path: string): Promise<Data[]>;
    set(path: string, value: Data): void;
    delete(path: string): void;
}
export interface Store {
    transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
    list(path: string, limit?: number): Promise<Data[]>;
    scanTrips(after: string, limit: number): Promise<Data[]>;
    dueMemberships(now: number, limit: number): Promise<Data[]>;
    purgeTrip(id: string): Promise<void>;
    purgeLayouts(uid: string, tripId: string, before: number): Promise<void>;
}
export class ApiError extends Error {
    constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
