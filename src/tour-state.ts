export const tourVersion='practice-2026-10-17';
export const tourStorageKey=(uid:string)=>`journas-guided-tour:${tourVersion}:acknowledged:${uid}`;
/** Legacy "seen" was written before any user interaction, so it is not a decision. */
export const hasAcknowledgedTour=(profile?:Record<string,unknown>|null)=>profile?.tourVersion===tourVersion&&profile.tourAcknowledged===true;
