import {getApp} from 'firebase/app';
import {connectFirestoreEmulator,getFirestore} from 'firebase/firestore';
export {collection,doc,onSnapshot} from 'firebase/firestore';
// The live database SDK is loaded only when an authenticated trip needs it.
export const db=getFirestore(getApp());
if(import.meta.env.DEV&&import.meta.env.VITE_USE_EMULATORS==='true')connectFirestoreEmulator(db,'127.0.0.1',8080);
