import {api} from './firebase';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Compass,X} from 'lucide-react';
import {activitySnapshot,subscribeActivity} from './activity';
export type TourContext={home:boolean;modal:string|null;editKind:string|null;editId:string|null;tripId:string|null;trips:number;pins:number;blocks:number;tasks:number;checkedTasks:number;connections:number;homePins:number;checklist:boolean;date:string};
type Step={title:string;text:string;target:string|((context:TourContext)=>string);done?:(context:TourContext)=>boolean};
export const tourSteps:Step[]=[
 {title:'Start a simple trip',text:'Choose Create new trip. We will build a short itinerary together, using your own places and dates.',target:'.home-create',done:c=>c.modal==='new-trip'},
 {title:'Make the trip yours',text:'Give your trip a name and a date range. Choose a lodging location using search or the map. Pick a symbol and color, or upload and crop an image. For practice, use a trip spanning two or three days, then choose Create trip.',target:'.trip-modal',done:c=>Boolean(c.tripId)&&!c.home&&c.modal!=='new-trip'},
 {title:'Add your first place',text:'Choose Add pin on map, then click an empty spot on the map to open the place editor. Places on the map are separate from the shortcuts pinned to your home page.',target:'.map-panel',done:c=>c.editKind==='pins'&&c.editId!=='trip-lodging'},
 {title:'Find and customize a place',text:'Search for a place, or choose its position on the map. Give it a name, note, color and symbol, then choose Create pin.',target:'.item-modal',done:c=>c.pins>=1&&!c.editKind},
 {title:'Plan a time block',text:'Choose Add time block to put an activity on your schedule.',target:'[aria-label="Add time block"]',done:c=>c.editKind==='blocks'},
 {title:'Link your schedule to a place',text:'Choose your saved place under Linked place. Its details are inherited until you customize a field yourself. Set start and end dates and times; use the white clock button for the time wheels. A block can continue across days. Choose Create time block.',target:'.item-modal',done:c=>c.blocks>=1&&!c.editKind},
 {title:'Open your checklist',text:'Turn on Tasks to keep a checklist alongside the map and schedule.',target:'[aria-label="Tasks"]',done:c=>c.checklist},
 {title:'Add a task',text:'Choose Add a task in your checklist.',target:'.todo-add',done:c=>c.editKind==='tasks'},
 {title:'Connect a task to the plan',text:'Write a task, such as Buy tickets. Link it to your place and time block, then choose Create task. The task can then follow the activity in your itinerary.',target:'.task-modal',done:c=>c.tasks>=1&&!c.editKind},
 {title:'Check it off',text:'Mark your task as complete using its checkbox. You can uncheck it later; linked tasks are emphasized while their activity is happening.',target:'.todo-panel input[type=checkbox]',done:c=>c.checkedTasks>=1},
 {title:'Add another place',text:'Choose Add pin on map and click another empty spot, then save the second place. We will connect the two places next.',target:c=>c.editKind==='pins'?'.item-modal':'.map-panel',done:c=>c.pins>=2&&!c.editKind},
 {title:'Connect your places',text:'Choose Connect pins on map, then click your two place markers. Arrow controls whether the connection has a direction. Connections opens the list where you can edit or remove routes.',target:'.map-panel',done:c=>c.connections>=1},
 {title:'Explore the map',text:'Pan and zoom the map. The compass resets north, the plus and minus buttons zoom, and selecting a pin opens its editor. Your last map view is kept when the map is closed and reopened.',target:'.map-panel'},
 {title:'Navigate the trip dates',text:'Use the date button to open the calendar, or the arrows to move between days. Dots mark trip dates and the trip legend scrolls when needed. Each day shows only its portion of a multi-day block.',target:'.date-picker'},
 {title:'Arrange your workspace',text:'Map, Schedule and Tasks can be shown or hidden. On a computer, drag the divider to resize the map and schedule, and move or resize the checklist.',target:'.view-controls'},
 {title:'Undo, redo and save',text:'Undo and Redo are available in the top bar (Ctrl+Z and Ctrl+Shift+Z). Save planning or Ctrl+S saves without interrupting your work; its dot turns amber while saving.',target:'.top-actions'},
 {title:'View the trip details',text:'Open Trip details to manage the trip and collaboration.',target:'[aria-label="Trip details"]',done:c=>c.modal==='trip'},
 {title:'Share and collaborate',text:'Here you can edit trip dates and lodging, create a view-only or editor sharing link, and manage travelers. Sharing links and account changes are disabled for this temporary practice trip. Close this window when you are ready.',target:'.share-modal',done:c=>c.modal===null},
 {title:'Return home',text:'Choose the Journas logo to return to your personal home page. Your place in the planner is remembered.',target:'.topbar .brand',done:c=>c.home},
 {title:'Pin a shortcut',text:'Use Create pin to pin your trip, one trip day, or a date to the home page. Choose a type and save it. Right-click or use the three dots on a home card to manage shortcuts.',target:c=>document.querySelector('.home-pin-modal')?'.home-pin-modal':'.home-pins-section',done:c=>c.homePins>=1},
 {title:'Find your plans again',text:'Continue resumes where you left off. Recent trips and dates reopen your plans; All trips lists every saved trip. Each card has an options menu.',target:'.home-featured'},
 {title:'Personalize Journas',text:'Open Settings to finish the tour with your preferences.',target:'.home-account [aria-label="Settings"]',done:c=>c.modal==='settings'},
 {title:'Choose your preferences',text:'Choose a theme and accent, map starting view, clock and retention preferences. By default, trip dates use the lodging location and time zone; dates outside the trip use your current location and local time. Account settings manages your sign-in methods. Save changes if you adjust anything. To restart, open Settings and choose Guided tour at the bottom.',target:'.settings-modal'},
];
const keyFor=(uid:string)=>`journas-guided-tour:practice-2026-10-17:${uid}`;
function remember(uid:string){if(seen(uid))return;void api('tour.seen').catch(()=>{});try{localStorage.setItem(keyFor(uid),'seen');}catch{/* The guide remains usable when storage is unavailable. */}}
function seen(uid:string){try{return Boolean(localStorage.getItem(keyFor(uid)));}catch{return false;}}
export default function GuidedTour({userId,ready,context,onHome,practice}:{practice:boolean;userId:string;ready:boolean;context:TourContext;onHome:()=>void}){
 const [status,setStatus]=useState<'closed'|'welcome'|'running'>('closed'),[step,setStep]=useState(0),[box,setBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 const card=useRef<HTMLElement>(null),[cardHeight,setCardHeight]=useState(250),[domModal,setDomModal]=useState(false);
 const inModal=status==='running'&&Boolean(context.modal||context.editKind||domModal);
 useEffect(()=>{if(!card.current)return;const observer=new ResizeObserver(()=>setCardHeight(card.current?.getBoundingClientRect().height??250));observer.observe(card.current);return()=>observer.disconnect();},[status,inModal]);
 useEffect(()=>{if(!inModal)return;document.body.style.setProperty('--tour-space',`${cardHeight+32}px`);return()=>{document.body.style.removeProperty('--tour-space');};},[inModal,cardHeight]);
 const initialized=useRef('');const current=tourSteps[step];const activity=useSyncExternalStore(subscribeActivity,activitySnapshot);
 useEffect(()=>{if(!ready||initialized.current===userId)return;if(practice){initialized.current=userId;setStatus('running');return;}if(seen(userId)){initialized.current=userId;return;}let live=true;void api<{seen:boolean}>('tour.status').then(result=>{if(!live)return;initialized.current=userId;if(result.seen){try{localStorage.setItem(keyFor(userId),'seen');}catch{}}if(!result.seen){remember(userId);onHome();setStatus('welcome');}}).catch(()=>{if(live&&!seen(userId)){initialized.current=userId;onHome();setStatus('welcome');}});return()=>{live=false;};},[ready,userId,practice]);
 useEffect(()=>{const start=()=>{onHome();setStep(0);setStatus('welcome');};window.addEventListener('journas-start-tour',start);return()=>window.removeEventListener('journas-start-tour',start);},[onHome]);
 const close=()=>{remember(userId);setStatus('closed');if(practice)window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));};
 useEffect(()=>{if(status!=='closed'){const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();remember(userId);setStatus('closed');if(practice)window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);}},[status,userId,practice]);
 const next=()=>{if(step===tourSteps.length-1)close();else setStep(value=>value+1);};
 useEffect(()=>{if(status==='running'&&!activity.length&&current.done?.(context))next();},[status,step,context,activity.length]);
 const selector=typeof current.target==='function'?current.target(context):current.target;
 useEffect(()=>{
  if(status!=='running')return;let frame=0,scrolled:Element|null=null;
  const place=()=>{frame=0;setDomModal(Boolean(document.querySelector('.modal-shade:not([inert]),.home-pin-modal')));const target=[...document.querySelectorAll(document.querySelector('.bounded-popover:not([inert])')?'.bounded-popover:not([inert])':selector)].find(element=>{const r=element.getBoundingClientRect();return r.width>0&&r.height>0&&!element.closest('[inert],[aria-hidden="true"]');});
   if(!target){setBox(previous=>previous===null?previous:null);return;}
   const rect=target.getBoundingClientRect();if(scrolled!==target&&(rect.bottom<80||rect.top>innerHeight-100)){scrolled=target;target.scrollIntoView({block:'center',behavior:'instant'});}
   const r=target.getBoundingClientRect(),next={x:Math.max(4,r.left-6),y:Math.max(4,r.top-6),width:Math.min(innerWidth-8,r.width+12),height:Math.min(innerHeight-8,r.height+12)};
   next.width=Math.min(next.width,innerWidth-4-next.x);next.height=Math.min(next.height,innerHeight-4-next.y);
   setBox(previous=>previous&&Object.keys(next).every(key=>Math.abs(previous[key as keyof typeof next]-next[key as keyof typeof next])<1)?previous:next);
  };
  const update=()=>{if(!frame)frame=requestAnimationFrame(place);};place();const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
 },[status,selector,step,activity.length,cardHeight,inModal]);
 if(status==='closed')return null;
 const welcome=status==='welcome',width=Math.min(inModal?700:340,innerWidth-24),height=cardHeight;
 const below=Boolean(box&&box.y+box.height+height+24<innerHeight);
 const side=!inModal&&box&&!below&&box.y<height+24?(box.x+box.width+width+24<innerWidth?'right':box.x>width+24?'left':null):null;
 const top=inModal?Math.max(12,innerHeight-height-12):welcome?Math.max(12,(innerHeight-height)/2):box?(side?Math.max(12,Math.min(box.y,innerHeight-height-12)):below?box.y+box.height+16:box.y>height+24?box.y-height-16:Math.max(12,innerHeight-height-12)):Math.max(12,innerHeight-height-12);
 const left=welcome||inModal?(innerWidth-width)/2:side&&box?(side==='right'?box.x+box.width+16:box.x-width-16):Math.max(12,Math.min(innerWidth-width-12,box?box.x:12));
 const arrowX=box?(side==='right'?box.x+box.width:side==='left'?box.x:Math.max(box.x+8,Math.min(box.x+box.width-8,left+width/2))):0,arrowY=box?(side?Math.max(box.y+8,Math.min(box.y+box.height-8,top+height/2)):top>=box.y+box.height?box.y+box.height:box.y):0;
 const arrowStartX=side==='right'?left:side==='left'?left+width:left+width/2,arrowStartY=side?top+height/2:top>= (box?.y??0)+(box?.height??0)?top:top+height;
 return createPortal(<div className="guided-tour" data-step={step} data-modal={inModal}>
  <svg className="tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="journas-tour-cutout"><rect width="100%" height="100%" fill="white"/>{!welcome&&box&&<rect x={box.x} y={box.y} width={box.width} height={box.height} rx="9" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="#15102099" mask="url(#journas-tour-cutout)"/>{!welcome&&box&&<><rect className="tour-highlight" x={box.x} y={box.y} width={box.width} height={box.height} rx="9" fill="none" stroke="var(--accent)" strokeWidth="2"/><path d={`M ${arrowStartX} ${arrowStartY} L ${arrowX} ${arrowY}`} fill="none" stroke="var(--accent)" strokeWidth="3" markerEnd="url(#journas-tour-arrow)"/></>}<defs><marker id="journas-tour-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--accent)"/></marker></defs></svg>
  <section ref={card} className="tour-card" role="dialog" aria-modal="false" aria-label="Journas guided tour" style={{left,top,width}}>
   <button className="icon tour-close" aria-label="Close guide" onClick={close}><X size={18}/></button>
   <div className="tour-eyebrow"><Compass size={17}/>{welcome?'Welcome to Journas':`Step ${step+1} of ${tourSteps.length}`}</div>
   <h2>{welcome?'Plan your first trip together':current.title}</h2>
   <p aria-live="polite">{welcome?'Follow the highlights to try the map, schedule, tasks and sharing tools. This practice trip is not saved to your profile. Restart anytime with Guided tour at the bottom of Settings.':current.text}</p>
   {!welcome&&!box&&<small>Open the relevant panel to continue, or skip this step.</small>}
   <div className="tour-actions"><button className="text-button" onClick={welcome?close:next}>{welcome?'Not now':'Skip step'}</button>{(welcome||!current.done)&&<button className="button primary" onClick={()=>{if(welcome){remember(userId);setStep(0);if(practice)setStatus('running');else{setStatus('closed');window.dispatchEvent(new CustomEvent('journas-practice',{detail:true}));}}else next();}}>{welcome?'Start guide':step===tourSteps.length-1?'Finish':'Next'}<ArrowRight size={15}/></button>}</div>
  </section>
 </div>,document.body);
}
