import {Component,type ReactNode} from 'react';

type Props={map:boolean;timeline:boolean;children:ReactNode};
type Frame={key:string;rect:DOMRect;copy:HTMLElement};
const timing={duration:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'both' as const};

/** Measure before React changes the grid, then move its surfaces as one layout. */
export default class WorkspaceMotion extends Component<Props>{
  private host:HTMLDivElement|null=null;
  private animations:Animation[]=[];
  private copies:HTMLElement[]=[];
  private clear(){this.animations.forEach(a=>a.cancel());this.animations=[];this.copies.forEach(e=>e.remove());this.copies=[];}
  getSnapshotBeforeUpdate(previous:Props):Frame[]|null{
    if(previous.map===this.props.map&&previous.timeline===this.props.timeline)return null;

    const root=this.host?.querySelector('.workspace');
    if(!root)return null;
    const mapPanel=root.querySelector<HTMLElement>('.map-panel');
    if(previous.map&&mapPanel){const rect=mapPanel.getBoundingClientRect();mapPanel.style.setProperty('--retained-map-width',`${rect.width}px`);mapPanel.style.setProperty('--retained-map-height',`${rect.height}px`);}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
    return Array.from(root.querySelectorAll<HTMLElement>('.map-panel,.schedule-panel,.splitter')).filter(node=>!node.closest('[data-workspace-exit]')&&node.getAttribute('aria-hidden')!=='true').map(node=>{
      const copy=node.cloneNode(true) as HTMLElement;
      const originals=[node,...node.querySelectorAll<HTMLElement>('*')];
      const duplicates=[copy,...copy.querySelectorAll<HTMLElement>('*')];
      originals.forEach((e,i)=>{duplicates[i].dataset.motionScroll=String(e.scrollTop);});
      const canvases=copy.querySelectorAll('canvas');
      node.querySelectorAll('canvas').forEach((canvas,i)=>{try{canvases[i]?.getContext('2d')?.drawImage(canvas,0,0);}catch{}});
      return {key:node.classList.contains('map-panel')?'map-panel':node.classList.contains('schedule-panel')?'schedule-panel':'splitter',rect:node.getBoundingClientRect(),copy};
    });
  }
  componentDidUpdate(previous:Props,_state:unknown,frames:Frame[]|null){
    if(!frames)return;
    this.clear();
    const root=this.host?.querySelector<HTMLElement>('.workspace');
    if(!root)return;
    const bounds=root.getBoundingClientRect();
    const vertical=matchMedia('(max-width:700px)').matches;
    const mapClosing=previous.map&&!this.props.map;
    const mapOpening=!previous.map&&this.props.map;
    const dividerBefore=frames.find(f=>f.key==='splitter')?.rect;
    const dividerAfter=root.querySelector('.splitter')?.getBoundingClientRect();
    const start=vertical?bounds.top:bounds.left,end=vertical?bounds.bottom:bounds.right;
    const dividerStart=(rect:DOMRect|undefined)=>rect?(vertical?rect.top:rect.left):start;
    const dividerEnd=(rect:DOMRect|undefined)=>rect?(vertical?rect.bottom:rect.right):end;
    const entryDistance=mapOpening?start-dividerEnd(dividerAfter):end-dividerStart(dividerAfter);
    const exitDistance=mapClosing?start-dividerEnd(dividerBefore):end-dividerStart(dividerBefore);
    root.querySelectorAll<HTMLElement>('.map-panel:not([aria-hidden="true"]),.schedule-panel,.splitter').forEach(node=>{
      const key=node.classList.contains('map-panel')?'map-panel':node.classList.contains('schedule-panel')?'schedule-panel':'splitter';
      const before=frames.find(f=>f.key===key)?.rect;
      const after=node.getBoundingClientRect();
      const dx=before?before.left-after.left:vertical?0:entryDistance;
      const dy=before?before.top-after.top:vertical?entryDistance:0;
      const animation=node.animate([{translate:`${dx}px ${dy}px`,width:`${before?.width??after.width}px`,height:`${before?.height??after.height}px`},{translate:'0 0',width:`${after.width}px`,height:`${after.height}px`}],timing);
      this.animations.push(animation);animation.finished.then(()=>animation.cancel(),()=>{});
    });
    frames.filter(frame=>!root.querySelector(`.${frame.key}:not([aria-hidden="true"])`)).forEach(({key,rect,copy})=>{
      copy.inert=true;copy.setAttribute('aria-hidden','true');copy.dataset.workspaceExit='';
      copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
      Object.assign(copy.style,{position:'absolute',left:`${rect.left-bounds.left}px`,top:`${rect.top-bounds.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,minHeight:'0',margin:'0',zIndex:'5',pointerEvents:'none'});
      root.append(copy);this.copies.push(copy);
      [copy,...copy.querySelectorAll<HTMLElement>('*')].forEach(e=>{e.scrollTop=Number(e.dataset.motionScroll??0);delete e.dataset.motionScroll;});
      const animation=copy.animate([{translate:'0 0'},{translate:vertical?`0 ${exitDistance}px`:`${exitDistance}px 0`}],timing);
      this.animations.push(animation);animation.finished.then(()=>copy.remove(),()=>copy.remove());
    });
  }
  componentWillUnmount(){this.clear();}
  render(){return <div className="workspace-motion" ref={node=>{this.host=node;}}>{this.props.children}</div>;}
}
