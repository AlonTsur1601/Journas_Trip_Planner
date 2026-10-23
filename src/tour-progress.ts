export type TourRect={x:number;y:number;width:number;height:number};

/** Tile the blocked area so overlapping menus never cancel each other's openings. */
export function tourShieldPath(width:number,height:number,openings:TourRect[]){
 const rects=openings.map(r=>({left:Math.max(0,r.x),right:Math.min(width,r.x+r.width),top:Math.max(0,r.y),bottom:Math.min(height,r.y+r.height)})).filter(r=>r.left<r.right&&r.top<r.bottom);
 const ys=[...new Set([0,height,...rects.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>a-b);
 let path='';
 for(let i=1;i<ys.length;i++){
  const top=ys[i-1],bottom=ys[i];
  const intervals=rects.filter(r=>r.top<=top&&r.bottom>=bottom).sort((a,b)=>a.left-b.left);
  let left=0;
  const block=(right:number)=>{if(right>left)path+=`M${left} ${top}H${right}V${bottom}H${left}Z`;};
  for(const r of intervals){block(r.left);left=Math.max(left,r.right);}
  block(width);
 }
 return path;
}

export function tourNeedsNext(stage:{done?:unknown;instructions?:unknown[]},instruction:{done?:unknown;completeOn?:string;closeOnNext?:string}|undefined,index:number){
 if(stage.instructions&&index<stage.instructions.length-1)return false;
 return Boolean(instruction?.closeOnNext||(!instruction?.done&&!instruction?.completeOn&&(!stage.done||Boolean(stage.instructions&&index<stage.instructions.length-1))));
}
export function tourInstructionComplete<T>(instruction:{ready?:(context:T)=>boolean;action?:string;completeOn?:string},index:number,part:number,acted:number[],context:T){
 return instruction.ready?.(context)!==false&&(index<part||acted.includes(index));
}

/** Valid defaults and elapsed time never count as a user's action. */
export function tourSubstepDelay<T>(instruction:{text:string;ready?:(context:T)=>boolean;action?:string;done?:unknown;completeOn?:string;closeOnNext?:string},index:number,count:number,acted:number[],context:T){
 if(index>=count-1||instruction.done||instruction.completeOn||instruction.closeOnNext)return null;
 return Boolean(instruction.action)&&acted.includes(index)&&instruction.ready?.(context)!==false?0:null;
}
