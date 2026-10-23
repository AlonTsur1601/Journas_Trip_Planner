import { defaultLayout, type Layout, type Settings, type Trip } from "./types";

export function lodgingForDate(trip:Trip|null|undefined,date:string){
  return trip&&date>=trip.startDate&&date<=trip.endDate?trip.lodging:undefined;
}

export async function startingLayout(settings: Settings, lodging?: {lng:number;lat:number}): Promise<Layout> {
  const layout = defaultLayout();
  if((settings.mapStart === "trip" || settings.mapStart === "custom") && lodging)return {...layout,center:[lodging.lng,lodging.lat],zoom:14};
  if (settings.mapStart === "world") return layout;
  if (!navigator.geolocation) return layout;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ ...layout, center: [coords.longitude, coords.latitude], zoom: 12 }),
      () => resolve(layout),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
