const motions=new WeakMap<Element,Animation>();

export function registerSurfaceMotion(element:Element,animation:Animation){motions.set(element,animation);}

export function surfaceMotion(element:Element){
 for(let node:Element|null=element;node;node=node.parentElement){
  const animation=motions.get(node);
  if(animation)return{element:node,animation};
 }
 return null;
}

/** Separate layout coordinates from the compositor's current lift offset. */
export function restingSurfaceRect(element:Element){
 const rect=element.getBoundingClientRect(),motion=surfaceMotion(element);
 const [x=0,y=0]=motion?getComputedStyle(motion.element).translate.split(' ').map(value=>parseFloat(value)||0):[];
 return{x:rect.x-x,y:rect.y-y,width:rect.width,height:rect.height};
}

/** Use the original keyframes, easing and start time; no per-frame React redraw. */
export function mirrorSurfaceMotion(element:Element,node:Element){
 let source:Animation|null=null,copy:Animation|null=null;
 return{
  sync(){
   const animation=surfaceMotion(element)?.animation??null;
   if(animation!==source){
    copy?.cancel();source=animation;copy=null;
    if(source?.effect&&source.startTime!==null){
     copy=node.animate((source.effect as KeyframeEffect).getKeyframes(),source.effect.getTiming());
    }
   }
   if(source&&source.startTime!==null&&!copy&&source.effect)copy=node.animate((source.effect as KeyframeEffect).getKeyframes(),source.effect.getTiming());
   if(copy&&source){copy.playbackRate=source.playbackRate;if(copy.startTime!==source.startTime)copy.startTime=source.startTime;}
  },
  stop(){copy?.cancel();},
 };
}
