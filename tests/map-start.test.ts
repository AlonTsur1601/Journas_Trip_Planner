import { afterEach, expect, it, vi } from "vitest";
import { startingLayout } from "../src/map-start";
import { defaultSettings } from "../src/types";

afterEach(() => vi.unstubAllGlobals());

it("uses the browser location without requesting high accuracy", async () => {
  const getCurrentPosition = vi.fn((success: (position: unknown) => void, _error: unknown, _options: unknown) => success({ coords: { longitude: 34.78, latitude: 32.08 } }));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  const view = await startingLayout(defaultSettings);
  expect(view.center).toEqual([34.78, 32.08]);
  expect(view.zoom).toBe(12);
  expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: false, timeout: 10000 });
});

it("falls back to the world when location access fails", async () => {
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: unknown, error: () => void) => error() } });
  expect(await startingLayout(defaultSettings)).toMatchObject({ center: [0, 0], zoom: 0 });
});

it("opens custom and world views without asking for location", async () => {
  const getCurrentPosition = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  expect(await startingLayout({ ...defaultSettings, mapStart: "custom", mapCenter: [-74, 40.7], mapZoom: 10 })).toMatchObject({ center: [-74, 40.7], zoom: 10 });
  expect(await startingLayout({ ...defaultSettings, mapStart: "world" })).toMatchObject({ center: [0, 0], zoom: 0 });
  expect(getCurrentPosition).not.toHaveBeenCalled();
});
