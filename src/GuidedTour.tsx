import type {Settings} from "./types";
import {tourNeedsNext,tourInstructionComplete,tourSubstepDelay,tourStageReviewed} from './tour-progress';
import {findTourTarget,observeTourTarget} from './tour-target';
import {tourCardPosition,tourCardWidth} from './tour-layout';
import {tourSpotlight} from './tour-spotlight';
import {restingSurfaceRect} from './surface-motion';
import {tourStorageKey,tourInvitationSeen} from './tour-state';
import {MotionSurface} from './MotionSurface';
import {api} from './firebase';
import {tourClickAllowed} from './tour-safety';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Compass} from 'lucide-react';
export type TourContext={draft:Record<string,any>|null;lodgingChosen:boolean;mapStart:string;home:boolean;modal:string|null;editKind:string|null;editId:string|null;tripId:string|null;trips:number;pins:number;blocks:number;tasks:number;checkedTasks:number;connections:number;homePins:number;checklist:boolean;date:string};
type Instruction={title:string;text:string;target?:string|((context:TourContext)=>string);done?:(context:TourContext)=>boolean;skipWhen?:(context:TourContext)=>boolean;completeOn?:string;closeOnNext?:string;ready?:(context:TourContext)=>boolean;action?:string;actionEvents?:string[];gesture?:string};
type Step={title:string;text:string;target:string|((context:TourContext)=>string);done?:(context:TourContext)=>boolean;instructions?:Instruction[];informational?:boolean;closeOnNext?:string};
export const tourSteps:Step[]=[
 {title:'Start a simple trip',text:'Choose Create new trip. We will build a short itinerary together, using your own places and dates.',target:'.home-create',done:c=>c.modal==='new-trip'},
 {title:'Make the trip yours',text:'Give your trip a name and a date range. Choose a lodging location using search or the map. Pick a symbol and color, or upload and crop an image. For this tutorial, use a trip spanning two or three days, then choose Create trip.',target:'.trip-modal',done:c=>Boolean(c.tripId)&&!c.home&&c.modal!=='new-trip'},
 {title:'Choose a trip',informational:true,text:'The trip selector in the top bar lists your saved trips. Open it to see the choices. During the guided tutorial we stay with this tutorial trip; use Next step whenever you are ready.',target:()=>document.querySelector('.dropdown-menu[aria-label="Choose trip"]:not([inert])')?'.dropdown-menu[aria-label="Choose trip"]':'.trip-selector .dropdown',closeOnNext:'.trip-selector [aria-label="Choose trip"][aria-expanded="true"]'},
 {title:'Add your first place',text:'Choose Add pin on map, then click an empty spot on the map to open the place editor. Places on the map are separate from the shortcuts pinned to your home page.',target:'.map-panel',done:c=>c.editKind==='pins'&&c.editId!=='trip-lodging'},
 {title:'Find and customize a place',text:'Search for a place, or choose its position on the map. Give it a name, note, color and symbol, then choose Create pin.',target:'.item-modal',done:c=>c.pins>=1&&!c.editKind},
 {title:'Plan a time block',text:'Choose Add time block to put an activity on your schedule.',target:'[aria-label="Add time block"]',done:c=>c.editKind==='blocks'},
 {title:'Link your schedule to a place',text:'Choose your saved place under Linked place or connection. Its details are inherited until you customize a field yourself. Give the activity a name and start and end times for this day. Use the clock button for the time wheels; link the activity to a place or connection if useful. Choose Create time block.',target:'.item-modal',done:c=>c.blocks>=1&&!c.editKind},
 {title:'Open your checklist',text:'Turn on Tasks to keep a checklist alongside the map and schedule.',target:'[aria-label="Tasks"]',done:c=>c.checklist},
 {title:'Add a task',text:'Choose Add a task in your checklist.',target:'.todo-add',done:c=>c.editKind==='tasks'},
 {title:'Connect a task to the plan',text:'Write a task, such as Buy tickets. Optionally link it to a place or connection and a time block, then choose Create task. The task can then follow the activity in your itinerary.',target:'.task-modal',done:c=>c.tasks>=1&&!c.editKind},
 {title:'Check it off',text:'Mark your task as complete using its checkbox. The whole task is highlighted here; use its checkbox to finish this step. Outside the tutorial, clicking the text opens its editor, and you can uncheck the box later.',target:'.todo-panel .task-row:first-child',done:c=>c.checkedTasks>=1},
 {title:'Add another place',text:'Choose Add pin on map and click another empty spot, then save the second place. We will connect the two places next.',target:c=>c.editKind==='pins'?'.item-modal':c.checklist&&innerWidth<=700?'[aria-label="Close tasks"]':'.map-panel',done:c=>c.pins>=2&&!c.editKind},
 {title:'Connect your places',text:'Choose Connect pins on map, then click your two place markers. Arrow controls whether the connection has a direction. Connections opens the list where you can edit or remove routes.',target:'.map-panel',done:c=>c.connections>=1},
 {title:'Focus and navigate the map',informational:true,text:'The two focus buttons sit together: the location target finds you, and the bed returns to your lodging. Location access is needed for your position; a dim location button means it is unavailable. Focusing saves the new map view after the animation finishes. Use + and − to zoom; drag the expanding compass to rotate, or click it to reset north.',target:'.map-panel'},
 {title:'Browse your places',text:'Open Places in the separate list toolbar to find your saved places and lodging.',done:c=>c.modal!=='places',target:c=>c.modal==='places'?'.places-modal':'.map-list-tools [aria-label="Places"]'},
 {title:'Browse your connections',informational:true,closeOnNext:'.modal:has(.connections-list):not(.places-modal) > header [aria-label="Close"]',text:'Open Connections beside Places to see the routes between your markers. Each row shows its endpoints and offers Edit for its details. These list buttons are separate from the pin and connection creation tools. Use Next step to close this list.',target:c=>c.modal==='connections'?'.modal:has(.connections-list):not(.places-modal)':'.map-list-tools [aria-label="Connections"]'},
 {title:'Navigate the trip dates',informational:true,closeOnNext:'.date-button[aria-expanded="true"]',text:'Open the date button for the calendar, or use the arrows to change days. Days and months advance to the left. Colored dots identify trips, including on the selected date. The trip legend scrolls and choosing a trip jumps to its starting month. Each day has its own activities.',target:()=>document.querySelector('.calendar-popover:not([inert])')?'.calendar-popover':'.date-picker'},
 {title:'Arrange your workspace',informational:true,text:'Map, Schedule and Tasks can be shown or hidden. On a computer, drag the divider to resize the map and schedule, and move or resize the checklist.',target:'.view-controls'},
 {title:'Undo, redo and save',informational:true,text:'Undo and Redo are available in the top bar (Ctrl+Z and Ctrl+Shift+Z). Save planning or Ctrl+S saves without interrupting your work. The dot starts green and turns amber only during a manual save. Automatic saves, including the view saved after focusing the map, keep it green.',target:'.planning-history-actions'},
 {title:'View the trip details',text:'Open Trip details to manage the trip and collaboration.',target:'[aria-label="Trip details"]',done:c=>c.modal==='trip'},
 {title:'Share and collaborate',informational:true,closeOnNext:'.share-modal > header [aria-label="Close"]',text:'Here you can edit trip dates and lodging, create a view-only or editor sharing link, and manage travelers. Sharing links and account changes are disabled for this temporary tutorial trip. Close this window when you are ready.',target:'.share-modal'},
 {title:'Return home',text:'Choose the Journas logo to return to your personal home page. Your place in the planner is remembered.',target:'.topbar .brand',done:c=>c.home},
 {title:'Pin a shortcut',text:'Use Create pin to pin your trip, one trip day, or a date to the home page. Choose a type and save it. Right-click or use the three dots on a home card to manage shortcuts.',target:c=>document.querySelector('.home-pin-modal')?'.home-pin-modal':'.home-pins-section',done:c=>c.homePins>=1},
 {title:'Find your plans again',informational:true,closeOnNext:'.all-trips-modal [aria-label="Close all trips"]',text:'Continue resumes where you left off. Recent trips and dates reopen your plans; All trips lists every saved trip. Each card has an options menu.',target:()=>document.querySelector('.all-trips-modal:not([inert])')?'.all-trips-modal':'.home-featured'},
 {title:'Personalize Journas',text:'Open Settings to finish the tour with your preferences.',target:'.home-account [aria-label="Settings"]',done:c=>c.modal==='settings'},
 {title:'Choose your preferences',done:c=>c.modal!=='settings',text:'Choose a theme and accent, map starting view, clock and retention preferences. By default, trip dates use the lodging location and time zone; dates outside the trip use your current location and local time. Account settings manages your sign-in methods. Save changes if you adjust anything. To restart, open Settings and choose Guided tour at the bottom.',target:'.settings-modal'},
];
function editingTourFields(selector:string){return Boolean(document.activeElement?.closest(selector)||selector.includes('.date-field')&&document.querySelector('.field-calendar:not([inert]):not([data-motion-exit])')||selector.includes('.time-field')&&document.querySelector('.time-picker-popover:not([inert]):not([data-motion-exit])'));}
const instructions:Record<string,Instruction[]>={
 'Browse your places':[
  {title:'Open Places',text:'Open Places in the separate list toolbar. This list includes your lodging and all places for the current day.',completeOn:'.map-list-tools [aria-label="Places"]',ready:c=>c.modal==='places'},
  {title:'Focus a place',target:'.places-modal',text:'Press Focus beside any place. The list closes and the map moves smoothly to it, then saves the new view. Outside the guide, Edit opens the place details.'},
 ],
 'Browse your connections':[
  {title:'Open Connections',text:'Open Connections beside Places. These list buttons are separate from the pin and connection creation tools.',completeOn:'.map-list-tools [aria-label="Connections"]',ready:c=>c.modal==='connections'},
  {title:'Review the routes',target:'.modal:has(.connections-list):not(.places-modal)',text:'Each route shows its endpoints and any details you added. Outside the guide, Edit opens its editor; connections can also be linked to schedule activities and tasks. Choose Next step to close the list.',closeOnNext:'.modal:has(.connections-list):not(.places-modal) > header [aria-label="Close"]'},
 ],
 'Make the trip yours':[
  {title:'Trip name',action:'.trip-modal [name=name]',ready:()=>!editingTourFields('.trip-modal [name=name]')&&Boolean(document.querySelector<HTMLInputElement>('.trip-modal [name=name]')?.value.trim()),text:'Enter a Trip name at the top of the form. Use a name that will be easy to recognize on your home page. Finish entering the name, then leave the field to continue.'},
  {title:'Trip dates',action:'.trip-modal .date-field',ready:()=>{if(editingTourFields('.trip-modal .date-field'))return false;const form=document.querySelector('.trip-modal form');const start=form?.querySelector<HTMLInputElement>('[name=start]')?.value;const end=form?.querySelector<HTMLInputElement>('[name=end]')?.value;return Boolean(start&&end&&end>=start);},text:'Choose First day and Last day for your trip. For this guide, use two or three days. Type MM/DD/YYYY or use the calendars. Finish both dates, then leave the date fields to continue.'},
  {title:'Choose a trip symbol',action:'.trip-appearance-options .symbol-trigger',actionEvents:['click'],ready:()=>!document.querySelector('.symbol-menu[data-symbol-context="trip"]:not([inert]):not([data-motion-exit])'),text:'Open Choose symbol under the trip preview. Select an icon or emoji, or close the picker to keep the current symbol. You can search above the grid; the selected symbol becomes your trip logo.',completeOn:'.symbol-menu[data-symbol-context="trip"] .symbol-grid button'},
  {title:'Choose a color',action:'.advanced-color-fields',actionEvents:['input','change','pointerup','keydown'],ready:()=>!document.querySelector('.advanced-color-fields:not([inert]):not([data-motion-exit])'),completeOn:'.trip-appearance-options .color-swatches button',text:'Under Trip color, click a color swatch. For a photo logo later, choose Image instead of Symbol, upload a photo and confirm its crop.'},
  {title:'Choose lodging',action:'.trip-modal .location-picker',actionEvents:['click','change','journas-field-edit'],ready:c=>c.lodgingChosen,text:'Select a lodging location from search results or click the map. That completes this step. The suggested name, color and symbol can stay as they are; changing them is optional.'},
  {title:'Create the trip',text:'Press Create trip at the bottom of this window. If it is disabled, check that you chose a lodging location (and uploaded an image if you selected Image).'},
 ],
 'Find and customize a place':[
  {title:'Position and name',action:'.item-modal fieldset > .field:first-child input, .item-modal .location-picker .place-search input',ready:c=>!editingTourFields('.item-modal fieldset > .field:first-child input, .item-modal .location-picker .place-search input')&&Boolean(c.draft?.title?.trim()),text:'Review Place name, then leave the field. You can keep the suggested name; your clicked position is already selected. To change the position, search in Place, street or address and select a result, or choose a point on the map.'},
  {title:'Note and appearance',action:'.item-modal textarea, .item-modal .color-picker, .item-modal .symbol-picker, .advanced-color-fields',actionEvents:['input','change','focusout','click','pointerup','keydown'],ready:()=>!editingTourFields('.item-modal textarea, .item-modal .color-picker input')&&!document.querySelector('.bounded-popover:not([inert]):not([data-motion-exit])'),text:'Review Place note, Color or Symbol. Click a swatch or open the symbol picker, or focus the note and leave it when finished. Changes are optional; you can keep the suggested details.'},
  {title:'Save the place',text:'Press Create pin at the bottom. This saves a place on the map, rather than a home-page shortcut.'},
 ],
 'Link your schedule to a place':[
  {title:'Activity name',action:'.item-modal fieldset > .field:first-child input',ready:c=>!editingTourFields('.item-modal fieldset > .field:first-child input')&&Boolean(c.draft?.title?.trim()),text:'Review Title at the top and give the activity a useful name. Leave the field when finished. If the suggested name suits your plan, you can keep it.'},
  {title:'Set the time',action:'.item-modal .field:has(.time-field)',ready:c=>{if(editingTourFields('.item-modal .time-field'))return false;const start=c.draft?.start,end=c.draft?.end;return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start??'')&&/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end??'')&&end>start;},text:'Review Starts at and Ends at, then leave the time fields. You can keep their values. The clock button opens the time wheels. The value follows whichever hour and minute are closest to the center while you scroll. Hours run from 00 to 23; press Done to close the picker.'},
  {title:'Link a place or connection',action:'.item-modal [aria-label="Linked place or connection"], .dropdown-menu[aria-label="Linked place or connection"] [role="option"]',actionEvents:['click','focusout'],ready:()=>!document.querySelector('.dropdown-menu[aria-label="Linked place or connection"]:not([inert]):not([data-motion-exit])'),text:'Open Linked place or connection below the times. Choose a Place for one stop or a Connection for the route between two stops. You can keep Independent time block and close the list; a link is optional.'},
  {title:'Details and appearance',action:'.item-modal textarea, .item-modal .color-picker, .item-modal .symbol-picker, .advanced-color-fields',actionEvents:['focusin','focusout','click','input','change','pointerup','keydown'],ready:()=>!editingTourFields('.item-modal textarea, .advanced-color-fields input')&&!document.querySelector('.bounded-popover:not([inert]):not([data-motion-exit])'),text:'Review Details, Color or Symbol below the link. You can keep all three unchanged: focus Details and leave it, or open a picker and close it after reviewing.'},
  {title:'Create the time block',text:'Press Create time block at the bottom. The activity is saved on this day only. Its name and a valid time range are required; links, details and appearance changes are optional.'},
 ],
 'Connect a task to the plan':[
  {title:'Write the task',action:'.task-modal fieldset > .field:first-child input',ready:c=>!editingTourFields('.task-modal fieldset > .field:first-child input')&&Boolean(c.draft?.title?.trim()),text:'In Task at the top, enter a short action such as Buy tickets. You will choose its place and activity links in the next step.'},
  {title:'Link and save',text:'Linked place or connection can attach this task to one Place or to a Connection between two places. Linked time can attach it to an activity. Keep either link empty if you prefer, then press Create task.'},
 ],
 'Add another place':[
  {title:'Choose another position',text:'If the checklist covers the map, press Close tasks first. In the map toolbar, choose Add pin on map, then click a second empty position. If its editor is already open, continue below.',completeOn:'.map-panel .maplibregl-canvas, .map-panel [aria-label="Add pin on map"]',ready:c=>c.editKind==='pins'},
  {title:'Save the second place',text:'Give the second place a name in Place name, adjust its note or appearance if you want, and press Create pin.'},
 ],
 'Pin a shortcut':[
  {title:'Open Create pin',text:'Under Pins on the home page, press Create pin. These shortcuts open a trip, a specific trip day, or a standalone date.',completeOn:'.home-pin-create',ready:()=>Boolean(document.querySelector('.home-pin-modal:not([inert])'))},
  {title:'Choose what to pin',text:'Choose the shortcut type, select its trip or date, and press Create pin in this window. Use the three dots (or right-click) on a home card later to manage it.',target:'.home-pin-modal'},
 ],
 'Choose your preferences':[
  {title:'Appearance',target:()=>document.querySelector('.dropdown-menu[aria-label="Appearance"]')?'.dropdown-menu[aria-label="Appearance"]':'.settings-modal [aria-label="Appearance"]',text:'Open Appearance and select Light, Dark or Automatic. Automatic follows your device. Choosing an option updates the preview immediately, including the colorful dark map.',completeOn:'.dropdown-menu[aria-label="Appearance"] [role="option"]'},
  {title:'Accent color',action:'.advanced-color-fields',actionEvents:['input','change','pointerup','keydown'],ready:()=>!document.querySelector('.advanced-color-fields:not([inert]):not([data-motion-exit])'),completeOn:'.settings-modal .color-picker .color-swatches button',target:'.settings-modal .color-picker',text:'Click an Accent color swatch. It colors site controls, your location marker and your initial avatar; an uploaded profile photo stays unchanged. Advanced color selection offers a custom color.'},
  {title:'Map starting view',target:()=>document.querySelector('.dropdown-menu[aria-label="Starting map view"]')?'.dropdown-menu[aria-label="Starting map view"]':'.settings-modal [aria-label="Starting map view"]',text:'Open Starting map view. Trip lodging starts at the lodging of your trip for that day; My current location uses your location. World map starts zoomed out. Choose the view you want for newly opened dates.',completeOn:'.dropdown-menu[aria-label="Starting map view"] [role="option"]'},
  {title:'Clock and time zone',target:()=>document.querySelector('.dropdown-menu[aria-label="Clock"]')?'.dropdown-menu[aria-label="Clock"]':'.settings-modal [aria-label="Clock"]',text:'Open Clock and choose whether displayed time follows your trip lodging, your device or UTC. You can select the current option to keep it. The schedule also shows the time zone used for its activities.',completeOn:'.dropdown-menu[aria-label="Clock"] [role="option"]'},
  {title:'Trip retention',action:'.settings-modal .checkbox-field input',actionEvents:['focusout'],completeOn:'.settings-modal .checkbox-field input, .dropdown-menu[aria-label="Remove from my account after the trip ends"] [role="option"]',target:'.settings-modal .checkbox-field',text:'Review Automatically remove old trips and leave the checkbox when finished, or choose a cleanup period below. You can keep the current values. Turn automatic removal off to keep trips without a time limit. Other travelers keep their copies.'},
  {title:'Profile and saving',target:'.settings-modal button.primary',text:'Your account name, photo and sign-in methods stay unchanged during the guided tutorial. Press Save preferences: it saves and closes this window. The guide finishes after saving succeeds. Later, use Guided tour at the bottom of Settings to restart.'},
 ],
};
const connectionSteps=tourSteps.splice(tourSteps.findIndex(step=>step.title==='Add another place'),5);
tourSteps.splice(tourSteps.findIndex(step=>step.title==='Find and customize a place')+1,0,...connectionSteps);
for(const stage of tourSteps)stage.instructions=instructions[stage.title];
const keyFor=tourStorageKey;
function remember(uid:string){void api('tour.seen').catch(()=>{});try{localStorage.setItem(keyFor(uid),'seen');}catch{/* The guide remains usable when storage is unavailable. */}}
function seen(uid:string){try{return Boolean(localStorage.getItem(keyFor(uid)));}catch{return false;}}
export default function GuidedTour({userId,ready,context,onHome,practice,seenBefore,profileSettings}:{profileSettings?:Partial<Settings>;practice:boolean;userId:string;ready:boolean;context:TourContext;onHome:()=>void;seenBefore?:boolean}){
 const [status,setStatus]=useState<'closed'|'welcome'|'running'|'complete'>(()=>practice?'running':ready&&!tourInvitationSeen(seenBefore,seen(userId))?'welcome':'closed'),[step,setStep]=useState(0),[part,setPart]=useState(0),[skipped,setSkipped]=useState<number[]>([]),[revision,refresh]=useState(0),[box,setBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 const [acted,setActed]=useState<number[]>([]);
 const occluders=useRef<SVGGElement>(null);
 const outline=useRef<HTMLDivElement>(null),cutouts=useRef<SVGGElement>(null),shield=useRef<SVGPathElement>(null);
 const card=useRef<HTMLElement>(null),[cardHeight,setCardHeight]=useState(250),[domModal,setDomModal]=useState(false),[banner,setBanner]=useState({x:12,y:12,embedded:false,height:43});
 const [viewport,setViewport]=useState(()=>({width:innerWidth,height:window.visualViewport?.height??innerHeight}));
 const mobile=viewport.width<=700,siteHeight=mobile?Math.round(viewport.height*2/3):viewport.height-banner.height-24;
 useLayoutEffect(()=>{const resize=()=>setViewport({width:innerWidth,height:window.visualViewport?.height??innerHeight});window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};},[]);
 useLayoutEffect(()=>{if(status==='closed'||!mobile)return;document.body.dataset.tourMobile='true';document.body.style.setProperty('--tour-site-height',`${siteHeight}px`);document.body.style.setProperty('--tour-panel-height',`${viewport.height-siteHeight}px`);return()=>{delete document.body.dataset.tourMobile;document.body.style.removeProperty('--tour-site-height');document.body.style.removeProperty('--tour-panel-height');};},[status,mobile,siteHeight,viewport.height,viewport.width]);

 const inModal=status==='running'&&Boolean(context.modal||context.editKind||domModal);
 useLayoutEffect(()=>{const node=document.querySelector('.tour-banner');if(!node)return;const measure=()=>{const height=node.getBoundingClientRect().height;setBanner(previous=>previous.height===height?previous:{...previous,height});};const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[status,mobile]);
 useLayoutEffect(()=>{if(card.current)setCardHeight(card.current.getBoundingClientRect().height);},[status,step,part,inModal,viewport.width,banner.embedded]);
 useEffect(()=>{if(!card.current)return;const observer=new ResizeObserver(()=>setCardHeight(card.current?.getBoundingClientRect().height??250));observer.observe(card.current,{box:'border-box'});return()=>observer.disconnect();},[status,step,inModal]);
 const actionStage=useRef({step,status});actionStage.current={step,status};
 const initialized=useRef('');const current=tourSteps[step];const instruction=current.instructions?.[part];
 const target=instruction?.target??current.target;const selector=typeof target==='function'?target(context):target;
 const stageSelector=typeof current.target==='function'?current.target(context):current.target;
 useEffect(()=>{if(!ready||initialized.current===userId)return;if(practice){initialized.current=userId;setStatus('running');return;}if(tourInvitationSeen(seenBefore,seen(userId))){initialized.current=userId;return;}const apply=(acknowledged:boolean)=>{initialized.current=userId;if(acknowledged){try{localStorage.setItem(keyFor(userId),'seen');}catch{}setStatus('closed');}else{onHome();setStatus('welcome');}};if(seenBefore!==undefined){apply(seenBefore);return;}let live=true;void api<{seen:boolean}>('tour.status').then(result=>{if(live)apply(result.seen);}).catch(()=>{if(live)apply(seen(userId));});return()=>{live=false;};},[ready,userId,practice,seenBefore]);
 useEffect(()=>{const start=()=>{onHome();setStep(0);setPart(0);setSkipped([]);setActed([]);setStatus('welcome');};window.addEventListener('journas-start-tour',start);return()=>window.removeEventListener('journas-start-tour',start);},[onHome]);
 const close=()=>{remember(userId);setStatus('closed');if(practice)window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));};
 useEffect(()=>{if(status!=='running')return;const blockBackdrop=(event:MouseEvent)=>{if(event.target instanceof Element&&event.target.matches('.modal-shade')){event.preventDefault();event.stopPropagation();}};document.addEventListener('mousedown',blockBackdrop,true);return()=>document.removeEventListener('mousedown',blockBackdrop,true);},[status]);
 useEffect(()=>{if(status!=='closed'){const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();remember(userId);setStatus('closed');if(practice)window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);}},[status,userId,practice]);
 const closingFromGuide=useRef(false);
 const advanceStage=()=>{setPart(0);setSkipped([]);setActed([]);if(step===tourSteps.length-1){remember(userId);setStatus('complete');}else setStep(value=>value+1);};
 const next=()=>{if(current.instructions&&part<current.instructions.length-1)setPart(value=>value+1);else advanceStage();};
 useEffect(()=>{if(status!=='running')return;
  const guard=(event:Event)=>{if(!(event.target instanceof Element)||closingFromGuide.current)return;
   if(event.type==='keydown'){const key=event as KeyboardEvent;if((key.ctrlKey||key.metaKey)&&key.key.toLowerCase()==='z'){event.preventDefault();event.stopImmediatePropagation();return;}if(!['Enter',' '].includes(key.key))return;}
   const focus=findTourTarget(selector)??findTourTarget(stageSelector);
   const insideGuide=Boolean(event.target.closest('.guided-tour'));
   const insideFocus=Boolean(focus?.contains(event.target)||findTourTarget(stageSelector)?.contains(event.target)||event.target.closest('.bounded-popover:not([inert])'));
   if((!insideGuide&&!insideFocus)||!tourClickAllowed(current.title,event.target)){event.preventDefault();event.stopImmediatePropagation();}
  };
  for(const type of ['pointerdown','click','keydown','contextmenu'])document.addEventListener(type,guard,true);
  return()=>{for(const type of ['pointerdown','click','keydown','contextmenu'])document.removeEventListener(type,guard,true);};
 },[status,step,part,context,revision,selector,stageSelector]);
 // DOM state is used only for explicitly named picker steps, never to choose an arbitrary popup.
 useEffect(()=>{if(status!=='running')return;let frame=0;const changed=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;refresh(value=>value+1);});};const observer=new MutationObserver(changed);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["inert","aria-hidden"]});document.addEventListener('input',changed);document.addEventListener('change',changed);document.addEventListener('focusin',changed);document.addEventListener('focusout',changed);return()=>{observer.disconnect();document.removeEventListener('input',changed);document.removeEventListener('change',changed);document.removeEventListener('focusin',changed);document.removeEventListener('focusout',changed);cancelAnimationFrame(frame);};},[status]);
 // A form must stay open until its final instruction, even if Save is pressed early.
 useEffect(()=>{
  if(status!=='running'||!current.instructions||tourStageReviewed(current.instructions,acted,context))return;
  const selector=current.title==='Make the trip yours'?'.trip-modal form':current.title==='Choose your preferences'?'.settings-modal form':current.title==='Connect a task to the plan'?'.task-modal form':['Find and customize a place','Link your schedule to a place'].includes(current.title)?'.item-modal form':null;
  if(!selector)return;
  const guard=(event:Event)=>{if(!(event.target instanceof Element))return;const form=event.target.closest(selector);if(!form)return;if(event.type==='submit'||event.target.closest('button[type="submit"]')){event.preventDefault();event.stopPropagation();}};
  document.addEventListener('submit',guard,true);document.addEventListener('click',guard,true);
  return()=>{document.removeEventListener('submit',guard,true);document.removeEventListener('click',guard,true);};
 },[status,step,part,acted,context]);
 // Record the user's action before a picker disappears, even when done out of order.
 useEffect(()=>{
  if(status!=='running')return;
  const pending=new Set<number>();
  let pointer:{target:Element;x:number;y:number}|null=null;
  const record=(event:Event)=>{if(!(event.target instanceof Element)||event.target.closest(':disabled,[inert]'))return;const target=event.target;const previousPointer=pointer;if(event.type==='pointerdown')pointer={target,x:(event as PointerEvent).clientX,y:(event as PointerEvent).clientY};if(event.type==='pointerup'||event.type==='pointercancel')pointer=null;if(event.type==='keydown'&&!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes((event as KeyboardEvent).key))return;
   const indexes=(current.instructions??[]).flatMap((item,index)=>{
    const choice=event.type==='click'&&item.completeOn&&target.closest(item.completeOn);
    const interaction=item.action&&(item.actionEvents??['input','change','journas-field-edit','focusin','focusout']).includes(event.type)&&target.closest(item.action);
    const gesture=item.gesture&&((event.type==='wheel'&&((event as WheelEvent).deltaX||(event as WheelEvent).deltaY)&&target.closest(item.gesture))||(event.type==='pointerup'&&previousPointer&&Math.hypot((event as PointerEvent).clientX-previousPointer.x,(event as PointerEvent).clientY-previousPointer.y)>3&&previousPointer.target.closest(item.gesture)));
    return choice||interaction||gesture?[index]:[];
   });if(indexes.length){const frame=requestAnimationFrame(()=>{pending.delete(frame);if(actionStage.current.step===step&&actionStage.current.status==='running')setActed(previous=>[...new Set([...previous,...indexes])]);});pending.add(frame);}};
  const events=['click','input','change','journas-field-edit','focusin','focusout','pointerdown','pointerup','pointercancel','wheel','keydown'];
  for(const name of events)document.addEventListener(name,record,true);
  return()=>{for(const name of events)document.removeEventListener(name,record,true);for(const frame of pending)cancelAnimationFrame(frame);};
 },[status,step]);
 const autoDelay=status==='running'&&instruction&&current.instructions?tourSubstepDelay(instruction,part,current.instructions.length,acted,context):null;
 useLayoutEffect(()=>{if(status!=='running')return;if(tourStageReviewed(current.instructions,acted,context)&&current.done?.(context))advanceStage();else if(instruction?.skipWhen?.(context)){setSkipped(previous=>[...previous,part]);next();}else if(instruction?.done?.(context)||((instruction?.completeOn||instruction?.done)&&acted.includes(part)&&(!instruction.ready||instruction.ready(context)))||autoDelay===0)next();},[status,step,part,context,revision,acted,autoDelay]);
 useLayoutEffect(()=>setBox(null),[step,part]);
 useEffect(()=>{
  if(status!=='running'||!outline.current||!cutouts.current||!shield.current||!occluders.current)return;let scrolled:Element|null=null;
  const spotlight=tourSpotlight(outline.current,cutouts.current,shield.current,occluders.current);
  const find=()=>findTourTarget(selector)??findTourTarget(stageSelector);
  const place=(target:Element|null)=>{spotlight.place(target,mobile?siteHeight:viewport.height);setDomModal(Boolean(document.querySelector('.modal-shade:not([inert]),.home-pin-modal')));
   if(!target)return;
   const availableHeight=mobile?siteHeight:viewport.height;
   const rect=target.getBoundingClientRect();if(scrolled!==target&&(rect.bottom<80||rect.top>availableHeight-60||(mobile&&rect.height<availableHeight&&rect.bottom>availableHeight))){scrolled=target;target.scrollIntoView({block:'center',behavior:'instant'});}
   const r=restingSurfaceRect(target),next={x:Math.max(4,r.x-6),y:Math.max(4,r.y-6),width:Math.min(innerWidth-8,r.width+12),height:Math.min(availableHeight-8,r.height+12)};
   next.width=Math.min(next.width,innerWidth-4-next.x);next.height=Math.max(0,Math.min(next.height,availableHeight-4-next.y));
   setBox(previous=>previous&&Object.keys(next).every(key=>Math.abs(previous[key as keyof typeof next]-next[key as keyof typeof next])<0.1)?previous:next);
  };
  const stop=observeTourTarget(find,place);
  return()=>{stop();spotlight.stop();};
 },[status,selector,stageSelector,step,part,mobile,siteHeight,viewport.height]);
 if(status==='closed')return null;
 const welcome=status==='welcome',complete=status==='complete',intro=welcome||complete;
 const obstacles=[...document.querySelectorAll('.modal:not([inert]),.bounded-popover:not([inert])')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
 const parentModal=[...document.querySelectorAll('.modal')].filter(el=>!el.closest('[data-motion-exit]')).map(el=>el.getBoundingClientRect()).filter(rect=>rect.width>0).sort((a,b)=>b.width-a.width)[0];
 const placementTarget=parentModal?{x:parentModal.x,y:parentModal.y,width:parentModal.width,height:parentModal.height}:box;
 const preferredWidth=mobile?viewport.width:tourCardWidth(intro?null:placementTarget,viewport.width);
 const position=mobile?{x:0,y:siteHeight,width:viewport.width}:intro?{x:(viewport.width-preferredWidth)/2,y:Math.max(12,(siteHeight-cardHeight)/2),width:preferredWidth}:tourCardPosition(placementTarget,preferredWidth,cardHeight,viewport.width,siteHeight,obstacles,preferredWidth);
 return createPortal(<div className="guided-tour" data-mobile={mobile} data-stage={current.title} data-step={step} data-substep={part} data-modal={inModal} data-dock={inModal&&innerWidth>=1100?'side':'bottom'}>
  <svg className="tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="journas-tour-cutout"><rect width="100%" height="100%" fill="white"/><g ref={cutouts}/></mask><mask id="journas-tour-focus-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={viewport.width} height={viewport.height}><rect width="100%" height="100%" fill="white"/><g ref={occluders}/></mask></defs><rect width="100%" height="100%" fill="#15102099" mask="url(#journas-tour-cutout)"/></svg>
  <div className="tour-focus-clip" style={{mask:"url(#journas-tour-focus-mask)"}} aria-hidden="true"><div ref={outline} className="tour-highlight" hidden={intro||!box}><span className="tour-highlight-glow"/></div></div>
  <svg className="tour-interaction-shield" width="100%" height="100%" aria-hidden="true"><path ref={shield} d={intro?`M0 0H${innerWidth}V${innerHeight}H0Z`:undefined} fill="transparent" fillRule="evenodd"/></svg>
  {<div className="tour-banner" role="status"><Compass size={17}/><strong>Guided tour</strong><button className="button settings-tour-button" onClick={close}>End tour</button></div>}
  {complete&&<div className="tour-confetti" aria-hidden="true">{Array.from({length:64},(_,i)=><i key={i} style={{'--spread':`${((i*37)%101-50)*.9}vw`,'--rise':`${-(58+(i*17)%33)}vh`,'--delay':`${(i%8)*.035}s`,'--turn':`${(i%2?1:-1)*(180+i*23)}deg`,background:['#8b5cf6','#22c55e','#eab308','#ec4899','#38bdf8'][i%5]} as React.CSSProperties}/>)}</div>}
  <MotionSurface key={`${status}:${step}`}><section ref={card} className="tour-card" role="dialog" aria-modal="false" aria-label="Journas guided tour" style={{left:position.x,top:position.y,width:position.width}}>
   <div className="tour-eyebrow"><Compass size={17}/>{welcome?'Welcome to Journas':complete?'Tour complete':`Step ${step+1} of ${tourSteps.length}`}</div>
   <h2>{welcome?'Plan your first trip together':complete?'You’re ready to plan your next trip!':current.title}</h2>
   {!intro&&current.instructions&&<ol className="tour-substeps" aria-label="Steps in this window">{current.instructions.map((item,index)=>{const complete=!skipped.includes(index)&&tourInstructionComplete(item,index,part,acted,context);return <li key={item.title} className={[index===part?'current':'',skipped.includes(index)?'skipped':complete?'complete':''].filter(Boolean).join(' ')} aria-current={index===part?'step':undefined}>{complete||skipped.includes(index)?<span aria-label={skipped.includes(index)?'Skipped':'Completed'}>{skipped.includes(index)?'–':'✓'}</span>:<span>{index+1}</span>}<span className="tour-substep-label" data-label={item.title}><span>{item.title}</span></span></li>;})}</ol>}
   <div className="tour-variants">{(intro?[undefined]:current.instructions??[undefined]).map((item,index)=>{const active=intro||!current.instructions||index===part;return <div key={index} className="tour-variant" data-active={active} aria-hidden={!active} inert={!active}>
    <p aria-live={active?'polite':undefined}>{welcome?<>Follow the highlights to try the map, schedule, tasks and sharing tools. <strong>This tutorial trip is not saved to your profile.</strong> Restart anytime with Guided tour at the bottom of Settings.</>:complete?'You can now plan with trips, places, schedules, tasks, sharing, home shortcuts and settings. Your tutorial workspace will be discarded when you finish.':item?.text??current.text}</p>
    {!intro&&!box&&<small>Open the highlighted panel to continue.</small>}
    <div className="tour-actions">{(intro||tourNeedsNext(current,item,index))&&<button className={intro?"button":"button primary"} disabled={!intro&&Boolean(active&&((item?.ready&&!item.ready(context))||(item?.action&&!acted.includes(index))))} onClick={()=>{if(item?.closeOnNext||current.closeOnNext){closingFromGuide.current=true;try{document.querySelector<HTMLButtonElement>((item?.closeOnNext??current.closeOnNext)!)?.click();}finally{closingFromGuide.current=false;}if(!current.done)next();return;}if(complete){close();return;}if(welcome){setStep(0);setPart(0);if(practice)setStatus('running');else{setStatus('closed');window.dispatchEvent(new CustomEvent('journas-practice',{detail:{active:true,profile:profileSettings}}));}}else next();}}>{welcome?'Start guide':complete?'Finish tour':step===tourSteps.length-1&&(!current.instructions||index===current.instructions.length-1)?'Finish tour':'Next step'}<ArrowRight size={15}/></button>}</div>
   </div>;})}</div>
  </section></MotionSurface>
 </div>,document.body);
}
