export const tourVersion='practice-2026-10-17';
export const tourStorageKey=(uid:string)=>`journas-guided-tour:${tourVersion}:acknowledged:${uid}`;
/** Legacy "seen" was written before any user interaction, so it is not a decision. */
export const hasAcknowledgedTour=(profile?:Record<string,unknown>|null)=>profile?.tourVersion===tourVersion&&profile.tourAcknowledged===true;
/** The restored account wins over a browser cache, including an explicit false. */
export const tourInvitationSeen=(profile:boolean|undefined,cached:boolean)=>profile??cached;
