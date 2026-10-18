/** Track layout plus finite motion: transforms do not notify Mutation/ResizeObserver. */
export function observeTourTarget(find:()=>Element|null,place:(target:Element|null)=>void){
 let frame=0,target:Element|null=null,stopped=false;
 const update=()=>{if(!stopped&&!frame)frame=requestAnimationFrame(measure);};
 const resize=new ResizeObserver(update);
 const moving=(element:Element)=>document.getAnimations().some(animation=>{
  if(animation.playState!=='running'&&!animation.pending)return false;
  if(!Number.isFinite(animation.effect?.getComputedTiming().endTime))return false;
  const animated=(animation.effect as KeyframeEffect|null)?.target;
  return animated&&(animated.contains(element)||element.contains(animated));
 });
 const measure=()=>{
  frame=0;if(stopped)return;
  const next=find();if(next!==target){resize.disconnect();target=next;if(target)resize.observe(target);}
  place(target);
  if(target&&moving(target))update();
 };
 const mutations=new MutationObserver(update);
 mutations.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
 const motionEvents=['transitionrun','transitionend','transitioncancel','animationstart','animationend','animationcancel'];
 motionEvents.forEach(event=>document.addEventListener(event,update,true));
 window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
 measure();
 return()=>{stopped=true;cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();motionEvents.forEach(event=>document.removeEventListener(event,update,true));window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
}
