import type {Map as MapLibreMap,FlyToOptions} from 'maplibre-gl';

export const focusEasing=(t:number)=>.8*t+.2*t*t*(3-2*t);
const aborted=()=>new DOMException('Focus cancelled','AbortError');

/** Advance along MapLibre's own flight path only after the current view renders. */
export function loadedFlight(map:Pick<MapLibreMap,'on'|'off'|'flyTo'|'stop'|'areTilesLoaded'>,target:FlyToOptions,signal:AbortSignal,preparing:boolean,onFrame?:(loaded:boolean)=>void,preparationSteps=24){
 return new Promise<void>((resolve,reject)=>{
  let progress=0,last=performance.now(),rendered=false,finished=false;
  const clean=()=>{clearTimeout(timeout);map.off('render',render);map.off('error',error);signal.removeEventListener('abort',cancel);};
  const finish=(failure?:Error)=>{if(finished)return;finished=true;clean();map.stop();failure?reject(failure):resolve();};
  const cancel=()=>finish(aborted());
  const error=()=>finish(new Error('The map could not finish loading. Please try focusing again.'));
  const render=()=>{const loaded=map.areTilesLoaded();rendered=loaded;onFrame?.(loaded);if(progress>=1&&loaded)finish();};
  const timeout=setTimeout(()=>finish(new Error('The map is taking too long to load. Please try focusing again.')),preparing?12000:3000);
  map.on('render',render);map.on('error',error);signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted){cancel();return;}
  // The public easing hook lets readiness control progress without touching
  // MapLibre internals. The long driver is stopped as soon as progress reaches 1.
  map.flyTo({...target,duration:60000,maxDuration:undefined,easing:()=>{
   const now=performance.now(),delta=now-last;last=now;
   if(rendered&&map.areTilesLoaded())progress=Math.min(1,progress+(preparing?1/preparationSteps:Math.min(delta,50)/1200));
   rendered=false;
   return focusEasing(progress);
  }});
 });
}

function waitForMap(map:MapLibreMap,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  const clean=()=>{clearTimeout(timeout);map.off('render',check);map.off('error',error);signal.removeEventListener('abort',cancel);};
  const check=()=>{if(map.isStyleLoaded()&&map.areTilesLoaded()){clean();resolve();}};
  const cancel=()=>{clean();reject(aborted());};
  const error=()=>{clean();reject(new Error('The map could not finish loading. Please try focusing again.'));};
  const timeout=setTimeout(()=>{clean();reject(new Error('The map is taking too long to load. Please try focusing again.'));},12000);
  map.on('render',check);map.on('error',error);signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();else map.triggerRepaint();
 });
}

/** Warm the exact route in the same renderer/cache before exposing any motion. */
export async function focusLoadedMap(map:MapLibreMap,surface:HTMLElement,viewport:HTMLElement,point:{lng:number;lat:number},signal:AbortSignal,onPrepared:()=>void){
 const center=map.getCenter(),origin={center:[center.lng,center.lat] as [number,number],zoom:map.getZoom()};
 const target={center:[point.lng,point.lat] as [number,number],zoom:Math.max(origin.zoom,15),essential:true};
 if(Math.abs(center.lng-point.lng)<1e-8&&Math.abs(center.lat-point.lat)<1e-8&&origin.zoom===target.zoom){onPrepared();return;}
 const from=map.project(origin.center),to=map.project(target.center);
 const longRoute=Math.abs(target.zoom-origin.zoom)>3||from.dist(to)>Math.max(map.getCanvas().clientWidth,map.getCanvas().clientHeight);
 let warming=true,cover:HTMLElement|null=null;
 const buffer=document.createElement('canvas');buffer.className='map-focus-buffer';buffer.setAttribute('aria-hidden','true');
 const canvas=map.getCanvas();buffer.width=canvas.width;buffer.height=canvas.height;
 const context=buffer.getContext('2d')!;
 const cancel=()=>{
  if(signal.reason!=='dispose')map.stop();
  if(warming&&signal.reason!=='navigation'&&signal.reason!=='dispose')map.jumpTo(origin);
  cover?.remove();buffer.remove();
 };
 signal.addEventListener('abort',cancel,{once:true});
 try{
  await waitForMap(map,signal);
  signal.throwIfAborted();
  cover=surface.cloneNode(true) as HTMLElement;
  cover.classList.add('map-focus-cover');cover.setAttribute('aria-hidden','true');cover.inert=true;
  const originals=surface.querySelectorAll('canvas'),copies=cover.querySelectorAll('canvas');
  copies.forEach((copy,index)=>{copy.width=originals[index].width;copy.height=originals[index].height;copy.getContext('2d')!.drawImage(originals[index],0,0);});
  viewport.append(cover);
  surface.dataset.focusPhase='preparing';
  await loadedFlight(map,target,signal,true,undefined,longRoute?48:24);
  signal.throwIfAborted();
  map.jumpTo(origin);await waitForMap(map,signal);
  signal.throwIfAborted();
  context.drawImage(canvas,0,0);buffer.hidden=true;canvas.after(buffer);
  cover.remove();cover=null;warming=false;onPrepared();
  surface.dataset.focusPhase='moving';
  await loadedFlight(map,target,signal,false,loaded=>{
   // Unexpected cache misses never expose an unfinished WebGL frame. Progress
   // pauses while the last fully rendered frame stays beneath the live markers.
   if(loaded){context.drawImage(canvas,0,0);buffer.hidden=true;}
   else buffer.hidden=false;
  });
 }catch(error){
  if(!signal.aborted){map.stop();map.jumpTo(origin);await waitForMap(map,signal).catch(()=>{});}
  throw error;
 }finally{
  signal.removeEventListener('abort',cancel);cover?.remove();buffer.remove();delete surface.dataset.focusPhase;
 }
}
