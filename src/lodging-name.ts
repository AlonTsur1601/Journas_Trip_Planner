/** A manually named lodging survives search, map moves and late reverse-geocoding. */
export function lodgingName(previous:string|undefined,incoming:string,manual:boolean){
 if(manual&&previous?.trim())return previous;
 return !incoming.trim()||/^(unnamed|unknown) location$/i.test(incoming.trim())?'Lodging':incoming;
}
