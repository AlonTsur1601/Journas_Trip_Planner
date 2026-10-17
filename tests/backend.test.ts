import { describe, expect, it } from "vitest";
import { JournasService } from "../server/service.js";
import {
  defaultSettings,
  type Data,
  type Store,
  type Transaction,
  type Trip,
} from "../server/types.js";
class MemoryStore implements Store {
  docs = new Map<string, Data>();
  queue: Promise<unknown> = Promise.resolve();
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const copy = new Map(
        [...this.docs].map(([k, v]) => [k, structuredClone(v)]),
      );
      const tx: Transaction = {
        get: async (path) => copy.get(path),
        list: async (path) =>
          [...copy]
            .filter(([key]) => key.slice(0, key.lastIndexOf("/")) === path)
            .map(([, value]) => value),
        set: (path, value) => {
          copy.set(path, structuredClone(value));
        },
        delete: (path) => {
          copy.delete(path);
        },
      };
      const result = await fn(tx);
      this.docs = copy;
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
  async list(path: string, limit = 100) {
    return [...this.docs]
      .filter(([key]) => key.slice(0, key.lastIndexOf("/")) === path)
      .map(([, value]) => value)
      .slice(0, limit);
  }
  async scanTrips(after: string, limit: number) {
    return (await this.list("trips", 10000))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .filter((t) => String(t.id) > after)
      .slice(0, limit);
  }
  async dueMemberships(now: number, limit: number) {
    return [...this.docs]
      .filter(
        ([key, value]) =>
          key.includes("/trips/") &&
          typeof value.cleanupAt === "number" &&
          value.cleanupAt <= now,
      )
      .map(([, value]) => value)
      .slice(0, limit);
  }
  async purgeTrip(id: string) {
    for (const key of this.docs.keys())
      if (key === `trips/${id}` || key.startsWith(`trips/${id}/`))
        this.docs.delete(key);
  }
  async purgeLayouts(uid: string, id: string, before: number) {
    for (const [key, value] of this.docs)
      if (
        key.startsWith(`users/${uid}/layouts/`) &&
        value.tripId === id &&
        Number(value.updatedAt) <= before
      )
        this.docs.delete(key);
  }
}
const day = "2026-10-01";
const pin = {
  title: "Museum",
  note: "Bring tickets",
  color: "#8b5cf6",
  symbol: "★",
  lng: 2.3,
  lat: 48.8,
};
const block = {
  title: "Museum",
  detail: "Bring tickets",
  color: "#8b5cf6",
  symbol: "★",
  start: "09:00",
  end: "10:00",
  pinId: "pin",
  overrides: [],
};
const task = {
  title: "Buy tickets",
  checked: false,
  pinId: "pin",
  blockId: "block",
};
const layout = {
  map: true,
  timeline: true,
  todo: false,
  split: 55,
  todoX: 10,
  todoY: 10,
  todoWidth: 320,
  todoHeight: 400,
  center: [2, 48],
  zoom: 8,
  scroll: 0,
};
async function setup() {
  const store = new MemoryStore();
  let now = Date.parse(day + "T12:00:00Z");
  const service = new JournasService(store, () => now);
  const { trip } = await service.execute("alice", {
    action: "trip.create", lodging: {name:"Test lodging",lng:2.3,lat:48.8},
    name: "Paris",
    startDate: day,
    endDate: day,
  });
  const id = (trip as Trip).id;
  const patch = (
    kind: string,
    itemId: string,
    values: Data,
    baseVersions: Data = {},
  ) =>
    service.execute("alice", {
      action: "item.patch",
      tripId: id,
      date: day,
      kind,
      id: itemId,
      patch: values,
      baseVersions,
    });
  return {
    store,
    service,
    id,
    patch,
    setNow: (value: number) => {
      now = value;
    },
  };
}
async function join(service: JournasService, id: string, uid = "bob") {
  const { token } = await service.execute("alice", {
    action: "share.create",
    tripId: id,
    mode: "editor",
  });
  await service.execute(uid, { action: "share.join", token });
  return token;
}
describe("Journas server contract", () => {
  it("defaults to personal auto-deletion after365 days", () => {
    expect(defaultSettings.autoDelete).toBe(true);
    expect(defaultSettings.retentionDays).toBe(365);
  });
  it("creates sparse data: reading an empty day does not create any day or layout", async () => {
    const { service, store, id } = await setup();
    await service.execute("alice", {
      action: "trip.get",
      tripId: id,
      date: day,
    });
    expect(
      [...store.docs.keys()].some(
        (x) => x.includes("/days/") || x.includes("/layouts/"),
      ),
    ).toBe(false);
  });
  it("enforces authentication and trip access for stranger users", async () => {
    const { service, id } = await setup();
    await expect(
      service.execute(null, { action: "trip.list" }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.execute("eve", { action: "trip.get", tripId: id, date: day }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("limits future planning to one calendar year and rejects invalid dates", async () => {
    const { service } = await setup();
    for (const endDate of ["2027-10-04", "2026-99-99", "2026-02-30"])
      await expect(
        service.execute("alice", {
          action: "trip.create", lodging: {name:"Test lodging",lng:2.3,lat:48.8},
          name: "Invalid",
          startDate: day,
          endDate,
        }),
      ).rejects.toMatchObject({ status: 400 });
  });
  it("counts shared trips toward per-user quota and joining is idempotent", async () => {
    const { service, store, id } = await setup();
    const token = await join(service, id);
    await service.execute("bob", { action: "share.join", token });
    expect(store.docs.get("users/bob")?.tripCount).toBe(1);
    store.docs.set("users/eve", { tripCount: 100 });
    await expect(
      service.execute("eve", { action: "share.join", token }),
    ).rejects.toMatchObject({ code: "TRIP_LIMIT" });
    await expect(
      service.execute("eve", {
        action: "trip.create", lodging: {name:"Test lodging",lng:2.3,lat:48.8},
        name: "Over quota",
        startDate: day,
        endDate: day,
      }),
    ).rejects.toMatchObject({ code: "TRIP_LIMIT" });
  });
  it("view-only links disclose no membership IDs and cannot grant editing", async () => {
    const { service, id } = await setup();
    const { token } = await service.execute("alice", {
      action: "share.create",
      tripId: id,
      mode: "viewer",
    });
    const shared = await service.execute(null, {
      action: "share.read",
      token,
      date: day,
    });
    expect((shared.trip as Trip).memberIds).toEqual([]);
    await expect(
      service.execute("bob", { action: "share.join", token }),
    ).rejects.toMatchObject({ code: "VIEW_ONLY" });
    await expect(
      service.execute("bob", {
        action: "item.patch",
        tripId: id,
        date: day,
        kind: "pins",
        id: "pin",
        patch: pin,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("revocation invalidates viewer and join paths immediately", async () => {
    const { service, id } = await setup();
    const token = await join(service, id);
    await service.execute("alice", { action: "share.revoke", tripId: id });
    await expect(
      service.execute(null, { action: "share.read", token }),
    ).rejects.toMatchObject({ code: "INVALID_SHARE" });
    await expect(
      service.execute("eve", { action: "share.join", token }),
    ).rejects.toMatchObject({ code: "INVALID_SHARE" });
  });
  it("removes a member personally while keeping others and their content", async () => {
    const { service, store, id, patch } = await setup();
    await patch("pins", "pin", pin);
    await join(service, id);
    expect(
      await service.execute("bob", { action: "trip.remove", tripId: id }),
    ).toMatchObject({ global: false });
    expect(
      (
        await service.execute("alice", {
          action: "trip.get",
          tripId: id,
          date: day,
        })
      ).day,
    ).toMatchObject({ pins: [{ title: "Museum" }] });
    expect(store.docs.get("users/bob")?.tripCount).toBe(0);
    await expect(
      service.execute("bob", { action: "trip.get", tripId: id, date: day }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("manual owner deletion globally revokes membership and share links", async () => {
    const { service, store, id,setNow } = await setup();
    const token = await join(service, id);
    expect(
      await service.execute("alice", { action: "trip.remove", tripId: id }),
    ).toMatchObject({ global: true });
    await expect(
      service.execute("bob", { action: "trip.get", tripId: id, date: day }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.execute(null, { action: "share.read", token }),
    ).rejects.toMatchObject({ code: "INVALID_SHARE" });
    expect(store.docs.get("users/bob")?.tripCount).toBe(0);
    await service.cleanup();
    expect(store.docs.has(`trips/${id}`)).toBe(false);
    setNow(Date.parse(day+"T12:11:00Z"));
    await service.cleanup();
    expect(store.docs.has(`trips/${id}`)).toBe(false);
  });
  it("automatic owner deletion is personal and does not transfer ownership", async () => {
    const { service, store, id, setNow } = await setup();
    await join(service, id);
    await service.execute("bob", {
      action: "settings.save",
      settings: { autoDelete: false },
    });
    setNow(Date.parse("2027-10-03T00:00:00Z"));
    await service.cleanup();
    const trip = (
      await service.execute("bob", {
        action: "trip.get",
        tripId: id,
        date: day,
      })
    ).trip as Trip;
    expect(trip.ownerId).toBe("alice");
    expect(trip.memberIds).toEqual(["bob"]);
    expect(store.docs.get("users/alice")?.tripCount).toBe(0);
    await expect(
      service.execute("alice", { action: "trip.get", tripId: id, date: day }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("cleans orphan data only after the last personal removal", async () => {
    const { service, store, id, setNow } = await setup();
    await join(service, id);
    await service.execute("alice", {
      action: "layout.save",
      tripId: id,
      date: day,
      layout,
    });
    setNow(Date.parse("2027-10-03T00:00:00Z"));
    await service.cleanup();
    expect(store.docs.has(`trips/${id}`)).toBe(false);
    expect(store.docs.has(`users/alice/layouts/${id}_${day}`)).toBe(false);
    expect(store.docs.get("users/bob")?.tripCount).toBe(0);
  });
  it("automatic participant removal preserves the owner, content and sharing grant", async () => {
    const { service, store, id, patch, setNow } = await setup();
    await patch("pins", "pin", pin);
    const token = await join(service, id);
    await service.execute("alice", {
      action: "settings.save",
      settings: { autoDelete: false },
    });
    await service.execute("bob", {
      action: "settings.save",
      settings: { retentionDays: 30 },
    });
    setNow(Date.parse("2026-11-04T00:00:00Z"));
    await service.cleanup();
    expect(
      (
        await service.execute("alice", {
          action: "trip.get",
          tripId: id,
          date: day,
        })
      ).day,
    ).toMatchObject({ pins: [{ title: "Museum" }] });
    expect(store.docs.get("users/bob")?.tripCount).toBe(0);
    await expect(
      service.execute("bob", { action: "trip.get", tripId: id, date: day }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await service.execute(null, { action: "share.read", token })).trip,
    ).toMatchObject({ name: "Paris" });
  });
  it("allows nonconflicting simultaneous edits and reports conflicting fields", async () => {
    const { patch } = await setup();
    const { item } = await patch("pins", "pin", pin);
    const v = (item as Data).versions as Data;
    await patch("pins", "pin", { title: "Gallery" }, v);
    await patch("pins", "pin", { note: "New note" }, v);
    await expect(
      patch("pins", "pin", { title: "Stale" }, v),
    ).rejects.toMatchObject({
      status: 409,
      details: {
        fields: ["title"],
        item: { title: "Gallery", note: "New note" },
      },
    });
  });
  it("propagates inherited place data while preserving explicit overrides", async () => {
    const { patch, service, id } = await setup();
    await patch("pins", "pin", pin);
    const { item } = await patch("blocks", "block", block);
    await patch(
      "blocks",
      "block",
      { title: "My title", overrides: ["title"] },
      (item as Data).versions as Data,
    );
    await patch(
      "pins",
      "pin",
      { title: "Gallery", note: "Changed", color: "#ff0000" },
      { title: 1, note: 1, color: 1 },
    );
    const result = (
      await service.execute("alice", {
        action: "trip.get",
        tripId: id,
        date: day,
      })
    ).day as Data;
    expect(result.blocks).toMatchObject([
      { title: "My title", detail: "Changed", color: "#ff0000" },
    ]);
  });
  it("pin deletion retains blocks and tasks and removes broken connections", async () => {
    const { patch, service, id } = await setup();
    const { item } = await patch("pins", "pin", pin);
    await patch("pins", "second", { ...pin, title: "Cafe" });
    await patch("blocks", "block", block);
    await patch("tasks", "task", task);
    await patch("connections", "line", {
      from: "pin",
      to: "second",
      arrow: true,
    });
    await service.execute("alice", {
      action: "item.delete",
      tripId: id,
      date: day,
      kind: "pins",
      id: "pin",
      baseVersions: (item as Data).versions,
    });
    const result = (
      await service.execute("alice", {
        action: "trip.get",
        tripId: id,
        date: day,
      })
    ).day as Data;
    expect(result.blocks).toMatchObject([{ pinId: null }]);
    expect(result.tasks).toMatchObject([{ pinId: null, blockId: "block" }]);
    expect(result.connections).toEqual([]);
  });
  it("rejects links across days, invalid fields, invalid settings and oversized notes", async () => {
    const { patch, service } = await setup();
    await expect(patch("blocks", "block", block)).rejects.toMatchObject({
      code: "INVALID_LINK",
    });
    await expect(
      patch("pins", "pin", { ...pin, note: "x".repeat(4001) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      patch("pins", "pin", { ...pin, ownerId: "eve" }),
    ).rejects.toMatchObject({ code: "INVALID_FIELD" });
    await expect(
      service.execute("alice", {
        action: "settings.save",
        settings: { retentionDays: 0 },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("retains independent personal layouts and validates at least one open window", async () => {
    const { service, id } = await setup();
    await join(service, id);
    await service.execute("alice", {
      action: "layout.save",
      tripId: id,
      date: day,
      layout,
    });
    expect(
      (
        await service.execute("bob", {
          action: "trip.get",
          tripId: id,
          date: day,
        })
      ).layout,
    ).toBeNull();
    await expect(
      service.execute("alice", {
        action: "layout.save",
        tripId: id,
        date: day,
        layout: { ...layout, map: false, timeline: false },
      }),
    ).rejects.toMatchObject({ code: "INVALID_LAYOUT" });
  });
  it("rejoining cancels personal cleanup so new layouts survive delayed cleanup", async () => {
    const { service, id } = await setup();
    const token = await join(service, id);
    await service.execute("bob", {
      action: "layout.save",
      tripId: id,
      date: day,
      layout,
    });
    await service.execute("bob", { action: "trip.remove", tripId: id });
    await service.execute("bob", { action: "share.join", token });
    await service.execute("bob", {
      action: "layout.save",
      tripId: id,
      date: day,
      layout: { ...layout, zoom: 10 },
    });
    await service.cleanup();
    expect(
      (
        await service.execute("bob", {
          action: "trip.get",
          tripId: id,
          date: day,
        })
      ).layout,
    ).toMatchObject({ zoom: 10 });
  });
});

describe("lodging and trip date editing",()=>{
 it("requires lodging and derives its timezone on the server",async()=>{const {service}=await setup();await expect(service.execute("alice",{action:"trip.create",name:"New trip",startDate:day,endDate:day})).rejects.toMatchObject({status:400});const result=await service.execute("alice",{action:"trip.create",name:"New trip",startDate:day,endDate:day,lodging:{name:"Guesthouse",lng:-74,lat:40.7,timezone:"UTC"}});expect((result.trip as Trip).lodging).toMatchObject({timezone:"America/New_York"});});
 it("updates member retention dates without deleting the existing plan",async()=>{const {service,id,store,patch}=await setup();await join(service,id);await patch("pins","museum",pin);const before=store.docs.get(`users/bob/trips/${id}`)!.cleanupAt;await service.execute("alice",{action:"trip.update",tripId:id,name:"Extended trip",startDate:day,endDate:"2026-10-05",lodging:{name:"Guesthouse",lng:2.3,lat:48.8}});expect(store.docs.get(`users/bob/trips/${id}`)).toMatchObject({endDate:"2026-10-05"});expect(Number(store.docs.get(`users/bob/trips/${id}`)!.cleanupAt)).toBeGreaterThan(Number(before));expect((await service.execute("bob",{action:"trip.get",tripId:id,date:day})).day).toMatchObject({pins:[expect.objectContaining({title:"Museum"})]});await expect(service.execute("eve",{action:"trip.update",tripId:id,name:"Bad",startDate:day,endDate:day,lodging:{name:"Guesthouse",lng:2.3,lat:48.8}})).rejects.toMatchObject({status:403});});
});

it('saves trip-based map preference and pin-only lodging',async()=>{const {service}=await setup();await service.execute('alice',{action:'settings.save',settings:{...defaultSettings,mapStart:'trip'}});const profile=await service.execute('alice',{action:'settings.get'});expect(profile.settings).toMatchObject({mapStart:'trip'});const result=await service.execute('alice',{action:'trip.create',name:'Pin-only lodging',startDate:day,endDate:day,lodging:{lng:2.35,lat:48.85}});expect((result.trip as Trip).lodging).toMatchObject({name:'Lodging',timezone:'Europe/Paris'});});



describe('ten-minute server history',()=>{
 it('undoes and redoes item changes with monotonic versions and rejects shared conflicts',async()=>{const {service,store,id,patch}=await setup();await patch('pins','p',pin);const first=store.docs.get(`trips/${id}/days/${day}/items/p`)!;await patch('pins','p',{title:'Changed'},first.versions as Data);await service.execute('alice',{action:'history.undo',tripId:id});expect(store.docs.get(`trips/${id}/days/${day}/items/p`)?.title).toBe(pin.title);await service.execute('alice',{action:'history.redo',tripId:id});expect(store.docs.get(`trips/${id}/days/${day}/items/p`)?.title).toBe('Changed');const current=store.docs.get(`trips/${id}/days/${day}/items/p`)!;expect(Number((current.versions as Data).title)).toBeGreaterThan(Number((first.versions as Data).title));await join(service,id);await service.execute('bob',{action:'item.patch',tripId:id,date:day,kind:'pins',id:'p',patch:{title:'Remote'},baseVersions:current.versions});await expect(service.execute('alice',{action:'history.undo',tripId:id})).rejects.toMatchObject({code:'HISTORY_CONFLICT'});});
 it('restores deletion cascades and expires history after ten minutes',async()=>{const {service,store,id,patch,setNow}=await setup();await patch('pins','p',pin);await patch('tasks','t',{title:'Linked',checked:false,pinId:'p',blockId:null});const saved=store.docs.get(`trips/${id}/days/${day}/items/p`)!;await service.execute('alice',{action:'item.delete',tripId:id,date:day,kind:'pins',id:'p',baseVersions:saved.versions});expect(store.docs.get(`trips/${id}/days/${day}/items/t`)?.pinId).toBe(null);await service.execute('alice',{action:'history.undo',tripId:id});expect(store.docs.get(`trips/${id}/days/${day}/items/t`)?.pinId).toBe('p');setNow(Date.parse(day+'T12:11:00Z'));expect(await service.execute('alice',{action:'history.status',tripId:id})).toEqual({undo:null,redo:null});});
 it('does not undo a deleted trip and revokes its links immediately',async()=>{const {service,id}=await setup();const token=await join(service,id);await service.execute('alice',{action:'trip.remove',tripId:id});await expect(service.execute('alice',{action:'history.undo',tripId:id})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(service.execute(null,{action:'share.read',token})).rejects.toMatchObject({code:'INVALID_SHARE'});});
 it('does not record layout autosaves and separates history by account',async()=>{const {service,id}=await setup();const prior=await service.execute('alice',{action:'history.status',tripId:id});await service.execute('alice',{action:'layout.save',tripId:id,date:day,layout});expect(await service.execute('alice',{action:'history.status',tripId:id})).toEqual(prior);await expect(service.execute('eve',{action:'history.undo',tripId:id})).rejects.toMatchObject({code:'FORBIDDEN'});});
});

it('starts a fresh redo branch after a new planning action only',async()=>{const {service,id,patch,store}=await setup();await patch('pins','p',pin);const v=store.docs.get(`trips/${id}/days/${day}/items/p`)!.versions;await patch('pins','p',{title:'Old branch'},v as Data);await service.execute('alice',{action:'history.undo',tripId:id});await service.execute('alice',{action:'settings.save',settings:{theme:'dark'}});expect((await service.execute('alice',{action:'history.status',tripId:id})).redo).not.toBe(null);await patch('tasks','new',{title:'New branch',checked:false,pinId:null,blockId:null});expect((await service.execute('alice',{action:'history.status',tripId:id})).redo).toBe(null);});
it('returns traveler profiles without email and always includes the owner',async()=>{const {service,id,store}=await setup();await join(service,id);store.docs.set('users/alice',{...store.docs.get('users/alice'),settings:{displayName:'Alex',photoURL:'https://example.test/a.png'}});store.docs.set(`trips/${id}`,{...store.docs.get(`trips/${id}`),memberIds:['bob']});expect(await service.execute('bob',{action:'trip.members',tripId:id})).toMatchObject({members:[{id:'alice',owner:true,displayName:'Alex',photoURL:'https://example.test/a.png'},{id:'bob',owner:false}]});await expect(service.execute('eve',{action:'trip.members',tripId:id})).rejects.toMatchObject({status:403});});

it('keeps histories separate by trip and account and excludes trip/settings/share edits',async()=>{
 const {service,id,patch}=await setup();await patch('pins','p',pin);
 const second=(await service.execute('alice',{action:'trip.create',name:'Second',startDate:day,endDate:day,lodging:{lng:2.3,lat:48.8}})).trip as Trip;
 expect(await service.execute('alice',{action:'history.status',tripId:second.id})).toEqual({undo:null,redo:null});
 const prior=await service.execute('alice',{action:'history.status',tripId:id});await service.execute('alice',{action:'share.create',tripId:id,mode:'viewer'});await service.execute('alice',{action:'settings.save',settings:{theme:'dark'}});expect(await service.execute('alice',{action:'history.status',tripId:id})).toEqual(prior);
 await join(service,id);expect(await service.execute('bob',{action:'history.status',tripId:id})).toEqual({undo:null,redo:null});
});
it('lists existing share links only to the owner with their exact permissions',async()=>{
 const {service,id}=await setup();const viewer=await service.execute('alice',{action:'share.create',tripId:id,mode:'viewer'});const token=await join(service,id);
 const list=await service.execute('alice',{action:'share.list',tripId:id});expect(list.links).toEqual(expect.arrayContaining([expect.objectContaining({token:viewer.token,mode:'viewer'}),expect.objectContaining({token,mode:'editor'})]));
 await expect(service.execute('bob',{action:'share.list',tripId:id})).rejects.toMatchObject({code:'FORBIDDEN'});await service.execute('alice',{action:'share.revoke',tripId:id});expect((await service.execute('alice',{action:'share.list',tripId:id})).links).toEqual([]);
});
it('supports lodging styling and defaults block epochs to lodging timezone',async()=>{
 const {service,id,store}=await setup();await service.execute('alice',{action:'trip.update',tripId:id,name:'Paris',startDate:day,endDate:day,lodging:{name:'Guesthouse',lng:2.35,lat:48.85,color:'#e6a34c',symbol:'icon:camp',note:'Door code'}});
 expect((await service.execute('alice',{action:'trip.get',tripId:id,date:day})).trip).toMatchObject({lodging:{color:'#e6a34c',symbol:'icon:camp',note:'Door code',timezone:'Europe/Paris'}});
 await service.execute('alice',{action:'item.patch',tripId:id,date:day,kind:'blocks',id:'stay',patch:{start:'09:00',end:'10:00',pinId:'trip-lodging',overrides:[]},baseVersions:{}});
 expect(store.docs.get(`trips/${id}/days/${day}/items/stay`)).toMatchObject({title:'Guesthouse',timezone:'Europe/Paris',startEpoch:Date.parse(day+'T07:00:00Z')});
});




describe("Shared time blocks across calendar days",()=>{
  async function multi(){
    const fixture=await setup();
    const trip=fixture.store.docs.get(`trips/${fixture.id}`)!;
    fixture.store.docs.set(`trips/${fixture.id}`,{...trip,endDate:"2026-10-06"});
    const write=(date:string,patch:Data,baseVersions:Data={})=>fixture.service.execute("alice",{action:"item.patch",tripId:fixture.id,date,kind:"blocks",id:"overnight",patch,baseVersions});
    const read=(date:string)=>fixture.service.execute("alice",{action:"trip.get",tripId:fixture.id,date});
    const {item}=await write(day,{...block,pinId:null,startDate:day,endDate:"2026-10-03",start:"22:00",end:"07:00",timezone:"UTC",disambiguation:null});
    return {...fixture,write,read,item:item as any};
  }
  it("shows one shared block on every occupied day and edits from a middle day",async()=>{
    const {write,read,item}=await multi();
    for(const date of [day,"2026-10-02","2026-10-03"]){const r=await read(date);expect((r.day as any).blocks[0]).toEqual(item);}
    await write("2026-10-02",{title:"Updated from the middle",end:"08:00"},item.versions);
    for(const date of [day,"2026-10-02","2026-10-03"]){const r=await read(date);expect((r.day as any).blocks[0]).toMatchObject({id:"overnight",title:"Updated from the middle",end:"08:00"});}
    await expect(write(day,{title:"Stale edit"},item.versions)).rejects.toMatchObject({code:"CONFLICT"});
  });
  it("removes obsolete portions when shortening and excludes an endpoint at midnight",async()=>{
    const {write,read,item}=await multi();
    await write("2026-10-02",{endDate:"2026-10-02",end:"00:00"},item.versions);
    expect((await read(day)).day).toMatchObject({blocks:[expect.objectContaining({end:"00:00"})]});
    expect((await read("2026-10-02")).day).toMatchObject({blocks:[]});
    expect((await read("2026-10-03")).day).toMatchObject({blocks:[]});
  });
  it("deletes all portions and unlinks tasks in their own day",async()=>{
    const {service,id,read,item}=await multi();
    await service.execute("alice",{action:"item.patch",tripId:id,date:"2026-10-02",kind:"tasks",id:"linked",patch:{...task,pinId:null,blockId:"overnight"},baseVersions:{}});
    await service.execute("alice",{action:"item.delete",tripId:id,date:"2026-10-03",kind:"blocks",id:"overnight",baseVersions:item.versions});
    for(const date of [day,"2026-10-02","2026-10-03"])expect((await read(date)).day).toMatchObject({blocks:[]});
    expect((await read("2026-10-02")).day).toMatchObject({tasks:[expect.objectContaining({blockId:null})]});
  });
  it("shares inherited place details, and keeps portions together through undo",async()=>{
    const {write,patch,read,item,service,id}=await multi();
    const place=await patch('pins','pin',pin);
    const linked=await write(day,{pinId:'pin'},item.versions);
    await patch('pins','pin',{title:'A renamed place'},(place.item as any).versions);
    for(const date of [day,'2026-10-02','2026-10-03'])expect((await read(date)).day).toMatchObject({blocks:[expect.objectContaining({title:'A renamed place'})]});
    await service.execute('alice',{action:'history.undo',tripId:id});
    for(const date of [day,'2026-10-02','2026-10-03'])expect((await read(date)).day).toMatchObject({blocks:[expect.objectContaining({title:pin.title})]});
    expect(linked.item).toBeDefined();
  });
  it("rejects an end outside the trip and reversed dates",async()=>{
    const {write,item}=await multi();
    await expect(write(day,{endDate:"2026-10-07"},item.versions)).rejects.toBeDefined();
    await expect(write(day,{startDate:"2026-10-04"},item.versions)).rejects.toMatchObject({code:"INVALID_TIME"});
  });
});
