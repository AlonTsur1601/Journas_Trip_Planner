import type {Map as MapLibreMap,FlyToOptions} from 'maplibre-gl';

export const focusEasing=(t:number)=>.8*t+.2*t*t*(3-2*t);
const aborted=()=>new DOMException('Focus cancelled','AbortError');

export const focusDuration=1200;
export const focusPreloadSteps={near:72,far:72};

/** Visit native camera samples only when their tiles and captured image are complete. */
export function loadedFlight(map:Pick<MapLibreMap,'on'|'off'|'flyTo'|'stop'|'areTilesLoaded'>,target:FlyToOptions,signal:AbortSignal,preparing:boolean,preparationSteps=focusPreloadSteps.near,capture?:()=>Promise<void>){
 return new Promise<void>((resolve,reject)=>{
  let progress=0,step=0,rendered=false,finished=false,capturing=false,lastCaptured=-1;
  const clean=()=>{clearTimeout(timeout);map.off('render',render);map.off('moveend',ended);map.off('error',error);signal.removeEventListener('abort',cancel);};
  const finish=(failure?:Error)=>{if(finished)return;finished=true;clean();if(failure||preparing)map.stop();failure?reject(failure):resolve();};
  const cancel=()=>finish(aborted());
  const error=()=>finish(new Error('The map could not finish loading. Please try focusing again.'));
  const ended=()=>{if(!preparing)finish();};
  const render=()=>{
   if(capturing||finished)return;
   rendered=map.areTilesLoaded();
   if(preparing&&rendered&&capture&&lastCaptured!==progress){
    lastCaptured=progress;capturing=true;rendered=false;
    void capture().then(()=>{capturing=false;rendered=true;if(progress>=1)finish();},error=>finish(error));
   }else if(preparing&&progress>=1&&rendered)finish();
  };
  const timeout=setTimeout(()=>finish(new Error('The map is taking too long to load. Please try focusing again.')),preparing?45000:4000);
  map.on('render',render);map.on('moveend',ended);map.on('error',error);signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted){cancel();return;}
  // Visiting each sub-frame of the exact native route warms tiles, glyphs and
  // GPU buffers before playback, without pausing the visible animation.
  const easing=preparing?()=>{
   if(rendered&&map.areTilesLoaded()){step=Math.min(preparationSteps,step+1);progress=step/preparationSteps;}
   rendered=false;
   return focusEasing(progress);
  }:focusEasing;
  map.flyTo({...target,duration:preparing?60000:focusDuration,maxDuration:undefined,easing});
 });
}
function waitForMap(map:MapLibreMap,signal:AbortSignal,settled=false){
 return new Promise<void>((resolve,reject)=>{
  const event=settled?'idle':'render';
  const clean=()=>{clearTimeout(timeout);map.off(event,check);map.off('error',error);signal.removeEventListener('abort',cancel);};
  const check=()=>{if(map.isStyleLoaded()&&map.areTilesLoaded()){clean();resolve();}};
  const cancel=()=>{clean();reject(aborted());};
  const error=()=>{clean();reject(new Error('The map could not finish loading. Please try focusing again.'));};
  const timeout=setTimeout(()=>{clean();reject(new Error('The map is taking too long to load. Please try focusing again.'));},12000);
  map.on(event,check);map.on('error',error);signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();else map.triggerRepaint();
 });
}

type Camera={center:[number,number];zoom:number};
type FocusFrame={image:ImageBitmap;camera:Camera;markers:Array<[HTMLElement,string]>};

/** Playback does no WebGL rendering or network work; map pixels and markers use the same frame. */
export function playFocusFrames(count:number,draw:(index:number)=>void,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  let request=0,start:number|undefined,last=-1;
  const clean=()=>{cancelAnimationFrame(request);signal.removeEventListener('abort',cancel);};
  const cancel=()=>{clean();reject(aborted());};
  const tick=()=>{
   const now=performance.now();
   if(start===undefined)start=now;
   const progress=Math.min(1,(now-start)/focusDuration),index=Math.min(count-1,Math.round(progress*(count-1)));
   if(index!==last){try{draw(index);last=index;}catch(error){clean();reject(error);return;}}
   if(progress>=1){clean();resolve();}else request=requestAnimationFrame(tick);
  };
  signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();else request=requestAnimationFrame(tick);
 });
}

/** Render every animation frame before revealing motion. Release frame memory on completion/cancel. */
export async function focusLoadedMap(map:MapLibreMap,surface:HTMLElement,viewport:HTMLElement,point:{lng:number;lat:number},signal:AbortSignal,onPrepared:()=>void){
 const camera=():Camera=>{const c=map.getCenter();return{center:[c.lng,c.lat],zoom:map.getZoom()};};
 const origin=camera(),target={center:[point.lng,point.lat] as [number,number],zoom:Math.max(origin.zoom,15),essential:true};
 if(Math.abs(origin.center[0]-point.lng)<1e-8&&Math.abs(origin.center[1]-point.lat)<1e-8&&origin.zoom===target.zoom){onPrepared();return;}
 let warming=true,disposed=false,cover:HTMLElement|null=null,shown=origin;
 const frames:FocusFrame[]=[];
 const cancel=()=>{
  if(signal.reason!=='dispose')map.stop();
  if(signal.reason!=='navigation'&&signal.reason!=='dispose')map.jumpTo(warming?origin:shown);
  cover?.remove();
 };
 signal.addEventListener('abort',cancel,{once:true});
 try{
  await waitForMap(map,signal);
  signal.throwIfAborted();
  cover=surface.cloneNode(true) as HTMLElement;
  cover.classList.add('map-focus-cover');cover.setAttribute('aria-hidden','true');cover.inert=true;
  const canvas=map.getCanvas(),display=cover.querySelector('canvas')!;
  display.width=canvas.width;display.height=canvas.height;
  const output=display.getContext('2d')!;output.drawImage(canvas,0,0);
  const markerCopies=new Map<HTMLElement,HTMLElement>();
  const originals=surface.querySelectorAll<HTMLElement>('.maplibregl-marker'),copies=cover.querySelectorAll<HTMLElement>('.maplibregl-marker');
  originals.forEach((marker,index)=>markerCopies.set(marker,copies[index]));
  const view=viewport.getBoundingClientRect(),source=canvas.getBoundingClientRect(),ratio=canvas.width/source.width;
  // Bound peak snapshot memory (~150MB maximum, substantially less on mobile).
  const scale=Math.min(devicePixelRatio,1.5,Math.sqrt(524288/(view.width*view.height)));
  const staging=document.createElement('canvas');staging.width=Math.max(1,Math.round(view.width*scale));staging.height=Math.max(1,Math.round(view.height*scale));
  const context=staging.getContext('2d')!;
  const capture=async()=>{
   context.drawImage(canvas,(view.left-source.left)*ratio,(view.top-source.top)*ratio,view.width*ratio,view.height*ratio,0,0,staging.width,staging.height);
   const state=camera(),markers:Array<[HTMLElement,string]>=[];
   surface.querySelectorAll<HTMLElement>('.maplibregl-marker').forEach(marker=>{
    let copy=markerCopies.get(marker);
    if(!copy){copy=marker.cloneNode(true) as HTMLElement;copy.style.visibility='hidden';cover!.querySelector('.maplibregl-canvas-container')!.append(copy);markerCopies.set(marker,copy);}
    markers.push([copy,marker.style.cssText]);
   });
   const image=await createImageBitmap(staging);
   if(disposed||signal.aborted){image.close();throw aborted();}
   frames.push({image,camera:state,markers});
  };
  viewport.append(cover);surface.dataset.focusPhase='preparing';
  await loadedFlight(map,target,signal,true,focusPreloadSteps.near,capture);
  await waitForMap(map,signal,true);signal.throwIfAborted();
  frames.pop()?.image.close();await capture();
  // The live map is now at the final camera, hidden beneath a lightweight 2D replay.
  display.width=staging.width;display.height=staging.height;
  Object.assign(display.style,{position:'absolute',left:`${view.left-source.left}px`,top:`${view.top-source.top}px`,width:`${view.width}px`,height:`${view.height}px`});
  const draw=(index:number)=>{
   const frame=frames[index];output.drawImage(frame.image,0,0);shown=frame.camera;
   markerCopies.forEach(copy=>copy.style.visibility='hidden');
   frame.markers.forEach(([copy,style])=>copy.style.cssText=style);
   cover!.dataset.focusFrame=String(index);
  };
  // Upload replay textures while the initial view is still held. The readback
  // drains this queue before the visible animation, rather than on its first frame.
  frames.forEach(frame=>output.drawImage(frame.image,0,0));
  output.getImageData(0,0,1,1);
  draw(0);signal.throwIfAborted();warming=false;surface.dataset.focusPhase='moving';onPrepared();
  await playFocusFrames(frames.length,draw,signal);
 }catch(error){
  if(!signal.aborted){map.stop();map.jumpTo(origin);await waitForMap(map,signal).catch(()=>{});}
  throw error;
 }finally{
  disposed=true;
  signal.removeEventListener('abort',cancel);cover?.remove();frames.forEach(frame=>frame.image.close());delete surface.dataset.focusPhase;
 }
}
