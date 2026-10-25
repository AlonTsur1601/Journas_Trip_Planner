import {afterEach,expect,it,vi} from 'vitest';
import {FocusTileCache} from '../src/map-tile-preload';
const id=(key:string,canonical=key)=>({key,wrapped(){return id(canonical);},overscaleFactor:()=>1}) as any;
function fixture(){
 const completions:Array<()=>void>=[];
 const load=vi.fn((_tile:any)=>new Promise<any>(resolve=>completions.push(()=>resolve(undefined))));
 class Tile{
  uses=0;aborted=false;state='loading';buckets={};upload=vi.fn();prepare=vi.fn();getExpiryTimeout=()=>undefined;
  constructor(public tileID:any,public size:number){}
 }
 const visible=new Map<string,any>([['origin',new Tile(id('origin'),512)]]),cached=new Map<string,any>(),data:Record<string,any[]>={};
 const source={tileSize:512,loadTile:load};
 const manager={id:'base',getSource:()=>source,_addTile:vi.fn(),_tileLoaded:vi.fn(),_unloadTile:vi.fn(),_abortTile:vi.fn(),
  _inViewTiles:{getTileById:(key:string)=>visible.get(key),getAllTiles:()=>[...visible.values()],setTile:(key:string,tile:any)=>visible.set(key,tile)},
  _outOfViewCache:{data,has:(tileID:any)=>cached.has(tileID.wrapped().key),add:(tileID:any,tile:any)=>{const key=tileID.wrapped().key;(data[key]??=[]).push(tile);cached.set(key,tile);}}};
 const map={isMoving:()=>false,painter:{context:{}},style:{imageManager:{}},triggerRepaint:vi.fn()};
 const cache=new FocusTileCache(map as any);
 return{cache,manager,map,load,visible,cached,finish:()=>completions.splice(0).forEach(finish=>finish())};
}
afterEach(()=>vi.useRealTimers());
it('loads and uploads into the live cache before any click without moving visible tiles',async()=>{
 const f=fixture();f.cache.enqueue([{manager:f.manager as any,id:id('destination'),priority:0}]);
 expect(f.load).toHaveBeenCalledTimes(1);expect(f.visible.size).toBe(1);
 f.finish();await vi.waitFor(()=>expect(f.cached.size).toBe(1));
 expect(f.cached.get('destination').upload).toHaveBeenCalledTimes(1);
 expect(f.visible.has('destination')).toBe(false);f.cache.dispose();
});
it('adopts a pending preload immediately instead of waiting or downloading twice',async()=>{
 const f=fixture();f.cache.enqueue([{manager:f.manager as any,id:id('destination'),priority:0}]);
 const tile=f.manager._addTile(id('destination'));
 expect(tile).toBe(f.load.mock.calls[0][0]);expect(f.visible.get('destination')).toBe(tile);
 f.finish();await vi.waitFor(()=>expect(f.manager._tileLoaded).toHaveBeenCalledTimes(1));
 expect(f.load).toHaveBeenCalledTimes(1);expect(f.cached.size).toBe(0);f.cache.dispose();
});
it('deduplicates routes and skips already cached or visible tiles',async()=>{
 const f=fixture(),job={manager:f.manager as any,id:id('destination'),priority:0};
 f.cache.enqueue([job,job,{...job,id:id('origin')}]);expect(f.load).toHaveBeenCalledTimes(1);
 f.finish();await vi.waitFor(()=>expect(f.cached.size).toBe(1));
 f.cache.enqueue([job]);expect(f.load).toHaveBeenCalledTimes(1);f.cache.dispose();
});
it('leaves foreground rendering priority and resumes background work afterward',async()=>{
 vi.useFakeTimers();const f=fixture();let moving=true;f.map.isMoving=()=>moving;
 f.cache.enqueue([{manager:f.manager as any,id:id('destination'),priority:0}]);expect(f.load).not.toHaveBeenCalled();
 moving=false;vi.advanceTimersByTime(81);expect(f.load).toHaveBeenCalledTimes(1);
 f.cache.dispose();f.finish();await Promise.resolve();
});
it('restores the library method and aborts only unclaimed work on teardown',async()=>{
 const f=fixture(),original=f.manager._addTile;
 f.cache.enqueue([{manager:f.manager as any,id:id('destination'),priority:0}]);f.cache.dispose();
 expect(f.manager._addTile).toBe(original);expect(f.manager._abortTile).toHaveBeenCalledTimes(1);
 f.finish();await Promise.resolve();expect(f.cached.size).toBe(0);
});
it('finishes adopted live tiles even when a location update replaces the preloader',async()=>{
 const f=fixture();f.cache.enqueue([{manager:f.manager as any,id:id('destination'),priority:0}]);
 f.manager._addTile(id('destination'));f.cache.dispose();
 expect(f.manager._abortTile).not.toHaveBeenCalled();f.finish();
 await vi.waitFor(()=>expect(f.manager._tileLoaded).toHaveBeenCalledTimes(1));
});
it('prepares separate instances when two world copies need the same canonical tile',async()=>{
 const f=fixture();f.cache.enqueue(['east','west'].map(wrap=>({manager:f.manager as any,id:id(wrap,'destination'),priority:0})));
 expect(f.load).toHaveBeenCalledTimes(2);f.finish();
 await vi.waitFor(()=>expect(f.manager._outOfViewCache.data.destination.length).toBe(2));f.cache.dispose();
});
it('defers symbol buffer allocation until placement while warming other geometry',async()=>{
 const f=fixture();f.cache.enqueue([{manager:f.manager as any,id:id('destination'),priority:0}]);
 const tile=f.load.mock.calls[0][0],buckets={labels:{symbolInstances:[]},roads:{}};
 tile.buckets=buckets;tile.upload.mockImplementation(()=>expect(tile.buckets).toEqual({roads:{}}));
 f.finish();await vi.waitFor(()=>expect(f.cached.size).toBe(1));expect(tile.buckets).toBe(buckets);f.cache.dispose();
});
it('fetches missing destination data during motion without blocking on GPU uploads',async()=>{
 const f=fixture();f.map.isMoving=()=>true;
 f.cache.prioritize([{manager:f.manager as any,id:id('destination'),priority:0}]);
 expect(f.load).toHaveBeenCalledTimes(1);const tile=f.load.mock.calls[0][0];
 f.finish();await vi.waitFor(()=>expect(f.cached.size).toBe(1));
 expect(tile.upload).not.toHaveBeenCalled();f.cache.dispose();
});
