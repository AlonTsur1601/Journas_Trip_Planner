import {afterEach,it,expect,vi} from 'vitest';
vi.mock('firebase/app',()=>({initializeApp:()=>({})}));
vi.mock('firebase/auth',()=>({initializeAuth:()=>null,connectAuthEmulator:vi.fn(),browserLocalPersistence:{},browserSessionPersistence:{},browserPopupRedirectResolver:{}}));
const stored=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)}});
const {api}=await import('../src/firebase');
import {setPractice,getPracticeSession} from '../src/practice';
afterEach(()=>{setPractice(false);vi.unstubAllGlobals();});
it('opens an empty practice workspace without a network or authentication request',async()=>{const network=vi.fn();vi.stubGlobal('fetch',network);setPractice(true);const result=await api<any>('planner.restore',{date:'2026-10-18'});expect(result.trips).toEqual([]);expect(result.home.pins).toEqual([]);expect(result.restore).toBeNull();expect(network).not.toHaveBeenCalled();});
it('restores populated practice data through its isolated endpoint',async()=>{setPractice(true);const session=getPracticeSession()!;session.documents=[['users/qa',{tripCount:1}]];const network=vi.fn().mockResolvedValue({ok:true,json:async()=>({practiceResult:{trips:[{id:'practice-trip'}]},practiceDocuments:session.documents})});vi.stubGlobal('fetch',network);expect(await api('planner.restore',{date:'2026-10-18'})).toEqual({trips:[{id:'practice-trip'}]});expect(network).toHaveBeenCalledTimes(1);});

it('rejects tutorial sharing immediately without waiting for earlier work or network',async()=>{setPractice(true);const session=getPracticeSession()!;session.queue=new Promise(()=>{});const network=vi.fn();vi.stubGlobal('fetch',network);await expect(api('share.create',{tripId:'practice-trip',mode:'viewer'})).rejects.toMatchObject({code:'PRACTICE_ONLY',message:'Sharing is unavailable during the guided tutorial.'});expect(network).not.toHaveBeenCalled();});
