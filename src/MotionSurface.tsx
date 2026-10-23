import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {registerSurfaceMotion,notifySurfaceExit} from './surface-motion';

const duration=280;
const easing='cubic-bezier(.2,.7,.2,1)';

/** Keep an inert visual copy for the exit; application state closes immediately. */
export function MotionSurface({children}:{children:ReactNode}){
  const host=useRef<HTMLDivElement>(null);
  const exiting=useRef<HTMLElement|null>(null);
  useLayoutEffect(()=>{
    // StrictMode rehearses cleanup/setup. Never leave its rehearsal copy behind.
    exiting.current?.remove();exiting.current=null;
    const surface=host.current?.firstElementChild as HTMLElement|null;
    if(!surface)return;
    surface.dataset.motionSurface='';
    if(surface.classList.contains('map-panel')||surface.classList.contains('schedule-panel'))return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const shaded=surface.classList.contains('modal-shade');
    const mapPanel=surface.classList.contains('map-panel');
    const plannerPanel=mapPanel||surface.classList.contains('schedule-panel');
    const splitter=plannerPanel?surface.closest('.workspace')?.querySelector<HTMLElement>('.splitter'):null;
    let splitterBounds=splitter?.getBoundingClientRect();
    const panelOffset=(mapPanel?-1:1)*surface.getBoundingClientRect().width;
    const fadeDuration=shaded?120:duration;
    const card=shaded?surface.querySelector<HTMLElement>('.modal'):null;
    const enter=surface.animate([{opacity:plannerPanel?1:0},{opacity:1}],{duration:fadeDuration,easing:shaded?'linear':easing});
    const lift=(card??surface).animate([{translate:plannerPanel?`${panelOffset}px 0`:'0 8px'},{translate:'0 0'}],{duration,easing});
    registerSurfaceMotion(card??surface,lift);
    const dividerEnter=splitter?.animate([{translate:`${panelOffset}px 0`},{translate:'0 0'}],{duration,easing});
    let layoutMotion:Animation|undefined;
    let previousLeft=surface.offsetLeft,previousTop=surface.offsetTop;
    const observer=new ResizeObserver(()=>{
      if(splitter?.isConnected)splitterBounds=splitter.getBoundingClientRect();
      if(!surface.classList.contains('schedule-panel'))return;
      const left=surface.offsetLeft,top=surface.offsetTop;
      const dx=previousLeft-left,dy=previousTop-top;
      previousLeft=left;previousTop=top;
      if(!dx&&!dy)return;
      const current=layoutMotion?getComputedStyle(surface).translate.split(' ').map(parseFloat):[0,0];
      layoutMotion?.cancel();
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      layoutMotion=surface.animate([{translate:`${dx+(current[0]||0)}px ${dy+(current[1]||0)}px`},{translate:'0 0'}],{duration,easing});
    });
    observer.observe(surface);
    return()=>{
      observer.disconnect();
      if(!surface.isConnected)return;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){enter.cancel();lift.cancel();layoutMotion?.cancel();return;}
      const rect=surface.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const style=getComputedStyle(surface);
      const opacity=style.opacity;
      const cardTranslate=card?getComputedStyle(card).translate:'0 0';
      const copy=surface.cloneNode(true) as HTMLElement;
      const dividerCopy=splitter&&splitterBounds?splitter.cloneNode(true) as HTMLElement:null;
      if(dividerCopy&&splitterBounds){
        const dividerRect=splitter?.isConnected?splitter.getBoundingClientRect():splitterBounds;
        Object.assign(dividerCopy.style,{position:'absolute',left:`${dividerRect.left-rect.left}px`,top:`${dividerRect.top-rect.top}px`,width:`${dividerRect.width}px`,height:`${dividerRect.height}px`,margin:'0'});
        dividerCopy.removeAttribute('role');dividerCopy.removeAttribute('tabindex');
      }
      // Preserve the visible itinerary rather than jumping to its first hour.
      const originalNodes=[surface,...Array.from(surface.querySelectorAll<HTMLElement>('*'))];
      const copiedNodes=[copy,...Array.from(copy.querySelectorAll<HTMLElement>('*'))];
      copy.inert=true;copy.setAttribute('aria-hidden','true');
      copy.dataset.motionExit='';
      copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      Object.assign(copy.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,right:'auto',bottom:'auto',width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',maxHeight:'none',minHeight:'0',pointerEvents:'none',zIndex:style.zIndex==='auto'?'20':style.zIndex,opacity,translate:'none',transition:'none'});
      // cloneNode does not copy canvas pixels, including the buffered map.
      const canvases=copy.querySelectorAll('canvas');
      surface.querySelectorAll('canvas').forEach((canvas,i)=>{
        try{canvases[i]?.getContext('2d')?.drawImage(canvas,0,0);}catch{/* An unavailable canvas must not interrupt closing. */}
      });
      document.body.append(copy);exiting.current=copy;
      originalNodes.forEach((node,i)=>{copiedNodes[i].scrollTop=node.scrollTop;copiedNodes[i].scrollLeft=node.scrollLeft;});
      if(dividerCopy){copy.style.overflow='visible';copy.append(dividerCopy);}
      enter.cancel();lift.cancel();dividerEnter?.cancel();layoutMotion?.cancel();
      const exit=copy.animate([{opacity},{opacity:plannerPanel?1:0}],{duration:plannerPanel?duration:fadeDuration,easing:shaded?'linear':easing,fill:'forwards'});
      const exitCard=shaded?copy.querySelector<HTMLElement>('.modal'):copy;
      const exitLift=exitCard?.animate([{translate:cardTranslate},{translate:plannerPanel?`${(mapPanel?-1:1)*(rect.width+12)}px 0`:'0 6px'}],{duration,easing,fill:'forwards'});
      if(exitCard&&exitLift){registerSurfaceMotion(exitCard,exitLift);originalNodes.forEach((node,i)=>notifySurfaceExit(node,copiedNodes[i],exit,exitLift));}
      exit.finished.then(()=>copy.remove(),()=>copy.remove());
    };
  },[]);
  return <div ref={host} className="motion-surface">{children}</div>;
}
