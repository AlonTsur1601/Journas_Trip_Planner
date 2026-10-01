import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import workerURL from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerURL);
import type { Connection, Layout, Pin } from "./types";
export default function MapPanel({
  pins,
  connections,
  layout,
  onView,
  onPin,
  onAdd,
  readonly,
}: {
  pins: Pin[];
  connections: Connection[];
  layout: Layout;
  onView: (center: [number, number], zoom: number) => void;
  onPin: (pin: Pin) => void;
  onAdd: (lng: number, lat: number) => void;
  readonly: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const callbacks = useRef({ onView, onPin, onAdd, readonly });
  const restoringView = useRef(false);
  callbacks.current = { onView, onPin, onAdd, readonly };
  useEffect(() => {
    if (!container.current) return;
    restoringView.current = false;
    const m = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: layout.center,
      zoom: layout.zoom,
      attributionControl: {},
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "bottom-left");
    m.on("moveend", () => {
      if (restoringView.current) return;
      const c = m.getCenter();
      callbacks.current.onView([c.lng, c.lat], m.getZoom());
    });
    m.on("dblclick", (e) => {
      if (!callbacks.current.readonly) {
        e.preventDefault();
        callbacks.current.onAdd(e.lngLat.lng, e.lngLat.lat);
      }
    });
    m.doubleClickZoom.disable();
    const observer = new ResizeObserver(() => {
      restoringView.current = true;
      m.resize();
      restoringView.current = false;
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      restoringView.current = true;
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = pins.map((pin) => {
      const el = document.createElement("button");
      el.className = "map-pin";
      el.style.background = pin.color;
      el.textContent = pin.symbol;
      el.title = pin.title;
      el.setAttribute("aria-label", `Place: ${pin.title}`);
      el.onclick = () => callbacks.current.onPin(pin);
      return new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m);
    });
    const draw = () => {
      connections.forEach((connection) => {
        const a = pins.find((x) => x.id === connection.from),
          b = pins.find((x) => x.id === connection.to);
        if (!a || !b) return;
        const id = `route-${connection.id}`;
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getLayer(`${id}-arrow`)) m.removeLayer(`${id}-arrow`);
        if (m.getSource(id)) m.removeSource(id);
        m.addSource(id, {
          type: "geojson",
          lineMetrics: true,
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [a.lng, a.lat],
                [b.lng, b.lat],
              ],
            },
          },
        });
        m.addLayer({
          id,
          type: "line",
          source: id,
          paint: {
            "line-width": 4,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0,
              a.color,
              1,
              b.color,
            ],
          },
        });
        if (connection.arrow) {
          const mid: [number, number] = [
            (a.lng + b.lng) / 2,
            (a.lat + b.lat) / 2,
          ];
          const el = document.createElement("span");
          el.className = "route-arrow";
          el.style.color = b.color;
          el.textContent = "➤";
          const rotation =
            (Math.atan2(
              (a.lat - b.lat) / Math.cos((mid[1] * Math.PI) / 180),
              b.lng - a.lng,
            ) *
              180) /
            Math.PI;
          markers.current.push(
            new maplibregl.Marker({
              element: el,
              rotation,
              rotationAlignment: "map",
            })
              .setLngLat(mid)
              .addTo(m),
          );
        }
      });
      const wanted = new Set(connections.map((x) => `route-${x.id}`));
      for (const layer of m.getStyle().layers ?? []) {
        if (layer.id.startsWith("route-") && !wanted.has(layer.id)) {
          m.removeLayer(layer.id);
          if (m.getSource(layer.id)) m.removeSource(layer.id);
        }
      }
    };
    if (m.isStyleLoaded()) draw();
    else m.once("load", draw);
    return () => {
      m.off("load", draw);
    };
  }, [pins, connections]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    if (
      Math.abs(c.lng - layout.center[0]) > 0.00001 ||
      Math.abs(c.lat - layout.center[1]) > 0.00001 ||
      Math.abs(m.getZoom() - layout.zoom) > 0.00001
    ) {
      restoringView.current = true;
      m.jumpTo({ center: layout.center, zoom: layout.zoom });
      restoringView.current = false;
    }
  }, [layout.center[0], layout.center[1], layout.zoom]);
  return (
    <div className="map-wrapper">
      <div ref={container} className="map-canvas" />
      <div className="map-hint">
        {readonly
          ? "Select a place to explore its notes"
          : "Double-click the map to add a place"}
      </div>
    </div>
  );
}
