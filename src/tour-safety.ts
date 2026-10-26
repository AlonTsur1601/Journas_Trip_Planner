/** Keep tutorial exploration inside the intended, recoverable sandbox flow. */
export const tourGuardEvents=['pointerdown','pointerup','click','dblclick','keydown','contextmenu'] as const;
export function tourClickAllowed(stage:string,target:Element){
 const within=(selector:string)=>Boolean(target.closest(selector));
 if(within('.guided-tour'))return true;
 if(within('.topbar .brand'))return stage==='Return home';
 if(within('a[href], .danger, [aria-label="Sign out"], .profile-trigger, .settings-footer .settings-tour-button, .account-methods-button, .photo-picker-button, .settings-shortcuts-button'))return false;
 if(within('.modal > header [aria-label^="Close"], .all-trips-modal [aria-label="Close all trips"]'))return false;
 if(within('.trip-selector [aria-label="Create trip"]'))return false;
 if(within('[aria-label="Undo"], [aria-label="Redo"]'))return false;
 if(within('.trip-selector [aria-label="Choose trip"]')&&stage!=='Choose a trip')return false;
 if(within('.dropdown-menu[aria-label="Choose trip"] [role="option"][aria-selected="false"]'))return false;
 if(within('.home-continue, .home-resume-card, .home-tile, .home-tile-main, .home-tile-menu, .home-context-menu, .all-trips-list'))return false;
 if(within('.topbar .brand')&&stage!=='Return home')return false;
 if(within('button[aria-label="Trip details"]')&&stage!=='View the trip details')return false;
 if(within('[aria-label="Close tasks"]')&&!['Arrange your workspace','Add another place'].includes(stage))return false;
 if(within('.home-create')&&stage!=='Start a simple trip')return false;
 if(within('.home-browse-trips')&&stage!=='Find your plans again')return false;
 if(within('.home-pin-create')&&stage!=='Pin a shortcut')return false;
 if(within('.home-account [aria-label="Settings"]')&&stage!=='Personalize Journas')return false;
 if(stage==='Check it off'&&within('.task-row button'))return false;
 if(stage==='Share and collaborate'&&within('.share-modal > .button:not(.primary)'))return false;
 if(within('.map-panel [aria-label="Add pin on map"]')&&!['Add your first place','Add another place'].includes(stage))return false;
 if(within('.map-panel [aria-label="Connect pins on map"]')&&stage!=='Connect your places')return false;
 if(within('.map-panel [aria-label="Connections"]')&&stage!=='Browse your connections')return false;
 if(within('.map-panel [aria-label="Places"]')&&stage!=='Browse your places')return false;
 if(stage==='Browse your places'&&within('.places-modal button[aria-label^="Edit place"]'))return false;
 if(stage==='Browse your connections'&&within('.connections-list button'))return false;
 if(stage==='Arrange your workspace'&&within('[aria-label="Map"], [aria-label="Schedule"]'))return false;
 if(within('.map-panel .map-pin')){
  if(stage!=='Connect your places')return false;
  if(!target.closest('.map-panel')?.querySelector('[aria-label="Connect pins on map"].active'))return false;
 }
 return true;
}
