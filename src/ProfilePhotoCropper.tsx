import {useEffect,useRef,useState} from 'react';

const SIZE=280;
export default function ProfilePhotoCropper({file,onApply,onCancel,onError}: {file:File;onApply:(photo:string)=>void;onCancel:()=>void;onError:(message:string)=>void}) {
  const [url,setUrl]=useState('');
  const [dimensions,setDimensions]=useState({width:0,height:0});
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[busy,setBusy]=useState(false);
  const drag=useRef<{x:number;y:number;pan:{x:number;y:number}}|null>(null);
  useEffect(()=>{const source=URL.createObjectURL(file);const image=new Image();image.onload=()=>{setDimensions({width:image.naturalWidth,height:image.naturalHeight});setUrl(source);};image.onerror=()=>{onError('This image could not be read.');onCancel();};image.src=source;return()=>{image.onload=null;image.onerror=null;URL.revokeObjectURL(source);};},[file]);
  const scale=dimensions.width?SIZE/Math.min(dimensions.width,dimensions.height)*zoom:1;
  const width=dimensions.width*scale,height=dimensions.height*scale;
  const clamp=(p:{x:number;y:number})=>({x:Math.max(-(width-SIZE)/2,Math.min((width-SIZE)/2,p.x)),y:Math.max(-(height-SIZE)/2,Math.min((height-SIZE)/2,p.y))});
  const offset=clamp(pan),x=(SIZE-width)/2+offset.x,y=(SIZE-height)/2+offset.y;
  async function apply(){setBusy(true);try{const image=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.getContext('2d')!.drawImage(image,-x/scale,-y/scale,SIZE/scale,SIZE/scale,0,0,128,128);image.close();onApply(canvas.toDataURL('image/jpeg',.85));}catch{onError('This image could not be read.');}finally{setBusy(false);}}
  return <div className="photo-cropper"><p>Drag the photo and adjust the zoom to choose a square.</p><div className="photo-crop-stage" role="img" aria-label="Square profile photo selection" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();drag.current={x:e.clientX,y:e.clientY,pan:offset};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const ratio=SIZE/e.currentTarget.getBoundingClientRect().width;setPan(clamp({x:drag.current.pan.x+(e.clientX-drag.current.x)*ratio,y:drag.current.pan.y+(e.clientY-drag.current.y)*ratio}));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}><svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">{url&&<image href={url} x={x} y={y} width={width} height={height}/>}<path d="M93 0V280M187 0V280M0 93H280M0 187H280" fill="none" stroke="#fff8"/></svg></div><label className="field"><span>Zoom</span><input aria-label="Photo zoom" type="range" min="1" max="4" step=".01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><div className="photo-crop-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button type="button" className="button primary" disabled={!url||busy} onClick={apply}>{busy?'Preparing photo…':'Use this crop'}</button></div></div>;
}
