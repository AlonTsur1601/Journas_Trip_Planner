import { afterEach, expect, it, vi } from "vitest";
import { startingLayout, lodgingForDate } from "../src/map-start";
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

it("ignores removed custom coordinates and opens world view without location", async () => {
  const getCurrentPosition = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  expect(await startingLayout({ ...defaultSettings, mapStart: "custom", mapCenter: [-74, 40.7], mapZoom: 10 },{lng:2.35,lat:48.85})).toMatchObject({ center: [2.35,48.85], zoom: 14 });
  expect(await startingLayout({ ...defaultSettings, mapStart: "world" })).toMatchObject({ center: [0, 0], zoom: 0 });
  expect(getCurrentPosition).not.toHaveBeenCalled();
});

it("opens lodging only when trip mode is selected", async()=>{expect(await startingLayout({...defaultSettings,mapStart:"trip"},{lng:2.35,lat:48.85})).toMatchObject({center:[2.35,48.85],zoom:14});});

it('uses current location when no trip lodging exists',async()=>{const getCurrentPosition=vi.fn(success=>success({coords:{longitude:34.78,latitude:32.08}}));vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}});expect(await startingLayout(defaultSettings)).toMatchObject({center:[34.78,32.08],zoom:12});});
it('respects world preference even with lodging',async()=>{expect(await startingLayout({...defaultSettings,mapStart:'world'},{lng:2.35,lat:48.85})).toMatchObject({center:[0,0],zoom:0});});


it('defaults to the trip without requesting the current location',async()=>{const getCurrentPosition=vi.fn();vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}});expect(await startingLayout(defaultSettings,{lng:2.35,lat:48.85})).toMatchObject({center:[2.35,48.85],zoom:14});expect(getCurrentPosition).not.toHaveBeenCalled();});
it('uses lodging only within the selected trip dates',()=>{const trip={startDate:'2026-10-20',endDate:'2026-10-22',lodging:{lng:2.35,lat:48.85}} as any;expect(lodgingForDate(trip,'2026-10-20')).toBe(trip.lodging);expect(lodgingForDate(trip,'2026-10-22')).toBe(trip.lodging);expect(lodgingForDate(trip,'2026-10-19')).toBeUndefined();expect(lodgingForDate(trip,'2026-10-23')).toBeUndefined();});
