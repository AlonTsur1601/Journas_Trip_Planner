import {connectionTitle} from './connection-label';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapPinPlus, MapPinned, LocateFixed, House, Copy, Pencil, Focus, Compass, ClipboardPaste, Route, Waypoints, X } from "lucide-react";
import {createPortal} from 'react-dom';
import {MotionSurface} from './MotionSurface';
import {LoadingSpinner} from './LoadingScreen';
import { symbolMarkup } from "./PlannerControls";
import * as maplibregl from "maplibre-gl";
import workerURL from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerURL);
const noActivePins:string[]=[];
import { worldViewportLimits } from "./map-viewport";
import type { Connection, Layout, Pin } from "./types";
export default function MapPanel({
  pins,
  connections,
  layout,
  onView,
  onPin,
  onConnection,
  onAdd,
  readonly,
  onConnect,
  movingPinId,
  onMovePin,
  onCancelMove,
  onConnections,
  placementMode = false,
  arrowPreference = true,
  onArrowPreferenceChange,
  onStartPinSearch,
  onPlaces,liveLocation,lodging,activePinIds=noActivePins,onCopyPin,onPastePin,canPastePin=false,contextKey,contextMenuDisabled=false,onLocate,locationStatus="idle",
}: {
  pins: Pin[];
  connections: Connection[];
  layout: Layout;
  onView: (center: [number, number], zoom: number) => void;
  onPin: (pin: Pin) => void;
  onConnection?: (connection:Connection) => void;
  onAdd: (lng: number, lat: number) => void;
  readonly: boolean;
  onConnect?: (from: string, to: string, arrow: boolean) => void;
  movingPinId?: string | null;
  onMovePin?: (pin: Pin, lng: number, lat: number) => void;
  onCancelMove?: () => void;
  onConnections?: () => void;
  placementMode?: boolean;
  arrowPreference?: boolean;
  onArrowPreferenceChange?: (checked:boolean)=>void;
  onStartPinSearch?: ()=>void;
  onPlaces?:()=>void;
  liveLocation?:{lng:number;lat:number;accuracy?:number}|null;
  lodging?:{lng:number;lat:number;name?:string}|null;
  activePinIds?:string[];
  onCopyPin?:(pin:Pin)=>void;
  onPastePin?:()=>void|Promise<void>;
  canPastePin?:boolean;
  contextKey?:string;
  contextMenuDisabled?:boolean;
  onLocate?:()=>void;
  locationStatus?:"idle"|"pending"|"active"|"denied"|"unavailable";
}) {
  const [mode,setMode]=useState<'add'|'connect'|null>(null);
  const [source,setSource]=useState<string|null>(null);
  const [pendingPaste,setPendingPaste]=useState(false);
  const pasteFromMenu=async()=>{if(pendingPaste||!onPastePin)return;const result=onPastePin();if(result&&typeof result.then==='function'){setPendingPaste(true);try{await result;}finally{setPendingPaste(false);setContextMenu(null);}}else setContextMenu(null);};
  const [contextMenu,setContextMenu]=useState<{x:number;y:number;lng:number;lat:number;pin?:Pin}|null>(null);
  const menuBox=useRef<HTMLDivElement>(null);
  const liveMarker=useRef<maplibregl.Marker|null>(null);
  const liveLocationRef=useRef(liveLocation);liveLocationRef.current=liveLocation;
  const updateLiveMarker=useRef<()=>void>(()=>{});
  const focusPoint=(point:{lng:number;lat:number})=>{map.current?.flyTo({center:[point.lng,point.lat],zoom:Math.max(map.current.getZoom(),15),essential:true});setContextMenu(null);};
  useEffect(()=>{setContextMenu(null);setMode(null);setSource(null);},[contextKey]);
  useEffect(()=>{if(contextMenuDisabled)setContextMenu(null);},[contextMenuDisabled]);
  useLayoutEffect(()=>{
    const box=menuBox.current;if(!box||!contextMenu)return;
    const position=()=>{const rect=box.getBoundingClientRect();box.style.left=`${Math.max(8,Math.min(contextMenu.x,innerWidth-rect.width-8))}px`;box.style.top=`${Math.max(8,Math.min(contextMenu.y,innerHeight-rect.height-8))}px`;};
    position();const outside=(event:PointerEvent)=>{if(!box.contains(event.target as Node))setContextMenu(null);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setContextMenu(null);}if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){const items=[...box.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];if(!items.length)return;event.preventDefault();const current=items.indexOf(document.activeElement as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next].focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',position);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',position);};
  },[contextMenu]);
  const arrow=arrowPreference;
  const action=useRef({mode,source,placementMode,arrow}); action.current={mode,source,placementMode,arrow};
  const viewport = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const callbacks = useRef({ onView, onPin, onAdd, readonly, onConnect, onMovePin,onConnection,connections,movingPinId });
  const restoringView = useRef(false);
  callbacks.current = { onView, onPin, onAdd, readonly, onConnect, onMovePin,onConnection,connections,movingPinId };
  useEffect(() => {
    if (!container.current || !viewport.current) return;
    const visible = viewport.current;
    const surface = container.current;
    // Reserve only the splitter range, without an additional outer margin. Splitter
    // movement changes only this window into an already rendered map surface.
    const sizeSurface = () => {
      const workspace = visible.closest('.workspace');
      const width = Math.ceil((workspace?.clientWidth ?? visible.clientWidth));
      const height = Math.ceil((workspace?.clientHeight ?? visible.clientHeight));
      const x = (width-visible.clientWidth)/2, y = (height-visible.clientHeight)/2;
      const changed = surface.style.width !== `${width}px` || surface.style.height !== `${height}px`;
      Object.assign(surface.style,{width:`${width}px`,height:`${height}px`,left:`${-x}px`,top:`${-y}px`,right:'auto',bottom:'auto'});
      surface.style.setProperty('--map-inset-x',`${x}px`);
      surface.style.setProperty('--map-inset-y',`${y}px`);
      return changed;
    };
    sizeSurface();
    restoringView.current = false;
    const m = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: layout.center,
      zoom: layout.zoom,
      attributionControl: { compact: true },
      trackResize: false,
      canvasContextAttributes: {preserveDrawingBuffer:true},
      transformConstrain:(center,zoom)=>{
        const workspace=visible.closest('.workspace')??visible;
        const bounds=workspace.getBoundingClientRect();
        const bearing=map.current?.getBearing()??0;
        const y=maplibregl.MercatorCoordinate.fromLngLat(center).y;
        const minimum=worldViewportLimits(bounds.width,bounds.height,bearing,zoom,y).minZoom;
        const constrainedZoom=Math.max(minimum,Math.min(22,zoom));
        const limits=worldViewportLimits(visible.clientWidth,visible.clientHeight,bearing,constrainedZoom,y);
        return {center:new maplibregl.LngLat(center.lng,new maplibregl.MercatorCoordinate(0,limits.centerY).toLngLat().lat),zoom:constrainedZoom};
      },
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
      if (constraining || visible.closest('[aria-hidden="true"]')) return;
      constraining = true;
      // Keep world bounds independent of the splitter. Recomputing the minimum
      // zoom from the visible crop zoomed the map in/out while it was resized.
      const { width, height } = (visible.closest('.workspace') ?? visible).getBoundingClientRect();
      const center = m.getCenter();
      const y = maplibregl.MercatorCoordinate.fromLngLat(center).y;
      const limits = worldViewportLimits(width, height, m.getBearing(), m.getZoom(), y);
      if(Math.abs(m.getMinZoom()-limits.minZoom)>.001)m.setMinZoom(limits.minZoom);
      const bounded = worldViewportLimits(visible.clientWidth,visible.clientHeight,m.getBearing(),m.getZoom(),y).centerY;
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
    const attributionControl=surface.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
    const attributionButton=attributionControl?.querySelector<HTMLElement>('summary');
    let attributionOpen=false;
    let attributionMotion:Animation|undefined;
    const toggleAttribution=(event:MouseEvent)=>{
      if(!attributionControl)return;
      event.preventDefault();event.stopImmediatePropagation();
      const inner=attributionControl.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-inner');
      if(!inner)return;
      const left=Boolean(attributionControl.closest('.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-top-left'));
      const collapsed=`inset(0 ${left?'100%':'0'} 0 ${left?'0':'100%'} round 12px)`;
      const expanded='inset(0 0 0 0 round 12px)';
      const previousClip=attributionMotion?getComputedStyle(inner).clipPath:attributionOpen?expanded:collapsed;
      attributionMotion?.cancel();
      attributionOpen=!attributionOpen;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){
        attributionControl.open=attributionOpen;
        attributionControl.classList.toggle('maplibregl-compact-show',attributionOpen);return;
      }
      attributionControl.open=true;attributionControl.classList.add('maplibregl-compact-show');
      const opening=attributionOpen;
      const motion=inner.animate([{clipPath:previousClip},{clipPath:opening?expanded:collapsed}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      attributionMotion=motion;
      motion.finished.then(()=>{
        if(attributionMotion!==motion)return;
        attributionControl.open=opening;attributionControl.classList.toggle('maplibregl-compact-show',opening);
        motion.cancel();attributionMotion=undefined;
      },()=>{});
    };
    attributionButton?.addEventListener('click',toggleAttribution,true);
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
      if (restoringView.current || visible.closest('[aria-hidden="true"]')) return;
      const c = m.getCenter();
      callbacks.current.onView([c.lng, c.lat], m.getZoom());
    });
    let gestureDragged=false;
    m.on('mousedown',()=>{gestureDragged=false;});
    m.on('touchstart',()=>{gestureDragged=false;});
    m.on('dragstart',()=>{setContextMenu(null);gestureDragged=true;container.current?.classList.add('map-dragging');});
    m.on('dragend',()=>container.current?.classList.remove('map-dragging'));
    const connectionAt=(point:maplibregl.Point)=>{const layers=(m.getStyle()?.layers??[]).filter(layer=>layer.id.startsWith('route-')&&layer.id.endsWith(':hit')).map(layer=>layer.id);if(!layers.length)return;const id=m.queryRenderedFeatures(point,{layers})[0]?.properties?.connectionId;return callbacks.current.connections.find(connection=>connection.id===id);};
    m.on('click',e=>{if(gestureDragged||(e.originalEvent.target as HTMLElement)?.closest('button'))return;if(!callbacks.current.readonly&&(action.current.mode==='add'||action.current.placementMode)){callbacks.current.onAdd(e.lngLat.lng,e.lngLat.lat);setMode(null);}else if(!action.current.mode&&!action.current.placementMode&&!callbacks.current.movingPinId){const connection=connectionAt(e.point);if(connection)callbacks.current.onConnection?.(connection);}});
    m.on('mousemove',e=>{m.getCanvas().style.cursor=!action.current.mode&&!action.current.placementMode&&!callbacks.current.movingPinId&&callbacks.current.onConnection&&connectionAt(e.point)?'pointer':'';});
    m.doubleClickZoom.disable();
    let resizeFrame=0;
    const retainedFrame=document.createElement('canvas');
    retainedFrame.className='map-retained-frame';
    retainedFrame.setAttribute('aria-hidden','true');
    let retaining=false, awaitingResize=false, renderedFrame=false;
    // A buffered resize snapshot must never cover the live map during a gesture.
    const revealInteractiveMap=()=>{retainedFrame.remove();retaining=false;};
    m.on('touchstart',revealInteractiveMap);
    m.on('dragstart',revealInteractiveMap);
    m.on('zoomstart',revealInteractiveMap);
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
      // Window-size changes can require a new buffer. Retain the old pixels at
      // their original size, centered and clipped, until the new tiles are ready.
      const workspace=visible.closest('.workspace');
      const needsBuffer=surface.clientWidth!==Math.ceil((workspace?.clientWidth??visible.clientWidth))||surface.clientHeight!==Math.ceil((workspace?.clientHeight??visible.clientHeight));
      if(!needsBuffer){sizeSurface();containWorld();awaitingResize=false;return;}
      if(!retaining && renderedFrame){
        const canvas=m.getCanvas();
        retainedFrame.width=canvas.width;
        retainedFrame.height=canvas.height;
        retainedFrame.style.width=`${surface.clientWidth}px`;
        retainedFrame.style.height=`${surface.clientHeight}px`;
        retainedFrame.getContext('2d')!.drawImage(canvas,0,0);
        visible.append(retainedFrame);
        retaining=true;
      }
      cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(()=>{
        restoringView.current=true;
        sizeSurface();
        m.resize();
        awaitingResize=false;
        m.triggerRepaint();
        restoringView.current=false;
      });
    });
    observer.observe(visible);
    if(visible.closest('.workspace'))observer.observe(visible.closest('.workspace')!);
    return () => {
      attributionButton?.removeEventListener('click',toggleAttribution,true);
      attributionMotion?.cancel();
      observer.disconnect();
      retainedFrame.remove();
      m.off('touchstart',revealInteractiveMap);
      m.off('dragstart',revealInteractiveMap);
      m.off('zoomstart',revealInteractiveMap);
      m.off('render',revealRenderedMap);
      cancelAnimationFrame(resizeFrame);
      restoringView.current = true;
      liveMarker.current?.remove();liveMarker.current=null;
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
      el.type="button";
      el.className = "map-pin"+(activePinIds.includes(pin.id)?" is-active":"");
      if(activePinIds.includes(pin.id))el.setAttribute("aria-current","true");
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
      el.oncontextmenu=event=>{if(contextMenuDisabled){event.preventDefault();event.stopPropagation();return;}if(placementMode||movingPinId)return;event.preventDefault();event.stopPropagation();tooltip.remove();setContextMenu({x:event.clientX,y:event.clientY,lng:pin.lng,lat:pin.lat,pin});};
      let ignoreClick=false;
      el.onclick = (event) => {event.preventDefault();event.stopPropagation();if(placementMode)return;if(ignoreClick){ignoreClick=false;return;}if(action.current.mode==='connect'){if(!action.current.source){setSource(pin.id);}else if(action.current.source!==pin.id){callbacks.current.onConnect?.(action.current.source,pin.id,action.current.arrow);setSource(null);setMode(null);}}else if(!movingPinId&&!placementMode)callbacks.current.onPin(pin);};
      const marker=new maplibregl.Marker({ element: el, draggable: false })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m);
      if(!readonly && (movingPinId===pin.id || placementMode)){
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
        if (m.getLayer(`${id}:hit`))m.removeLayer(`${id}:hit`);
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
        m.addSource(id, {
          type: "geojson",
          lineMetrics: true,
          data: {
            type: "Feature",
            properties: {connectionId:connection.id},
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
        m.addLayer({id:`${id}:hit`,type:'line',source:id,paint:{'line-width':18,'line-color':'rgba(0,0,0,0)'}});
        if(connection.symbol){
          const el=document.createElement('button');el.type='button';el.className='map-connection-symbol';el.setAttribute('aria-label',`Connection: ${connectionTitle(connection,pins)}`);el.title=connectionTitle(connection,pins);
          const markup=symbolMarkup(connection.symbol);if(markup)el.innerHTML=markup;else el.textContent=connection.symbol;
          el.onclick=event=>{event.preventDefault();event.stopPropagation();if(!action.current.mode&&!action.current.placementMode&&!movingPinId)callbacks.current.onConnection?.(connection);};
          const marker=new maplibregl.Marker({element:el}).setLngLat([(a.lng+b.lng)/2,(a.lat+b.lat)/2]).addTo(m);
          const place=()=>{const from=m.project([a.lng,a.lat]),to=m.project([b.lng,b.lat]);marker.setLngLat(m.unproject([(from.x+to.x)/2,(from.y+to.y)/2]));};place();arrowUpdates.push(place);markers.current.push(marker);
        }
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
            (m.getSource(id) as maplibregl.GeoJSONSource)?.setData({type:'Feature',properties:{connectionId:connection.id},geometry:{type:'LineString',coordinates:[[a.lng,a.lat],[end.lng,end.lat]]}});
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
      const wanted = new Set(connections.flatMap((x) => [`route-${x.id}`,`route-${x.id}:hit`]));
      for (const layer of m.getStyle().layers ?? []) {
        if (layer.id.startsWith("route-") && !wanted.has(layer.id)) {
          m.removeLayer(layer.id);

        }
      }
      for(const id of Object.keys(m.getStyle().sources??{}))if(id.startsWith('route-')&&!wanted.has(id))m.removeSource(id);
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
  }, [pins, connections, movingPinId, placementMode, readonly,activePinIds,contextMenuDisabled]);
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
  useEffect(()=>{
    const m=map.current,element=viewport.current;if(!m||!element)return;
    const panel=element.closest('.map-panel');
    const update=()=>{
      const location=liveLocationRef.current;
      const hidden=Boolean(panel?.getAttribute('aria-hidden')==='true'||element.closest('[hidden]'));
      if(hidden){liveMarker.current?.remove();liveMarker.current=null;setContextMenu(null);return;}
      if(!location){liveMarker.current?.remove();liveMarker.current=null;return;}
      if(!liveMarker.current){const dot=document.createElement('span');dot.className='map-live-location';dot.setAttribute('role','img');dot.setAttribute('aria-label','My live location');liveMarker.current=new maplibregl.Marker({element:dot}).setLngLat([location.lng,location.lat]).addTo(m);}
      else liveMarker.current.setLngLat([location.lng,location.lat]);
    };
    updateLiveMarker.current=update;update();const observer=new MutationObserver(update);if(panel)observer.observe(panel,{attributes:true,attributeFilter:['aria-hidden','hidden']});
    return()=>{updateLiveMarker.current=()=>{};observer.disconnect();liveMarker.current?.remove();liveMarker.current=null;};
  },[]);
  useEffect(()=>updateLiveMarker.current(),[liveLocation?.lng,liveLocation?.lat]);
  return (
    <div className={`map-wrapper${mode==='add'||placementMode?' placing-pin':''}`} onContextMenu={event=>{if(contextMenuDisabled){event.preventDefault();return;}if(placementMode||movingPinId||(event.target as HTMLElement).closest('button,.map-tools,.map-focus-tools,.map-live-location'))return;const m=map.current;if(!m)return;event.preventDefault();const rect=m.getCanvas().getBoundingClientRect(),point=m.unproject([event.clientX-rect.left,event.clientY-rect.top]);setContextMenu({x:event.clientX,y:event.clientY,lng:point.lng,lat:point.lat});}}>
      <div ref={viewport} className="map-viewport"><div ref={container} className="map-canvas" /></div>
      {!placementMode&&(!readonly||onConnections||onPlaces)&&<div className="map-tools">{!readonly&&<><button className={`icon${mode==='add'?' active':''}`} aria-label="Add pin on map" title="Add pin: click a place on the map" onClick={()=>{if(onStartPinSearch){onStartPinSearch();return;}setMode(mode==='add'?null:'add');setSource(null);}}><MapPinPlus size={19}/></button><button className={`icon${mode==='connect'?' active':''}`} aria-label="Connect pins on map" title="Connect: select two pins" disabled={pins.length<2} onClick={()=>{setMode(mode==='connect'?null:'connect');setSource(null);}}><Route size={19}/></button><label className="map-arrow-choice" title="Create directional arrows"><input type="checkbox" aria-label="Connect with arrow" checked={arrow} onChange={e=>onArrowPreferenceChange?.(e.target.checked)}/><span>Arrow</span></label></>}{onPlaces&&<button className="icon places-button" aria-label="Places" title="Places" onClick={()=>{setMode(null);setSource(null);onPlaces();}}><MapPinned size={19}/></button>}{onConnections&&<button className="icon connections-button" aria-label="Connections" title="Connections" onClick={()=>{setMode(null);setSource(null);onConnections();}}><Waypoints size={19}/></button>}</div>}
      {!placementMode&&(liveLocation||onLocate||lodging)&&<div className="map-focus-tools">{(liveLocation||onLocate)&&<button className="icon" aria-label="Focus my location" aria-busy={locationStatus==='pending'} disabled={locationStatus==='pending'} title={locationStatus==='pending'?'Finding your location…':locationStatus==='denied'?'Location permission is blocked in your browser. Allow location access and try again.':liveLocation?'Focus my location':'Find my location'} onClick={()=>liveLocation?focusPoint(liveLocation):onLocate?.()}>{locationStatus==='pending'?<LoadingSpinner/>:<LocateFixed size={19}/>}</button>}{lodging&&<button className="icon" aria-label="Focus lodging" title={lodging.name?`Focus ${lodging.name}`:'Focus lodging'} onClick={()=>focusPoint(lodging)}><House size={19}/></button>}</div>}
      {contextMenu&&createPortal(<MotionSurface><div ref={menuBox} className="map-context-menu" role="menu" aria-label={contextMenu.pin?`Actions for ${contextMenu.pin.title}`:'Map actions'} style={{left:contextMenu.x,top:contextMenu.y}}>
        {contextMenu.pin?<>{!readonly&&<button role="menuitem" onClick={()=>{onPin(contextMenu.pin!);setContextMenu(null);}}><Pencil size={16}/>Edit place</button>}{onCopyPin&&contextMenu.pin.id!=='trip-lodging'&&<button role="menuitem" onClick={()=>{onCopyPin(contextMenu.pin!);setContextMenu(null);}}><Copy size={16}/>Copy pin</button>}<button role="menuitem" onClick={()=>focusPoint(contextMenu.pin!)}><Focus size={16}/>Focus place</button></>:<>{!readonly&&<button role="menuitem" onClick={()=>{onAdd(contextMenu.lng,contextMenu.lat);setContextMenu(null);}}><MapPinPlus size={16}/>Add place here</button>}{!readonly&&(canPastePin||pendingPaste)&&onPastePin&&<button role="menuitem" disabled={pendingPaste} aria-busy={pendingPaste} onClick={()=>void pasteFromMenu()}>{pendingPaste?<LoadingSpinner/>:<ClipboardPaste size={16}/>}Paste pin</button>}{lodging&&<button role="menuitem" onClick={()=>focusPoint(lodging)}><House size={16}/>Focus lodging</button>}{(liveLocation||onLocate)&&<button role="menuitem" disabled={locationStatus==='pending'} onClick={()=>{if(liveLocation)focusPoint(liveLocation);else{onLocate?.();setContextMenu(null);}}}>{locationStatus==='pending'?<LoadingSpinner/>:<LocateFixed size={16}/>} {locationStatus==='pending'?'Finding your location…':locationStatus==='denied'?'Location permission blocked — try again':'Focus my location'}</button>}<button role="menuitem" onClick={()=>{map.current?.resetNorth();setContextMenu(null);}}><Compass size={16}/>Reset north</button></>}
      </div></MotionSurface>,document.body)}
      {(mode||movingPinId)&&<div className="map-mode-note" role="status"><strong>{movingPinId?'Drag the selected pin to its new location':mode==='add'?'Click the map to add a pin':source?'Select the destination pin':'Select the starting pin'}</strong><button className="icon" aria-label="Cancel map action" onClick={()=>{setMode(null);setSource(null);onCancelMove?.();}}><X size={15}/></button></div>}
    </div>
  );
}
