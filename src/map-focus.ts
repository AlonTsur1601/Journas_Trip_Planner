import type {Map as MapLibreMap} from 'maplibre-gl';

// Symmetric speed: brisk at both ends, slower at the midpoint, no long tail.
export const focusEasing=(t:number)=>t+.2*Math.sin(2*Math.PI*t)/(2*Math.PI);
// 1.2 / 1800 matches the previous 0.8 / 1200 initial speed.
export const focusDuration=1800;
export type Camera={center:[number,number];zoom:number};
export type FocusPoint={lng:number;lat:number};

/** The same van Wijk flight used by MapLibre, sampled without moving the live map. */
export function focusRoute(origin:Camera,point:FocusPoint,span:number,count=48):Camera[]{
 const targetZoom=Math.max(origin.zoom,15),world=512*2**origin.zoom;
 const project=([lng,lat]:[number,number])=>[lng/360+.5,(1-Math.log(Math.tan(Math.PI/4+Math.max(-85.051129,Math.min(85.051129,lat))*Math.PI/360))/Math.PI)/2];
 const start=project(origin.center),end=project([point.lng,point.lat]);
 end[0]+=Math.round(start[0]-end[0]);
 const dx=end[0]-start[0],dy=end[1]-start[1],distance=Math.hypot(dx,dy)*world;
 const w0=span,w1=w0/2**(targetZoom-origin.zoom),rho=1.42,rho2=rho*rho;
 const factor=(last:boolean)=>{const b=(w1*w1-w0*w0+(last?-1:1)*rho2*rho2*distance*distance)/(2*(last?w1:w0)*rho2*distance);return -Math.asinh(b);};
 const r0=factor(false),length=(factor(true)-r0)/rho;
 return Array.from({length:count+1},(_,i)=>{
  const t=i/count;
  if(i===0)return origin;
  if(i===count)return{center:[point.lng,point.lat],zoom:targetZoom};
  if(distance<.000002||!Number.isFinite(length))return{center:origin.center,zoom:origin.zoom+(targetZoom-origin.zoom)*t};
  const s=t*length,scale=Math.cosh(r0)/Math.cosh(r0+rho*s);
  const along=w0*(Math.cosh(r0)*Math.tanh(r0+rho*s)-Math.sinh(r0))/rho2/distance;
  const x=start[0]+dx*along,y=start[1]+dy*along;
  return{center:[(x-.5)*360,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI],zoom:origin.zoom+Math.log2(1/scale)};
 });
}

/** Start synchronously; background tile preparation never gates the camera clock. */
export function focusLoadedMap(map:Pick<MapLibreMap,'getCenter'|'getZoom'|'on'|'off'|'flyTo'|'stop'>,point:FocusPoint,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  const clean=()=>{clearTimeout(timeout);map.off('moveend',ended);signal.removeEventListener('abort',cancel);};
  const ended=()=>{clean();resolve();};
  const cancel=()=>{clean();if(signal.reason!=='dispose')map.stop();reject(new DOMException('Focus cancelled','AbortError'));};
  const timeout=setTimeout(()=>{clean();map.stop();resolve();},focusDuration+500);
  if(signal.aborted){cancel();return;}
  const center=map.getCenter();
  if(Math.abs(center.lng-point.lng)<1e-8&&Math.abs(center.lat-point.lat)<1e-8&&map.getZoom()>=15){ended();return;}
  map.on('moveend',ended);signal.addEventListener('abort',cancel,{once:true});
  map.flyTo({center:[point.lng,point.lat],zoom:Math.max(map.getZoom(),15),duration:focusDuration,easing:focusEasing,essential:true});
 });
}
