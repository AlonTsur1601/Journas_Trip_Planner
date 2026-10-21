export type Rect={x:number;y:number;width:number;height:number};
export const overlaps=(a:Rect,b:Rect,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
/** Prefer free space around the target, preserving a real gap without moving the site. */
export function tourCardPosition(target:Rect|null,width:number,height:number,vw:number,vh:number,obstacles:Rect[]=[],minWidth=180){
 const margin=12,gap=20;
 const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(Math.max(min,max),n));
 const rect=(x:number,y:number,w=width)=>({x:clamp(x,margin,vw-w-margin),y:clamp(y,64,vh-height-margin),width:w,height});
 if(target){
  const right=vw-target.x-target.width-gap-margin,left=target.x-gap-margin;
  const blocking=obstacles.filter(item=>!(item.x<=target.x&&item.y<=target.y&&item.x+item.width>=target.x+target.width&&item.y+item.height>=target.y+target.height));
  const candidates=[rect(target.x+target.width+gap,target.y),rect(target.x-width-gap,target.y),rect(target.x,target.y+target.height+gap),rect(target.x,target.y-height-gap)];
  const free=candidates.find(candidate=>!overlaps(candidate,target,gap)&&blocking.every(item=>!overlaps(candidate,item,gap)));
  if(free)return free;
  if(Math.max(right,left)>=minWidth){const w=Math.min(width,Math.max(right,left));return rect(right>=left?target.x+target.width+gap:target.x-gap-w,(vh-height)/2,w);}
 }
 if(target){
  const secondary=obstacles.filter(item=>item.width<target.width-16||item.height<target.height-16);
  const choices=[rect((vw-width)/2,vh-height-margin),rect((vw-width)/2,64)];
  const clear=choices.find(candidate=>secondary.every(item=>!overlaps(candidate,item,gap)));
  if(clear)return clear;
 }
 // On narrow screens floating overlap is unavoidable; keep an intentional inset, not touching edges.
 return rect((vw-width)/2,vh-height-margin);
}
export function tourBannerPosition(width:number,height:number,vw:number,vh:number,obstacles:Rect[]){
 const candidates=[{x:(vw-width)/2,y:12},{x:(vw-width)/2,y:vh-height-12},{x:12,y:12},{x:vw-width-12,y:12},{x:12,y:vh-height-12},{x:vw-width-12,y:vh-height-12}];
 const free=candidates.find(point=>obstacles.every(item=>!overlaps({...point,width,height},item,8)));
 return free?{...free,embedded:false}:{...candidates[0],embedded:true};
}
