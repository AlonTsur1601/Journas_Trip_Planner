import { useEffect, useRef, useState } from "react";
import { MapPinPlus, Route, Waypoints, X } from "lucide-react";
import { symbolMarkup } from "./PlannerControls";
import * as maplibregl from "maplibre-gl";
import workerURL from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerURL);
import { worldViewportLimits } from "./map-viewport";
import type { Connection, Layout, Pin } from "./types";
export default function MapPanel({
  pins,
  connections,
  layout,
  onView,
  onPin,
  onAdd,
  readonly,
  onConnect,
  movingPinId,
  onMovePin,
  onCancelMove,
  onConnections,
  placementMode = false,
}: {
  pins: Pin[];
  connections: Connection[];
  layout: Layout;
  onView: (center: [number, number], zoom: number) => void;
  onPin: (pin: Pin) => void;
  onAdd: (lng: number, lat: number) => void;
  readonly: boolean;
  onConnect?: (from: string, to: string, arrow: boolean) => void;
  movingPinId?: string | null;
  onMovePin?: (pin: Pin, lng: number, lat: number) => void;
  onCancelMove?: () => void;
  onConnections?: () => void;
  placementMode?: boolean;
}) {
  const [mode,setMode]=useState<'add'|'connect'|null>(null);
  const [source,setSource]=useState<string|null>(null);
  const [arrow,setArrow]=useState(true);
  const action=useRef({mode,source,placementMode,arrow}); action.current={mode,source,placementMode,arrow};
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const callbacks = useRef({ onView, onPin, onAdd, readonly, onConnect, onMovePin });
  const restoringView = useRef(false);
  callbacks.current = { onView, onPin, onAdd, readonly, onConnect, onMovePin };
  useEffect(() => {
    if (!container.current) return;
    restoringView.current = false;
    const m = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: layout.center,
      zoom: layout.zoom,
      attributionControl: { compact: true },
      canvasContextAttributes: {preserveDrawingBuffer:true},
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    m.addControl(new maplibregl.NavigationControl({ showZoom: false }), "bottom-left");
    const compass = container.current.querySelector<HTMLButtonElement>(".maplibregl-ctrl-compass")!;
    compass.title = "Drag around the compass to rotate; click to reset north";
    compass.parentElement!.classList.add("compass-control");
    compass.insertAdjacentHTML('beforeend','<svg class="compass-ring" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>');
    compass.querySelector("span")!.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><polygon points="16,5 11,16 21,16" fill="var(--accent)"/><polygon points="16,27 21,16 11,16" fill="currentColor"/></svg>';
    let constraining = false;
    const containWorld = () => {
      if (constraining) return;
      constraining = true;
      const { width, height } = m.getCanvas().getBoundingClientRect();
      const center = m.getCenter();
      const y = maplibregl.MercatorCoordinate.fromLngLat(center).y;
      const limits = worldViewportLimits(width, height, m.getBearing(), m.getZoom(), y);
      if(Math.abs(m.getMinZoom()-limits.minZoom)>.001)m.setMinZoom(limits.minZoom);
      const bounded = limits.centerY;
      if (Math.abs(y - bounded) > 0.0000001) m.setCenter([center.lng, new maplibregl.MercatorCoordinate(0, bounded).toLngLat().lat]);
      constraining = false;
    };
    m.on("move", containWorld);
    m.on("resize", containWorld);
    containWorld();
    let rotation: { x: number; y: number; bearing: number; angle: number; cx: number; cy: number } | null = null;
    let dragged = false;
    compass.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      compass.parentElement!.classList.add('compass-engaged');
      const rect=compass.getBoundingClientRect(), cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      rotation = { x: event.clientX, y: event.clientY, bearing: m.getBearing(), angle: Math.atan2(event.clientY-cy,event.clientX-cx), cx,cy };
      dragged = false;
      compass.setPointerCapture(event.pointerId);
    }, true);
    compass.addEventListener("mousedown", (event) => event.stopImmediatePropagation(), true);
    compass.addEventListener("pointermove", (event) => {
      if (!rotation) return;
      const dx = event.clientX - rotation.x, dy = event.clientY - rotation.y;
      if (Math.hypot(dx, dy) > 3) dragged = true;
      if (dragged) {
        const rect=compass.getBoundingClientRect();
        const angle=Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2));
        let delta=(angle-rotation.angle)*180/Math.PI;
        delta=((delta+540)%360)-180;
        m.setBearing(rotation.bearing-delta);
        rotation.bearing=m.getBearing(); rotation.angle=angle;
      }
    });
    const endRotation = () => { if(rotation&&!dragged)m.resetNorth({duration:180}); rotation = null; setTimeout(()=>compass.parentElement?.classList.remove('compass-engaged'),300); };
    compass.addEventListener("pointerup", endRotation);
    compass.addEventListener("pointercancel", () => {rotation=null;compass.parentElement?.classList.remove('compass-engaged');});
    compass.addEventListener("click", (event) => {
      if (dragged) { event.preventDefault(); event.stopImmediatePropagation(); dragged = false; }
    }, true);
    let attributionInitialized = false;
    m.on("sourcedata", () => {
      const attribution = container.current?.querySelector(".maplibregl-ctrl-attrib-inner");
      if (!attribution) return;
      if (!attributionInitialized && attribution.textContent) {
        attributionInitialized = true;
        attribution.parentElement?.removeAttribute("open");
        attribution.parentElement?.classList.remove("maplibregl-compact-show");
      }
      for (const node of attribution.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Data from")) node.textContent = " ";
      }
      for (const link of attribution.querySelectorAll("a")) {
        if (link.textContent === "OpenStreetMap") link.textContent = "©OpenStreetMap";
      }
    });
    m.on('load',()=>{
      for(const layer of m.getStyle().layers??[]) if(layer.type==='symbol'&&JSON.stringify(layer.layout?.['text-field']??'').includes('name'))
        m.setLayoutProperty(layer.id,'text-field',['coalesce',['get','name:en'],['get','name_en'],'']);
    });
    m.on("moveend", () => {
      if (restoringView.current) return;
      const c = m.getCenter();
      callbacks.current.onView([c.lng, c.lat], m.getZoom());
    });
    let gestureDragged=false;
    m.on('mousedown',()=>{gestureDragged=false;});
    m.on('touchstart',()=>{gestureDragged=false;});
    m.on('dragstart',()=>{gestureDragged=true;container.current?.classList.add('map-dragging');});
    m.on('dragend',()=>container.current?.classList.remove('map-dragging'));
    m.on('click',e=>{if(!callbacks.current.readonly&&!gestureDragged&&(action.current.mode==='add'||action.current.placementMode)&&!(e.originalEvent.target as HTMLElement)?.closest('button')){callbacks.current.onAdd(e.lngLat.lng,e.lngLat.lat);setMode(null);}});
    m.doubleClickZoom.disable();
    let resizeFrame=0;
    const retainedFrame=document.createElement('canvas');
    retainedFrame.className='map-retained-frame';
    retainedFrame.setAttribute('aria-hidden','true');
    let retaining=false, awaitingResize=false, renderedFrame=false;
    const revealRenderedMap=()=>{
      if(!retaining)renderedFrame=true;
      if(retaining && !awaitingResize && m.areTilesLoaded()){
        retainedFrame.remove();
        retaining=false;
      }
    };
    m.on('render',revealRenderedMap);
    const observer = new ResizeObserver(() => {
      awaitingResize=true;
      // Resizing a WebGL drawing buffer clears it. Keep its last complete image
      // stretched over the new dimensions until the replacement render is ready.
      if(!retaining && renderedFrame){
        const canvas=m.getCanvas();
        retainedFrame.width=canvas.width;
        retainedFrame.height=canvas.height;
        retainedFrame.getContext('2d')!.drawImage(canvas,0,0);
        canvas.parentElement!.append(retainedFrame);
        retaining=true;
      }
      cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(()=>{
        restoringView.current=true;
        m.resize();
        awaitingResize=false;
        m.triggerRepaint();
        restoringView.current=false;
      });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      retainedFrame.remove();
      m.off('render',revealRenderedMap);
      cancelAnimationFrame(resizeFrame);
      restoringView.current = true;
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    const tooltip = new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:38,maxWidth:'260px',className:'pin-tooltip'});
    markers.current = pins.map((pin) => {
      const el = document.createElement("button");
      el.className = "map-pin";
      el.style.background = pin.color;
      const content=document.createElement('span');content.className='pin-symbol';const markup=symbolMarkup(pin.symbol);if(markup)content.innerHTML=markup;else content.textContent=pin.symbol;el.appendChild(content);
      el.setAttribute("aria-label", `Place: ${pin.title}`);
      const showTooltip=()=>{
        if(movingPinId||placementMode)return;
        const bubble=document.createElement('div');
        const title=document.createElement('strong');title.textContent=pin.title;bubble.appendChild(title);
        if(pin.note){const note=document.createElement('p');note.textContent=pin.note;bubble.appendChild(note);}
        tooltip.setLngLat([pin.lng,pin.lat]).setDOMContent(bubble).addTo(m);
      };
      el.addEventListener('mouseenter',showTooltip);
      el.addEventListener('mouseleave',()=>tooltip.remove());
      el.addEventListener('focus',showTooltip);
      el.addEventListener('blur',()=>tooltip.remove());
      el.addEventListener('pointerdown',()=>tooltip.remove());
      let ignoreClick=false;
      el.onclick = (event) => {event.stopPropagation();if(ignoreClick){ignoreClick=false;return;}if(action.current.mode==='connect'){if(!action.current.source){setSource(pin.id);}else if(action.current.source!==pin.id){callbacks.current.onConnect?.(action.current.source,pin.id,action.current.arrow);setSource(null);setMode(null);}}else if(!movingPinId&&!placementMode)callbacks.current.onPin(pin);};
      const marker=new maplibregl.Marker({ element: el, draggable: false })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m);
      if(movingPinId===pin.id || placementMode){
        el.classList.add('drag-edit');
        let drag: {x:number;y:number;pixel:maplibregl.PointLike;original:[number,number];moved:boolean}|null=null;
        el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();m.stop();const point=m.project(marker.getLngLat());const original=marker.getLngLat();drag={x:e.clientX,y:e.clientY,pixel:[point.x,point.y],original:[original.lng,original.lat],moved:false};el.setPointerCapture(e.pointerId);});
        el.addEventListener('pointermove',e=>{if(!drag)return;e.stopPropagation();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>3)drag.moved=true;if(drag.moved){const [x,y]=drag.pixel as [number,number];marker.setLngLat(m.unproject([x+dx,y+dy]));}});
        el.addEventListener('pointerup',e=>{if(!drag)return;e.stopPropagation();const moved=drag.moved;drag=null;if(moved){ignoreClick=true;const p=marker.getLngLat();if(placementMode)callbacks.current.onAdd(p.lng,p.lat);else callbacks.current.onMovePin?.(pin,p.lng,p.lat);}});
        el.addEventListener('pointercancel',()=>{if(drag)marker.setLngLat(drag.original);drag=null;});
      }
      return marker;
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
            // Trim the line and arrow to the same visible endpoint beside the pin.
            el.style.visibility = distance < 42 ? "hidden" : "visible";
            if (distance < 42) return;
            const ux = dx / distance, uy = dy / distance;
            const tipX = 40 - ux * 20, tipY = 40 - uy * 20;
            const baseX = tipX - ux * 13, baseY = tipY - uy * 13;
            // End inside the arrowhead, so the round line cap cannot protrude past its tip.
            const end=m.unproject([target.x-ux*29,target.y-uy*29]);
            (m.getSource(id) as maplibregl.GeoJSONSource)?.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[a.lng,a.lat],[end.lng,end.lat]]}});
            head.setAttribute("points", `${tipX},${tipY} ${baseX - uy * 7},${baseY + ux * 7} ${baseX + uy * 7},${baseY - ux * 7}`);
            gradient.setAttribute("x1", String(40 - dx));
            gradient.setAttribute("y1", String(40 - dy));
            gradient.setAttribute("x2", String(tipX));
            gradient.setAttribute("y2", String(tipY));
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
    // Tile loading can make isStyleLoaded false after the one-time load event.
    // Route layers only need the parsed style, not every visible tile.
    if (m.getStyle()?.layers?.length) draw();
    else m.once("style.load", draw);
    m.on("move", updateArrows);
    return () => {
      tooltip.remove();
      m.off("style.load", draw);
      m.off("move", updateArrows);
    };
  }, [pins, connections, movingPinId, placementMode]);
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
    <div className={`map-wrapper${mode==='add'||placementMode?' placing-pin':''}`}>
      <div ref={container} className="map-canvas" />
      {!placementMode&&(!readonly||onConnections)&&<div className="map-tools">{!readonly&&<><button className={`icon${mode==='add'?' active':''}`} aria-label="Add pin on map" title="Add pin: click a place on the map" onClick={()=>{setMode(mode==='add'?null:'add');setSource(null);}}><MapPinPlus size={19}/></button><button className={`icon${mode==='connect'?' active':''}`} aria-label="Connect pins on map" title="Connect: select two pins" disabled={pins.length<2} onClick={()=>{setMode(mode==='connect'?null:'connect');setSource(null);}}><Route size={19}/></button><label className="map-arrow-choice" title="Create directional arrows"><input type="checkbox" aria-label="Connect with arrow" checked={arrow} onChange={e=>setArrow(e.target.checked)}/><span>Arrow</span></label></>}{onConnections&&<button className="icon connections-button" aria-label="Connections" title="Connections" onClick={()=>{setMode(null);setSource(null);onConnections();}}><Waypoints size={19}/></button>}</div>}
      {(mode||movingPinId)&&<div className="map-mode-note">{movingPinId?'Drag the selected pin to its new location':mode==='add'?'Click the map to add a pin':source?'Select the destination pin':'Select the starting pin'}<button className="icon" aria-label="Cancel map action" onClick={()=>{setMode(null);setSource(null);onCancelMove?.();}}><X size={15}/></button></div>}
    </div>
  );
}
