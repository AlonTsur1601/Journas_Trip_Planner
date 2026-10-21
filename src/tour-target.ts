/** Resolve only the requested target; unrelated nested portals never steal focus. */
export function findTourTarget(selector:string,root:Pick<Document,'querySelectorAll'>=document){
 return [...root.querySelectorAll(selector)].find(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&!element.closest('[inert],[aria-hidden="true"]');})??null;
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
