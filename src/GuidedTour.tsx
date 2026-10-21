import {findTourTarget,observeTourTarget} from './tour-target';
import {tourCardPosition} from './tour-layout';
import {MotionSurface} from './MotionSurface';
import {api} from './firebase';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Compass,X} from 'lucide-react';
export type TourContext={draft:Record<string,any>|null;lodgingChosen:boolean;mapStart:string;home:boolean;modal:string|null;editKind:string|null;editId:string|null;tripId:string|null;trips:number;pins:number;blocks:number;tasks:number;checkedTasks:number;connections:number;homePins:number;checklist:boolean;date:string};
type Instruction={title:string;text:string;target?:string|((context:TourContext)=>string);done?:(context:TourContext)=>boolean;skipWhen?:(context:TourContext)=>boolean;completeOn?:string;blurOn?:string;ready?:(context:TourContext)=>boolean};
type Step={title:string;text:string;target:string|((context:TourContext)=>string);done?:(context:TourContext)=>boolean;instructions?:Instruction[]};
const tourSteps:Step[]=[
 {title:'Start a simple trip',text:'Choose Create new trip. We will build a short itinerary together, using your own places and dates.',target:'.home-create',done:c=>c.modal==='new-trip'},
 {title:'Make the trip yours',text:'Give your trip a name and a date range. Choose a lodging location using search or the map. Pick a symbol and color, or upload and crop an image. For practice, use a trip spanning two or three days, then choose Create trip.',target:'.trip-modal',done:c=>Boolean(c.tripId)&&!c.home&&c.modal!=='new-trip'},
 {title:'Add your first place',text:'Choose Add pin on map, then click an empty spot on the map to open the place editor. Places on the map are separate from the shortcuts pinned to your home page.',target:'.map-panel',done:c=>c.editKind==='pins'&&c.editId!=='trip-lodging'},
 {title:'Find and customize a place',text:'Search for a place, or choose its position on the map. Give it a name, note, color and symbol, then choose Create pin.',target:'.item-modal',done:c=>c.pins>=1&&!c.editKind},
 {title:'Plan a time block',text:'Choose Add time block to put an activity on your schedule.',target:'[aria-label="Add time block"]',done:c=>c.editKind==='blocks'},
 {title:'Link your schedule to a place',text:'Choose your saved place under Linked place. Its details are inherited until you customize a field yourself. Set start and end dates and times; use the white clock button for the time wheels. A block can continue across days. Choose Create time block.',target:'.item-modal',done:c=>c.blocks>=1&&!c.editKind},
 {title:'Open your checklist',text:'Turn on Tasks to keep a checklist alongside the map and schedule.',target:'[aria-label="Tasks"]',done:c=>c.checklist},
 {title:'Add a task',text:'Choose Add a task in your checklist.',target:'.todo-add',done:c=>c.editKind==='tasks'},
 {title:'Connect a task to the plan',text:'Write a task, such as Buy tickets. Link it to your place and time block, then choose Create task. The task can then follow the activity in your itinerary.',target:'.task-modal',done:c=>c.tasks>=1&&!c.editKind},
 {title:'Check it off',text:'Mark your task as complete using its checkbox. Click the task text to reopen its editor, where you can change links or delete it. You can uncheck the box later; linked tasks are emphasized during their activity.',target:'.todo-panel input[type=checkbox]',done:c=>c.checkedTasks>=1},
 {title:'Add another place',text:'Choose Add pin on map and click another empty spot, then save the second place. We will connect the two places next.',target:c=>c.editKind==='pins'?'.item-modal':c.checklist&&innerWidth<=700?'[aria-label="Close tasks"]':'.map-panel',done:c=>c.pins>=2&&!c.editKind},
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
const instructions:Record<string,Instruction[]>={
 'Make the trip yours':[
  {title:'Name and dates',blurOn:'.trip-modal input[name=name],.trip-modal .segmented-date input',ready:()=>{const form=document.querySelector('.trip-modal form');const name=form?.querySelector<HTMLInputElement>('[name=name]')?.value.trim();const start=form?.querySelector<HTMLInputElement>('[name=start]')?.value;const end=form?.querySelector<HTMLInputElement>('[name=end]')?.value;return Boolean(name&&start&&end&&end>=start);},text:'Enter a Trip name and choose two or three days under First day and Last day. Type MM/DD/YYYY or use the calendars. Leave a completed field or press Next to continue once the dates are valid.'},
  {title:'Choose the trip symbol',text:'Keep Symbol selected under the trip preview. Press Choose symbol to open the icon and emoji grid, where you will choose the logo for this trip.',target:'.trip-appearance-options [aria-label="Choose symbol"]',done:()=>Boolean(document.querySelector('.symbol-menu:not([inert])'))},
  {title:'Pick a symbol',text:'Select an icon from the grid, use the search above it, or switch to Emoji. Your selection becomes the trip logo and closes the picker.',target:'.symbol-menu',completeOn:'.symbol-menu .symbol-grid button'},
  {title:'Choose a color',completeOn:'.trip-appearance-options .color-swatches button',text:'Under Trip color, click a color swatch. For a photo logo later, choose Image instead of Symbol, upload a photo and confirm its crop.'},
  {title:'Choose lodging',done:c=>c.lodgingChosen,text:'Under Lodging location, search an address and select a result, or click the map. You can then edit the lodging pin name, color and symbol below the map.'},
  {title:'Create the trip',text:'Press Create trip at the bottom of this window. If it is disabled, check that you chose a lodging location (and uploaded an image if you selected Image).'},
 ],
 'Find and customize a place':[
  {title:'Position and name',blurOn:'.item-modal fieldset>.field input',ready:c=>Boolean(c.draft?.title?.trim()),text:'Edit Place name at the top. Your clicked position is already selected. To search instead, turn off Place pin on map, type in Place, street or address, and select a result.'},
  {title:'Note and appearance',blurOn:'.item-modal textarea',text:'Write a reminder in Place note. Below it, choose a Color swatch and open Choose symbol to select an icon or emoji.'},
  {title:'Save the place',text:'Press Create pin at the bottom. This saves a place on the map, rather than a home-page shortcut.'},
 ],
 'Link your schedule to a place':[
  {title:'Link a place',done:c=>Boolean(c.draft?.pinId),text:'Open Linked place below the date and time fields and choose the place you just saved. Its name, note, color and symbol fill the block; anything you customize yourself is kept when changing the linked place.'},
  {title:'Choose dates',blurOn:'.item-modal .date-field input',text:'Under Start date and End date, type a date or use each calendar button. Keep the same day for one activity, or choose a later End date to span days.'},
  {title:'Set the time',blurOn:'.segmented-time input',completeOn:'.time-picker-actions .primary',text:'Type hours and minutes in Starts at and Ends at. Or press the clock beside either field, scroll the Hours and Minutes wheels, then press Done. For an overnight activity, choose the following End date; 24:00 ends at midnight.'},
  {title:'Details and save',text:'Edit Title, Details, Color or Symbol if needed, then press Create time block at the bottom. The same block appears on each included day, clipped to that day; editing any part updates the shared block.'},
 ],
 'Connect a task to the plan':[
  {title:'Write the task',blurOn:'.task-modal fieldset>.field input',ready:c=>Boolean(c.draft?.title?.trim()),text:'In Task at the top, enter a short action such as Buy tickets. You will choose its place and activity links in the next step.'},
  {title:'Link and save',text:'Open Linked place and choose your saved place. In Linked time, choose the activity you created. Press Create task at the bottom; both links are optional in everyday use.'},
 ],
 'Add another place':[
  {title:'Choose another position',text:'If the checklist covers the map, press Close tasks first. In the map toolbar, choose Add pin on map, then click a second empty position. If its editor is already open, continue below.',done:c=>c.editKind==='pins'},
  {title:'Save the second place',text:'Give the second place a name in Place name, adjust its note or appearance if you want, and press Create pin.'},
 ],
 'Explore the map':[
  {title:'Move and zoom',text:'Drag the map to move it. Use + and − to zoom, or the compass to face north. On a phone, pinch to zoom and drag with one finger.'},
  {title:'Edit places and routes',text:'Click a marker to edit its place or use Delete to remove it. Connections lets you edit or delete routes. Close any editor before continuing; hiding and reopening the map keeps its view.'},
 ],
 'Navigate the trip dates':[
  {title:'Open the calendar',text:'Press the date in the top bar to open its calendar. Select a day, or close it and use the arrows beside the date. Dots mark dates belonging to trips; the legend scrolls if it has many trips.'},
  {title:'Check an overnight activity',text:'Move to another day covered by your block. The schedule runs from midnight to midnight and shows only that day’s portion. Click a block to edit it, or drag it to adjust its time; linked parts stay synchronized.'},
 ],
 'Arrange your workspace':[
  {title:'Show the panels you need',text:'Use Map, Schedule and Tasks in the top bar to show or hide each panel. If a control is in the overflow menu on your screen, open that menu to find it.'},
  {title:'Adjust the layout',text:'On a computer, drag the divider between Map and Schedule. Move the checklist by its header or resize its corner. On a phone, panels adapt to the available screen width.'},
 ],
 'Undo, redo and save':[
  {title:'Undo and redo',text:'Use Undo and Redo in the top bar to reverse or restore recent edits. Keyboard shortcuts are Ctrl+Z and Ctrl+Shift+Z.'},
  {title:'Save without waiting',text:'Press Save planning in the top bar, or Ctrl+S. Its dot turns amber during saving, and the small status at the bottom shows background work. You can keep planning while it saves.'},
 ],
 'Share and collaborate':[
  {title:'Trip settings',text:'In Trip details, use Edit trip dates and lodging to change its name, dates, appearance or lodging. Return to Trip details after reviewing the editor.'},
  {title:'Sharing and travelers',text:'The sharing controls create view-only or editor links; the travelers list manages who has access. Links and account changes are disabled in this practice trip. Close Trip details with its X to continue.'},
 ],
 'Pin a shortcut':[
  {title:'Open Create pin',text:'Under Pins on the home page, press Create pin. These shortcuts open a trip, a specific trip day, or a standalone date.',done:()=>Boolean(document.querySelector('.home-pin-modal:not([inert])'))},
  {title:'Choose what to pin',text:'Choose the shortcut type, select its trip or date, and press Create pin in this window. Use the three dots (or right-click) on a home card later to manage it.',target:'.home-pin-modal'},
 ],
 'Find your plans again':[
  {title:'Resume and recent plans',text:'The large Continue card opens your last planner view. Below, Recent dates opens a particular day and Recent trips opens a trip. Their three-dot menus let you manage those entries.'},
  {title:'Open all trips',text:'Press All trips beside the large Continue card to see every trip saved in this practice workspace.',target:'.home-browse-trips',completeOn:'.home-browse-trips'},
  {title:'Browse your trips',text:'Each card opens a trip. The three dots provide its edit and delete actions. Close All trips using its X to continue.',target:'.all-trips-modal',completeOn:'.all-trips-modal [aria-label="Close all trips"]'},
 ],
 'Choose your preferences':[
  {title:'Appearance',target:()=>document.querySelector('.dropdown-menu[aria-label="Appearance"]')?'.dropdown-menu[aria-label="Appearance"]':'.settings-modal [aria-label="Appearance"]',text:'Open Appearance and select Light, Dark or Automatic. Automatic follows your device. Choosing an option updates the preview immediately.',completeOn:'.dropdown-menu[aria-label="Appearance"] [role="option"]'},
  {title:'Accent color',target:'.settings-modal .color-picker',text:'Click an Accent color swatch. It colors site controls and your initial avatar; an uploaded profile photo stays unchanged. Advanced color selection offers a custom color.',completeOn:'.settings-modal .color-swatches button',blurOn:'.advanced-color-fields input'},
  {title:'Map starting view',target:()=>document.querySelector('.dropdown-menu[aria-label="Starting map view"]')?'.dropdown-menu[aria-label="Starting map view"]':'.settings-modal [aria-label="Starting map view"]',text:'Open Starting map view. Trip lodging starts at the lodging of your trip for that day; My current location uses your location. World map starts zoomed out. Choose A place I choose for a custom starting position.',completeOn:'.dropdown-menu[aria-label="Starting map view"] [role="option"]'},
  {title:'Custom starting position',text:'Press Choose starting location on map. Pan and zoom to the view you want, then press Use this map view. This substep is skipped automatically when you choose another starting mode.',target:c=>c.modal==='map-preference'?'.modal[aria-label="Starting map location"]':'.settings-modal',skipWhen:c=>c.mapStart!=='custom',completeOn:'.modal[aria-label="Starting map location"] .primary'},
  {title:'Clock and time zone',target:()=>document.querySelector('.dropdown-menu[aria-label="Clock"]')?'.dropdown-menu[aria-label="Clock"]':'.settings-modal [aria-label="Clock"]',text:'Open Clock to choose whether displayed time follows your trip lodging, your device or another available zone. The Active clock line shows the zone currently in use.',completeOn:'.dropdown-menu[aria-label="Clock"] [role="option"]'},
  {title:'Trip retention',target:'.settings-modal .checkbox-field',text:'Automatically remove old trips controls cleanup for your own account. Turn it off to keep trips indefinitely, or choose a period under Remove from my account after the trip ends. Other travelers keep their copies.',completeOn:'.settings-modal input[type="checkbox"],.dropdown-menu[aria-label="Remove from my account after the trip ends"] [role="option"]'},
  {title:'Profile and saving',target:'.settings-modal button.primary',text:'Display name and Choose image edit your profile. Manage sign-in methods handles account access and is disabled in practice. Press Save preferences; Guided tour at the bottom restarts this guide later.',completeOn:'.settings-modal button.primary'},
 ],
};
for(const stage of tourSteps)stage.instructions=instructions[stage.title];
const keyFor=(uid:string)=>`journas-guided-tour:practice-2026-10-17:${uid}`;
function remember(uid:string){if(seen(uid))return;void api('tour.seen').catch(()=>{});try{localStorage.setItem(keyFor(uid),'seen');}catch{/* The guide remains usable when storage is unavailable. */}}
function seen(uid:string){try{return Boolean(localStorage.getItem(keyFor(uid)));}catch{return false;}}
export default function GuidedTour({userId,ready,context,onHome,practice}:{practice:boolean;userId:string;ready:boolean;context:TourContext;onHome:()=>void}){
 const [status,setStatus]=useState<'closed'|'welcome'|'running'|'complete'>('closed'),[step,setStep]=useState(0),[part,setPart]=useState(0),[skipped,setSkipped]=useState<number[]>([]),[revision,refresh]=useState(0),[box,setBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 const card=useRef<HTMLElement>(null),[cardHeight,setCardHeight]=useState(250),[domModal,setDomModal]=useState(false),[banner,setBanner]=useState({x:12,y:12,embedded:false,height:43});
 const [viewport,setViewport]=useState(()=>({width:innerWidth,height:window.visualViewport?.height??innerHeight}));
 const mobile=viewport.width<=700,siteHeight=mobile?Math.round(viewport.height*2/3):viewport.height-banner.height-24;
 const guideWidth=Math.min(280,Math.max(200,viewport.width*.2));
 useLayoutEffect(()=>{const resize=()=>setViewport({width:innerWidth,height:window.visualViewport?.height??innerHeight});window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};},[]);
 useLayoutEffect(()=>{if(status==='closed'||!mobile)return;document.body.dataset.tourMobile='true';document.body.style.setProperty('--tour-site-height',`${siteHeight}px`);document.body.style.setProperty('--tour-panel-height',`${viewport.height-siteHeight}px`);return()=>{delete document.body.dataset.tourMobile;document.body.style.removeProperty('--tour-site-height');document.body.style.removeProperty('--tour-panel-height');};},[status,mobile,siteHeight,viewport.height,guideWidth,viewport.width]);

 const progress=useRef({step,part,context});progress.current={step,part,context};
 const inModal=status==='running'&&Boolean(context.modal||context.editKind||domModal);
 useLayoutEffect(()=>{const node=document.querySelector('.tour-banner');if(!node)return;const measure=()=>{const height=node.getBoundingClientRect().height;setBanner(previous=>previous.height===height?previous:{...previous,height});};const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[status,mobile]);
 useLayoutEffect(()=>{if(card.current)setCardHeight(card.current.getBoundingClientRect().height);},[status,step,part,inModal,viewport.width,banner.embedded]);
 useEffect(()=>{if(!card.current)return;const observer=new ResizeObserver(()=>setCardHeight(card.current?.getBoundingClientRect().height??250));observer.observe(card.current,{box:'border-box'});return()=>observer.disconnect();},[status,step,inModal]);
 const initialized=useRef('');const current=tourSteps[step];const instruction=current.instructions?.[part];
 useEffect(()=>{if(!ready||initialized.current===userId)return;if(practice){initialized.current=userId;setStatus('running');return;}if(seen(userId)){initialized.current=userId;return;}let live=true;void api<{seen:boolean}>('tour.status').then(result=>{if(!live)return;initialized.current=userId;if(result.seen){try{localStorage.setItem(keyFor(userId),'seen');}catch{}}if(!result.seen){remember(userId);onHome();setStatus('welcome');}}).catch(()=>{if(live&&!seen(userId)){initialized.current=userId;onHome();setStatus('welcome');}});return()=>{live=false;};},[ready,userId,practice]);
 useEffect(()=>{const start=()=>{onHome();setStep(0);setPart(0);setSkipped([]);setStatus('welcome');};window.addEventListener('journas-start-tour',start);return()=>window.removeEventListener('journas-start-tour',start);},[onHome]);
 const close=()=>{remember(userId);setStatus('closed');if(practice)window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));};
 useEffect(()=>{if(status!=='closed'){const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();remember(userId);setStatus('closed');if(practice)window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);}},[status,userId,practice]);
 const advanceStage=()=>{setPart(0);setSkipped([]);if(step===tourSteps.length-1)setStatus('complete');else setStep(value=>value+1);};
 const next=()=>{if(current.instructions&&part<current.instructions.length-1)setPart(value=>value+1);else advanceStage();};
 // DOM state is used only for explicitly named picker steps, never to choose an arbitrary popup.
 useEffect(()=>{if(status!=='running')return;let frame=0;const changed=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;refresh(value=>value+1);});};const observer=new MutationObserver(changed);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["inert","aria-hidden"]});document.addEventListener('input',changed);document.addEventListener('change',changed);return()=>{observer.disconnect();document.removeEventListener('input',changed);document.removeEventListener('change',changed);cancelAnimationFrame(frame);};},[status]);
 // Capture before React removes a selected popup; advance after its state update commits.
 useEffect(()=>{
  if(status!=='running')return;
  let frame=0;
  const eventDone=(event:Event)=>{const selector=event.type==='focusout'?instruction?.blurOn:instruction?.completeOn;if(!selector||!(event.target instanceof Element)||!event.target.closest(selector))return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const latest=progress.current;if(latest.step===step&&latest.part===part&&(!instruction?.ready||instruction.ready(latest.context)))next();});};
  document.addEventListener('click',eventDone,true);document.addEventListener('focusout',eventDone,true);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('click',eventDone,true);document.removeEventListener('focusout',eventDone,true);};
 },[status,step,part]);
 useEffect(()=>{if(status!=='running')return;if(current.done?.(context))advanceStage();else if(instruction?.skipWhen?.(context)){setSkipped(previous=>[...previous,part]);next();}else if(instruction?.done?.(context))next();},[status,step,part,context,revision]);
 const target=instruction?.target??current.target;const selector=typeof target==='function'?target(context):target;
 useEffect(()=>{
  if(status!=='running')return;let scrolled:Element|null=null;
  const find=()=>findTourTarget(selector);
  const place=(target:Element|null)=>{setDomModal(Boolean(document.querySelector('.modal-shade:not([inert]),.home-pin-modal')));
   if(!target){setBox(previous=>previous===null?previous:null);return;}
   const availableHeight=mobile?siteHeight:viewport.height;
   const rect=target.getBoundingClientRect();if(scrolled!==target&&(rect.bottom<80||rect.top>availableHeight-60||(mobile&&rect.height<availableHeight&&rect.bottom>availableHeight))){scrolled=target;target.scrollIntoView({block:'center',behavior:'instant'});}
   const r=target.getBoundingClientRect(),next={x:Math.max(4,r.left-6),y:Math.max(4,r.top-6),width:Math.min(innerWidth-8,r.width+12),height:Math.min(availableHeight-8,r.height+12)};
   next.width=Math.min(next.width,innerWidth-4-next.x);next.height=Math.max(0,Math.min(next.height,availableHeight-4-next.y));
   setBox(previous=>previous&&Object.keys(next).every(key=>Math.abs(previous[key as keyof typeof next]-next[key as keyof typeof next])<0.1)?previous:next);
  };
  return observeTourTarget(find,place);
 },[status,selector,step,cardHeight,inModal,mobile,siteHeight,viewport.height]);
 if(status==='closed')return null;
 const welcome=status==='welcome',complete=status==='complete',intro=welcome||complete;
 const opening=!intro&&box?`M${box.x+9} ${box.y}H${box.x+box.width-9}a9 9 0 0 1 9 9V${box.y+box.height-9}a9 9 0 0 1-9 9H${box.x+9}a9 9 0 0 1-9-9V${box.y+9}a9 9 0 0 1 9-9Z`:'';
 const preferredWidth=mobile?viewport.width:guideWidth;
 const obstacles=[...document.querySelectorAll('.modal:not([inert]),.bounded-popover:not([inert])')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
 const parentModal=document.querySelector('.modal:not([inert])')?.getBoundingClientRect();
 const placementTarget=parentModal?{x:parentModal.x,y:parentModal.y,width:parentModal.width,height:parentModal.height}:box;
 const position=mobile?{x:0,y:siteHeight,width:viewport.width}:intro?{x:(viewport.width-preferredWidth)/2,y:Math.max(12,(siteHeight-cardHeight)/2),width:preferredWidth}:tourCardPosition(placementTarget,preferredWidth,cardHeight,viewport.width,siteHeight,obstacles,preferredWidth);
 return createPortal(<div className="guided-tour" data-mobile={mobile} data-step={step} data-substep={part} data-modal={inModal} data-dock={inModal&&innerWidth>=1100?'side':'bottom'}>
  <svg className="tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="journas-tour-cutout"><rect width="100%" height="100%" fill="white"/>{!intro&&box&&<rect x={box.x} y={box.y} width={box.width} height={box.height} rx="9" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="#15102099" mask="url(#journas-tour-cutout)"/>{!intro&&box&&<rect className="tour-highlight" x={box.x} y={box.y} width={box.width} height={box.height} rx="9" fill="none" stroke="var(--accent)" strokeWidth="2"/>}</svg>
  <svg className="tour-interaction-shield" width="100%" height="100%" aria-hidden="true"><path d={`M0 0H${innerWidth}V${innerHeight}H0Z${opening}`} fill="transparent" fillRule="evenodd"/></svg>
  {!welcome&&<div className="tour-banner" role="status"><Compass size={17}/><strong>Guided tour</strong><button className="button settings-tour-button" onClick={close}>End tour</button></div>}
  {complete&&<div className="tour-confetti" aria-hidden="true">{Array.from({length:64},(_,i)=><i key={i} style={{'--spread':`${((i*37)%101-50)*.9}vw`,'--rise':`${-(58+(i*17)%33)}vh`,'--delay':`${(i%8)*.035}s`,'--turn':`${(i%2?1:-1)*(180+i*23)}deg`,background:['#8b5cf6','#22c55e','#eab308','#ec4899','#38bdf8'][i%5]} as React.CSSProperties}/>)}</div>}
  <MotionSurface key={`${status}:${step}`}><section ref={card} className="tour-card" role="dialog" aria-modal="false" aria-label="Journas guided tour" style={{left:position.x,top:position.y,width:position.width}}>
   <button className="icon tour-close" aria-label="Close guide" onClick={close}><X size={18}/></button>
   <div className="tour-eyebrow"><Compass size={17}/>{welcome?'Welcome to Journas':complete?'Tour complete':`Step ${step+1} of ${tourSteps.length}`}</div>
   <h2>{welcome?'Plan your first trip together':complete?'You’re ready to plan your next trip!':current.title}</h2>
   {!intro&&current.instructions&&<ol className="tour-substeps" aria-label="Steps in this window">{current.instructions.map((item,index)=><li key={item.title} className={index===part?'current':index<part?skipped.includes(index)?'skipped':'complete':''} aria-current={index===part?'step':undefined}>{index<part?<span aria-label={skipped.includes(index)?'Skipped':'Completed'}>{skipped.includes(index)?'–':'✓'}</span>:<span>{index+1}</span>}<span className="tour-substep-label" data-label={item.title}><span>{item.title}</span></span></li>)}</ol>}
   <div className="tour-variants">{(intro?[undefined]:current.instructions??[undefined]).map((item,index)=>{const active=intro||!current.instructions||index===part;return <div key={index} className="tour-variant" data-active={active} aria-hidden={!active} inert={!active}>
    <p aria-live={active?'polite':undefined}>{welcome?'Follow the highlights to try the map, schedule, tasks and sharing tools. This practice trip is not saved to your profile. Restart anytime with Guided tour at the bottom of Settings.':complete?'You can now plan with trips, places, schedules, tasks, sharing, home shortcuts and settings. Your practice workspace will be discarded when you finish.':item?.text??current.text}</p>
    {!intro&&!box&&<small>Open the highlighted panel to continue.</small>}
    <div className="tour-actions">{(intro||(!item?.done&&!item?.completeOn&&(!current.done||Boolean(current.instructions&&index<current.instructions.length-1))))&&<button className="button" disabled={!intro&&Boolean(active&&item?.ready&&!item.ready(context))} onClick={()=>{if(complete){close();return;}if(welcome){remember(userId);setStep(0);setPart(0);if(practice)setStatus('running');else{setStatus('closed');window.dispatchEvent(new CustomEvent('journas-practice',{detail:true}));}}else next();}}>{welcome?'Start guide':complete?'Finish tour':step===tourSteps.length-1&&(!current.instructions||index===current.instructions.length-1)?'Finish':'Next'}<ArrowRight size={15}/></button>}</div>
   </div>;})}</div>
  </section></MotionSurface>
 </div>,document.body);
}
