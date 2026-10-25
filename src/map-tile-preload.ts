import {Map as MapLibreMap,type OverscaledTileID} from 'maplibre-gl';
import {focusRoute,type FocusPoint} from './map-focus';

type Manager=MapLibreMap['style']['tileManagers'][string];
type Tile=ReturnType<Manager['_addTile']>;
type Job={manager:Manager;id:OverscaledTileID;priority:number};
type Pending={tile:Tile;claimed:boolean;manager:Manager};

/**
 * MapLibre has no public decoded-tile prefetch API. Keep this small adapter to
 * its 6.x tile manager here: warm the LIVE renderer's worker/GPU/cache, and let
 * its normal _addTile adopt an in-flight tile if the user gets there first.
 * No prepared tile is added to the visible tile list before it is requested.
 */
export class FocusTileCache{
 private jobs:Job[]=[];
 private pending=new Map<string,Pending>();
 private copies=new Map<string,number>();
 private originals=new Map<Manager,Manager['_addTile']>();
 private active=0;
 private disposed=false;
 private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private map:MapLibreMap,private changed?:(pending:number,queued:number)=>void){}
 private key(manager:Manager,id:OverscaledTileID){return `${manager.id}:${id.key}`;}
 private canonicalKey(manager:Manager,id:OverscaledTileID){return `${manager.id}:${id.wrapped().key}`;}
 private notify(){this.changed?.(this.active,this.jobs.length);}
 private hook(manager:Manager){
  if(this.originals.has(manager))return;
  const original=manager._addTile,owner=this;
  this.originals.set(manager,original);
  manager._addTile=function(id){
   const live=this._inViewTiles.getTileById(id.key);
   if(live)return live;
   if(this._outOfViewCache.has(id))return original.call(this,id);
   const entry=owner.pending.get(owner.key(this,id))??[...owner.pending.values()].find(value=>value.manager===this&&!value.claimed&&value.tile.tileID.wrapped().key===id.wrapped().key);
   if(!entry||entry.claimed||entry.tile.aborted)return original.call(this,id);
   entry.claimed=true;entry.tile.tileID=id;entry.tile.uses++;
   this._inViewTiles.setTile(id.key,entry.tile);
   return entry.tile;
  };
 }
 enqueue(jobs:Job[]){
  if(this.disposed)return;
  const unique=new Map<string,Job>();
  for(const job of jobs){
   this.hook(job.manager);
   const key=this.key(job.manager,job.id),previous=unique.get(key);
   if(!previous||previous.priority>job.priority)unique.set(key,job);
  }
  this.copies.clear();
  for(const {manager,id} of unique.values()){
   const key=this.canonicalKey(manager,id);this.copies.set(key,(this.copies.get(key)??0)+1);
  }
  this.jobs=[...unique.values()].sort((a,b)=>a.priority-b.priority);
  this.pump();
 }
 prioritize(jobs:Job[]){this.enqueue([...jobs.map(job=>({...job,priority:-100})),...this.jobs]);}
 private pump=()=>{
  clearTimeout(this.timer);
  if(this.disposed)return;
  // During motion, fetch only missing destination data requested by the click.
  while(this.active<(this.jobs[0]?.priority===-100?8:4)&&this.jobs.length){
   if(this.map.isMoving()&&this.jobs[0].priority>-100){this.timer=setTimeout(this.pump,80);break;}
   const job=this.jobs.shift()!,{manager,id}=job,key=this.key(manager,id);
   const canonical=id.wrapped().key;
   const cached=manager._outOfViewCache.data?.[canonical]?.length??(manager._outOfViewCache.has(id)?1:0);
   const visible=manager._inViewTiles.getAllTiles().filter(tile=>tile.tileID.wrapped().key===canonical).length;
   const loading=[...this.pending.values()].filter(entry=>entry.manager===manager&&!entry.claimed&&entry.tile.tileID.wrapped().key===canonical).length;
   if(this.pending.has(key)||cached+visible+loading>=(this.copies.get(this.canonicalKey(manager,id))??1))continue;
   const template=manager._inViewTiles.getAllTiles()[0]??Object.values(this.map.style.tileManagers).flatMap(source=>source._inViewTiles.getAllTiles())[0];
   if(!template)continue;
   const TileConstructor=template.constructor as new(id:OverscaledTileID,size:number)=>Tile;
   const tile=new TileConstructor(id,manager.getSource().tileSize*id.overscaleFactor());
   const entry:Pending={tile,manager,claimed:false};this.pending.set(key,entry);++this.active;
   void this.load(entry,id).finally(()=>{this.pending.delete(key);--this.active;this.notify();this.pump();});
  }
  this.notify();
 };
 private async load(entry:Pending,id:OverscaledTileID){
  const {manager,tile}=entry;
  try{
   const result=await manager.getSource().loadTile(tile);
   if(tile.aborted)return;
   if(entry.claimed){manager._tileLoaded(tile,tile.tileID.key,'loading',false,result as Parameters<Manager['_tileLoaded']>[4]);return;}
   if(this.disposed)return;
   manager._tileLoaded(tile,id.key,'loading',false,result as Parameters<Manager['_tileLoaded']>[4]);
   // Symbol buffers are sized by the first placement pass. Uploading them
   // before placement allocates empty buffers and breaks later text drawing.
   // Warm geometry and atlases now; let the renderer upload placed symbols.
   if(!this.map.isMoving()){
    const buckets=tile.buckets;
    tile.buckets=Object.fromEntries(Object.entries(buckets??{}).filter(([,bucket])=>!('symbolInstances' in bucket)));
    try{tile.upload(this.map.painter.context);tile.prepare(this.map.style.imageManager);}
    finally{tile.buckets=buckets;}
   }
   if(!manager._inViewTiles.getTileById(id.key))manager._outOfViewCache.add(id,tile,tile.getExpiryTimeout());
   else manager._unloadTile(tile);
  }catch{
   if(tile.aborted||this.disposed)return;
   if(entry.claimed){tile.state='errored';this.map.triggerRepaint();}
   else manager._unloadTile(tile);
  }
 }
 dispose(){
  this.disposed=true;clearTimeout(this.timer);this.jobs=[];
  for(const [manager,original] of this.originals)manager._addTile=original;
  for(const {tile,manager,claimed} of this.pending.values())if(!claimed){tile.aborted=true;manager._abortTile(tile);manager._unloadTile(tile);}
  this.originals.clear();
 }
}

/** Continuously prepare all known destinations and their flight corridors. */
export function preloadFocusTiles(map:MapLibreMap,surface:HTMLElement,targets:FocusPoint[]){
 const host=document.createElement('div');host.className='focus-tile-probe';host.setAttribute('aria-hidden','true');host.inert=true;document.body.append(host);
 const probe=new MapLibreMap({container:host,style:{version:8,sources:{},layers:[]},interactive:false,attributionControl:false,trackResize:false,transformConstrain:map._camera.transform.constrainOverride});
 const cache=new FocusTileCache(map,(pending,queued)=>{surface.dataset.focusPendingTiles=String(pending);surface.dataset.focusQueuedTiles=String(queued);});
 let timer:ReturnType<typeof setTimeout>|undefined,request=0,disposed=false,version=0,planned='';
 function makeJobs(camera:{center:[number,number];zoom:number},priority:number,managers:Manager[],margin=1){
  const result:Job[]=[];
  probe.jumpTo({...camera,bearing:map.getBearing(),pitch:map.getPitch(),roll:map.getRoll(),padding:map.getPadding()});
    for(const manager of managers){
     const source=manager.getSource();
     const options={tileSize:source.tileSize,minzoom:source.minzoom,maxzoom:source.type==='vector'?Math.max(source.maxzoom,map.getMaxZoom()-4):source.maxzoom,roundZoom:source.roundZoom,reparseOverscaled:source.reparseOverscaled};
     for(const id of probe.coveringTiles(options)){
      // A one-tile margin covers every intermediate camera between samples,
      // including the different rounding used by raster and vector sources.
      const TileID=id.constructor as new(z:number,wrap:number,canonicalZ:number,x:number,y:number)=>OverscaledTileID;
      const n=2**id.canonical.z;
      for(let dx=-margin;dx<=margin;dx++)for(let dy=-margin;dy<=margin;dy++){
       const x=id.canonical.x+dx,y=id.canonical.y+dy;if(y<0||y>=n)continue;
       const neighbor=new TileID(id.overscaledZ,id.wrap+Math.floor(x/n),id.canonical.z,(x%n+n)%n,y);
       if(!source.hasTile||source.hasTile(neighbor))result.push({manager,id:neighbor,priority});
      }
     }
    }
  return result;
 }
 function resizeProbe(){host.style.width=`${surface.clientWidth}px`;host.style.height=`${surface.clientHeight}px`;probe.resize();}
 const managers=()=>Object.values(map.style.tileManagers).filter(manager=>manager._sourceLoaded&&['vector','raster','geojson'].includes(manager.getSource().type));
 function schedule(){clearTimeout(timer);timer=setTimeout(plan,120);}
 function plan(){
  if(disposed||map.isMoving()||!map.getStyle()?.layers?.length)return;
  const key=JSON.stringify([map.getCenter(),map.getZoom(),map.getBearing(),map.getPitch(),map.getRoll(),surface.clientWidth,surface.clientHeight,Object.entries(map.style.tileManagers).map(([id,manager])=>[id,manager._sourceLoaded])]);
  if(planned===key)return;planned=key;
  cancelAnimationFrame(request);const generation=++version;
  resizeProbe();
  const c=map.getCenter(),origin={center:[c.lng,c.lat] as [number,number],zoom:map.getZoom()};
  const sources=managers();
  const unique=[...new Map(targets.map(point=>[`${point.lng},${point.lat}`,point])).values()];
  const jobs:Job[]=[];
  // Global low-zoom coverage is tiny and also covers constrained flight arcs
  // and world copies that can fall between two sampled camera positions.
  for(const manager of sources){
   const template=manager._inViewTiles.getAllTiles()[0]?.tileID??Object.values(map.style.tileManagers).flatMap(source=>source._inViewTiles.getAllTiles())[0]?.tileID;
   if(!template)continue;
   const TileID=template.constructor as new(z:number,wrap:number,canonicalZ:number,x:number,y:number)=>OverscaledTileID;
   for(let z=0;z<=Math.min(2,manager.getSource().maxzoom);z++)for(let x=0;x<2**z;x++)for(let y=0;y<2**z;y++)jobs.push({manager,id:new TileID(z,0,z,x,y),priority:-3});
  }
  function* samples(){
   for(const point of unique){
    const route=focusRoute(origin,point,Math.max(surface.clientWidth,surface.clientHeight));
    yield{camera:route[route.length-1],priority:-2};
    // Destination ancestors provide immediate coverage even before fine tiles.
    for(let zoom=0;zoom<15;zoom+=2)yield{camera:{center:[point.lng,point.lat] as [number,number],zoom},priority:-1};
    for(const camera of route)yield{camera,priority:Math.floor(camera.zoom)+4};
   }
  }
  const iterator=samples();
  const chunk=()=>{
   if(disposed||generation!==version)return;
   const started=performance.now();
   while(performance.now()-started<5){
    const next=iterator.next();
    if(next.done){cache.enqueue(jobs);return;}
    const {camera,priority}=next.value;
    jobs.push(...makeJobs(camera,priority,sources));
   }
   request=requestAnimationFrame(chunk);
  };
  chunk();
 }
 const interrupt=()=>{++version;cancelAnimationFrame(request);clearTimeout(timer);};
 map.on('load',schedule);map.on('sourcedata',schedule);map.on('idle',schedule);map.on('moveend',schedule);map.on('movestart',interrupt);
 const observer=new ResizeObserver(schedule);observer.observe(surface);schedule();
 const dispose=()=>{disposed=true;interrupt();observer.disconnect();cache.dispose();map.off('load',schedule);map.off('sourcedata',schedule);map.off('idle',schedule);map.off('moveend',schedule);map.off('movestart',interrupt);probe.remove();host.remove();delete surface.dataset.focusPendingTiles;delete surface.dataset.focusQueuedTiles;};
 return{dispose,prioritize:(point:FocusPoint)=>{
  requestAnimationFrame(()=>{
   if(disposed)return;resizeProbe();
   cache.prioritize(makeJobs({center:[point.lng,point.lat],zoom:Math.max(map.getZoom(),15)},-100,managers(),0));
  });
 }};
}
