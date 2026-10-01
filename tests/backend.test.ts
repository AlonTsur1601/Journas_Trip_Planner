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
    action: "trip.create",
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
          action: "trip.create",
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
        action: "trip.create",
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
    ).toEqual({ global: false });
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
    const { service, store, id } = await setup();
    const token = await join(service, id);
    expect(
      await service.execute("alice", { action: "trip.remove", tripId: id }),
    ).toEqual({ global: true });
    await expect(
      service.execute("bob", { action: "trip.get", tripId: id, date: day }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.execute(null, { action: "share.read", token }),
    ).rejects.toMatchObject({ code: "INVALID_SHARE" });
    expect(store.docs.get("users/bob")?.tripCount).toBe(0);
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
