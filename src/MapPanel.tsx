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
    const arrowUpdates: (() => void)[] = [];
    const updateArrows = () => arrowUpdates.forEach((update) => update());
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
          const el = document.createElement("span");
          el.className = "route-arrow";
          const ns = "http://www.w3.org/2000/svg";
          const svg = document.createElementNS(ns, "svg");
          svg.setAttribute("viewBox", "0 0 80 80");
          svg.setAttribute("width", "80");
          svg.setAttribute("height", "80");
          const defs = document.createElementNS(ns, "defs");
          const gradient = document.createElementNS(ns, "linearGradient");
          gradient.id = `arrow-gradient-${connection.id}`;
          gradient.setAttribute("gradientUnits", "userSpaceOnUse");
          for (const [offset, color] of [["0", a.color], ["1", b.color]]) {
            const stop = document.createElementNS(ns, "stop");
            stop.setAttribute("offset", offset);
            stop.setAttribute("stop-color", color);
            gradient.append(stop);
          }
          defs.append(gradient);
          const head = document.createElementNS(ns, "polygon");
          head.setAttribute("fill", `url(#${gradient.id})`);
          svg.append(defs, head);
          el.append(svg);
          const update = () => {
            const source = m.project([a.lng, a.lat]);
            const target = m.project([b.lng, b.lat]);
            const dx = target.x - source.x, dy = target.y - source.y;
            const distance = Math.hypot(dx, dy);
            // Leave the arrow tip outside the destination pin's footprint.
            el.style.visibility = distance < 42 ? "hidden" : "visible";
            if (distance < 42) return;
            const ux = dx / distance, uy = dy / distance;
            const tipX = 40 - ux * 20, tipY = 40 - uy * 20;
            const baseX = 40 - ux * 33, baseY = 40 - uy * 33;
            head.setAttribute("points", `${tipX},${tipY} ${baseX - uy * 7},${baseY + ux * 7} ${baseX + uy * 7},${baseY - ux * 7}`);
            gradient.setAttribute("x1", String(40 - dx));
            gradient.setAttribute("y1", String(40 - dy));
            gradient.setAttribute("x2", "40");
            gradient.setAttribute("y2", "40");
          };
          arrowUpdates.push(update);
          update();
          markers.current.push(
            new maplibregl.Marker({
              element: el,
              rotationAlignment: "viewport",
              pitchAlignment: "viewport",
            })
              .setLngLat([b.lng, b.lat])
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
    m.on("move", updateArrows);
    return () => {
      m.off("load", draw);
      m.off("move", updateArrows);
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

    </div>
  );
}
