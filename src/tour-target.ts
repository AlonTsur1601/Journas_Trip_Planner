/** Resolve only the requested target; unrelated nested portals never steal focus. */
export function findTourTarget(selector:string,root:Pick<Document,'querySelectorAll'>=document){
 return [...root.querySelectorAll(selector)].find(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&!element.closest('[inert],[aria-hidden="true"],[data-motion-exit]');})??null;
}
/** Portals can open without changing guide state. Resolve their selector live. */
export function findTourStepTarget<T>(target:string|((context:T)=>string),fallback:string|((context:T)=>string),context:T){
 return findTourTarget(typeof target==='function'?target(context):target)??findTourTarget(typeof fallback==='function'?fallback(context):fallback);
}
/** Guide-only close buttons are hidden visually; their active modal must be visible. */
export function findTourAction(selector:string){
 return [...document.querySelectorAll<HTMLElement>(selector)].find(element=>{
  if(element.closest('[inert],[data-motion-exit]'))return false;
  const host=element.closest('.modal')??element,rect=host.getBoundingClientRect();
  return rect.width>0&&rect.height>0;
 });
}
/** Read every rendered frame while the guide is open. Web Animations can start
 * after the initial measurement and do not dispatch CSS animation events. */
export function observeTourTarget(find:()=>Element|null,place:(target:Element|null)=>void){
 let frame=0,stopped=false;
 const measure=()=>{
  frame=0;if(stopped)return;
  place(find());
  if(!stopped)frame=requestAnimationFrame(measure);
 };
 frame=requestAnimationFrame(measure);
 return()=>{stopped=true;cancelAnimationFrame(frame);};
}
