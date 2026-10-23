import {isAboveTourTarget} from './tour-stacking';
import {mirrorSurfaceMotion,restingSurfaceRect,watchSurfaceExit,mirrorExitAnimation} from './surface-motion';
import {tourShieldPath,type TourRect} from './tour-progress';

/** Keep painted focus layers on the menu's compositor timeline. Only the invisible
 * input shield needs the current (moving) bounds each frame. */
export function tourSpotlight(outline:HTMLElement,cutouts:SVGGElement,shield:SVGPathElement,occluders:SVGGElement){
 const covers=new Map<Element,{rect:SVGRectElement;motion:ReturnType<typeof mirrorSurfaceMotion>}>();
 const holes=new Map<Element,{rect:SVGRectElement;motion:ReturnType<typeof mirrorSurfaceMotion>}>();
 let stopExit:(()=>void)|null=null;
 let focused:Element|null=null,focusMotion:ReturnType<typeof mirrorSurfaceMotion>|null=null;
 const bounds=(element:Element)=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 return{
  place(target:Element|null,availableHeight:number){
   const surfaces=[...document.querySelectorAll('.modal:not([inert]),.bounded-popover:not([inert])')].filter(el=>!el.closest('[inert],[data-motion-exit]')&&el.getBoundingClientRect().width>0);
   if(target!==focused){
    stopExit?.();stopExit=null;focusMotion?.stop();focused=target;outline.hidden=!target;
    if(target){focusMotion=mirrorSurfaceMotion(target,outline);stopExit=watchSurfaceExit(target,(copy,fade,lift)=>{
     const clip=outline.parentElement!.cloneNode(false) as HTMLElement;
     Object.assign(clip.style,{position:'fixed',inset:'0',zIndex:'250'});
     const glow=outline.cloneNode(true) as HTMLElement;glow.hidden=false;
     const rect=restingSurfaceRect(copy);Object.assign(glow.style,{left:`${rect.x-6}px`,top:`${rect.y-6}px`,width:`${rect.width+12}px`,height:`${rect.height+12}px`});
     clip.append(glow);document.body.append(clip);outline.hidden=true;
     const sourcePulse=outline.firstElementChild?.getAnimations()[0],exitPulse=glow.firstElementChild?.getAnimations()[0];
     if(sourcePulse?.startTime!=null&&exitPulse)exitPulse.startTime=sourcePulse.startTime;
     const motion=mirrorExitAnimation(lift,glow),opacity=mirrorExitAnimation(fade,clip);
     const remove=()=>{clip.remove();motion.cancel();opacity.cancel();};
     void fade.finished.then(remove,remove);
    });}
   }
   const overlays=[...new Set([...surfaces,...document.querySelectorAll('.place-results,.home-context-menu,[role=tooltip]')])].filter(el=>!el.closest('[inert],[data-motion-exit]')&&el.getBoundingClientRect().width>0);
   const above=target?overlays.filter(surface=>isAboveTourTarget(surface,target)):[];
   for(const[element,cover]of covers)if(!above.includes(element)){cover.motion.stop();cover.rect.remove();covers.delete(element);}
   for(const element of above){
    let cover=covers.get(element);if(!cover){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('fill','black');rect.setAttribute('rx',getComputedStyle(element).borderTopLeftRadius);occluders.append(rect);cover={rect,motion:mirrorSurfaceMotion(element,rect)};covers.set(element,cover);}
    const r=restingSurfaceRect(element);for(const[name,value]of Object.entries({x:r.x,y:r.y,width:r.width,height:r.height}))if(cover.rect.getAttribute(name)!==String(value))cover.rect.setAttribute(name,String(value));cover.motion.sync();
   }
   const elements=[...new Set([...(focused?.isConnected?[focused]:[]),...surfaces])];
   for(const [element,hole] of holes)if(!elements.includes(element)){hole.motion.stop();hole.rect.remove();holes.delete(element);}
   const openings:TourRect[]=[];
   for(const element of elements){
    const padding=element===focused?6:0;
    const resting=restingSurfaceRect(element),moving=bounds(element);
    openings.push({x:moving.x-padding,y:moving.y-padding,width:moving.width+padding*2,height:moving.height+padding*2});
    let hole=holes.get(element);
    if(!hole){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('fill','black');rect.setAttribute('rx','9');cutouts.append(rect);hole={rect,motion:mirrorSurfaceMotion(element,rect)};holes.set(element,hole);}
    const box={x:resting.x-padding,y:resting.y-padding,width:resting.width+padding*2,height:resting.height+padding*2};
    for(const [name,value] of Object.entries(box))if(hole.rect.getAttribute(name)!==String(value))hole.rect.setAttribute(name,String(value));
    hole.motion.sync();
    if(element===focused){
     const styles={left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`};
     for(const [name,value] of Object.entries(styles))if(outline.style[name as 'left']!==value)outline.style[name as 'left']=value;
     outline.hidden=false;focusMotion?.sync();
    }
   }
   const path=tourShieldPath(innerWidth,availableHeight,openings);
   if(shield.getAttribute('d')!==path)shield.setAttribute('d',path);
  },
  stop(){stopExit?.();outline.hidden=true;focusMotion?.stop();for(const hole of holes.values()){hole.motion.stop();hole.rect.remove();}holes.clear();for(const cover of covers.values()){cover.motion.stop();cover.rect.remove();}covers.clear();},
 };
}
