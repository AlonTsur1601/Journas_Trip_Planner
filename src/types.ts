export type Pin = {
  id: string;
  title: string;
  note: string;
  color: string;
  symbol: string;
  lng: number;
  lat: number;
  versions: Record<string, number>;
};
export type Block = {
  id: string;
  start: string;
  end: string;
  title: string;
  detail: string;
  color: string;
  symbol: string;
  pinId: string | null;
  timezone?: string;
  disambiguation?: "earlier" | "later" | null;
  startEpoch?: number;
  endEpoch?: number;
  overrides: string[];
  versions: Record<string, number>;
};
export type Task = {
  id: string;
  title: string;
  checked: boolean;
  pinId: string | null;
  blockId: string | null;
  versions: Record<string, number>;
};
export type Connection = {
  id: string;
  from: string;
  to: string;
  arrow: boolean;
  versions: Record<string, number>;
};
export type Day = {
  pins: Pin[];
  blocks: Block[];
  tasks: Task[];
  connections: Connection[];
};
export type Trip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  memberIds: string[];
  lodging?: {name: string; lng: number; lat: number; timezone: string; color?:string; symbol?:string; note?:string};
};
export type Settings = {
  theme: "light" | "dark" | "system";
  accent: string;
  clock: "local" | "destination" | "utc" | "lodging";
  clockConfigured?: boolean;
  timezone: string;
  autoDelete: boolean;
  retentionDays: number;
  displayName?: string;
  photoURL?: string;
  mapStart: "current" | "custom" | "world" | "trip";
  mapCenter: [number, number];
  mapZoom: number;
};
export type Layout = {
  map: boolean;
  timeline: boolean;
  todo: boolean;
  split: number;
  todoX: number;
  todoY: number;
  todoWidth: number;
  todoHeight: number;
  center: [number, number];
  zoom: number;
  scroll: number;
};
export const emptyDay = (): Day => ({
  pins: [],
  blocks: [],
  tasks: [],
  connections: [],
});
export const defaultLayout = (): Layout => ({
  map: true,
  timeline: true,
  todo: false,
  split: 55,
  todoX: 60,
  todoY: 100,
  todoWidth: 340,
  todoHeight: 380,
  center: [0, 0],
  zoom: 0,
  scroll: 400,
});
export const defaultSettings: Settings = {
  theme: "system",
  accent: "#7c5ce7",
  clock: "lodging",
  timezone: "",
  autoDelete: true,
  retentionDays: 365,
  mapStart: "current",
  mapCenter: [0, 0],
  mapZoom: 12,
};
