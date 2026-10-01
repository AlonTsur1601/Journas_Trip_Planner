import { defaultLayout, type Layout, type Settings } from "./types";

export async function startingLayout(settings: Settings): Promise<Layout> {
  const layout = defaultLayout();
  if (settings.mapStart === "world") return layout;
  if (settings.mapStart === "custom")
    return { ...layout, center: settings.mapCenter, zoom: settings.mapZoom };
  if (!navigator.geolocation) return layout;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ ...layout, center: [coords.longitude, coords.latitude], zoom: 12 }),
      () => resolve(layout),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
