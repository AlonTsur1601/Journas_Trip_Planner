/** Compare the stacking contexts that actually contain the two surfaces. */
export function isAboveTourTarget(surface:Element,target:Element){
 if(surface===target||surface.contains(target))return false;
 if(target.contains(surface))return true;
 const contexts=(element:Element)=>{const path:Element[]=[];for(let node:Element|null=element;node;node=node.parentElement){const s=getComputedStyle(node);if(node===element||s.position==='fixed'||s.position==='sticky'||s.zIndex!=='auto'||s.transform!=='none'||s.translate!=='none'||s.filter!=='none'||Number(s.opacity)<1||s.isolation==='isolate'||/transform|opacity|translate/.test(s.willChange))path.unshift(node);}return path;};
 const a=contexts(surface),b=contexts(target);let i=0;while(a[i]&&a[i]===b[i])i++;
 if(!a[i])return false;if(!b[i])return true;
 const az=Number.parseInt(getComputedStyle(a[i]).zIndex)||0,bz=Number.parseInt(getComputedStyle(b[i]).zIndex)||0;
 return az===bz?Boolean(b[i].compareDocumentPosition(a[i])&Node.DOCUMENT_POSITION_FOLLOWING):az>bz;
}
