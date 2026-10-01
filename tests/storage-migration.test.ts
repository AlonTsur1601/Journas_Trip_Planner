import { describe, expect, it } from "vitest";
import { migratePlannerStorage } from "../src/storage-migration";
function storage(initial: Record<string, string>, failWrites = false): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key: (index) => Array.from(values.keys())[index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrites) throw new Error("Quota exceeded");
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
}
describe("planner rename preserves recovery data", () => {
  it("retains draft/layout content while moving namespaces and unrelated keys", () => {
    const data = storage({
      "origin-drafts:user:trip:date": '{"note":"unsaved"}',
      "origin-layout:user:trip:date": '{"zoom":15}',
      "tevel-viewlayout:user:trip:date": '{"todo":true}',
      unrelated: "keep",
    });
    migratePlannerStorage(data);
    expect(data.getItem("journas-drafts:user:trip:date")).toBe(
      '{"note":"unsaved"}',
    );
    expect(data.getItem("journas-layout:user:trip:date")).toBe('{"zoom":15}');
    expect(data.getItem("origin-drafts:user:trip:date")).toBeNull();
    expect(data.getItem("unrelated")).toBe("keep");
    migratePlannerStorage(data);
    expect(data.getItem("journas-viewlayout:user:trip:date")).toBe('{"todo":true}');
    expect(data.getItem("tevel-viewlayout:user:trip:date")).toBeNull();
    expect(data.length).toBe(4);
  });
  it("preserves both differing drafts and keeps recovery data when storage is full", () => {
    const key = "origin-drafts:user:trip:date";
    const conflicting = storage({
      [key]: "older",
      "journas-drafts:user:trip:date": "newer",
    });
    migratePlannerStorage(conflicting);
    expect(conflicting.getItem(key)).toBe("older");
    expect(conflicting.getItem("journas-drafts:user:trip:date")).toBe("newer");
    const full = storage({ [key]: "unsaved" }, true);
    migratePlannerStorage(full);
    expect(full.getItem(key)).toBe("unsaved");
  });
});
