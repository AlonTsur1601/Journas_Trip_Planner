export const minHourHeight=24,maxHourHeight=240;
/** Keep the same time under the pointer (or viewport center) while scaling. */
export function timelineZoom(height:number,scroll:number,anchor:number,factor:number,viewportHeight:number){
 const hourHeight=Math.round(Math.max(minHourHeight,Math.min(maxHourHeight,height*factor))*100)/100;
 const nextScroll=Math.max(0,Math.min(Math.max(0,hourHeight*24-viewportHeight),(scroll+anchor)/height*hourHeight-anchor));
 return {hourHeight,scroll:nextScroll};
}

export const outsideTimelineKey=(uid:string,date:string)=>`journas-timeline:${uid}:${date}`;
export function outsideTimelineHeight(storage:Pick<Storage,'getItem'>,uid:string,date:string){
 try{const height=Number(storage.getItem(outsideTimelineKey(uid,date)));return Number.isFinite(height)&&height>=minHourHeight&&height<=maxHourHeight?height:undefined;}catch{return undefined;}
}
