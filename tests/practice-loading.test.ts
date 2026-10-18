import {afterEach,it,expect,vi} from 'vitest';
vi.mock('firebase/app',()=>({initializeApp:()=>({})}));
vi.mock('firebase/auth',()=>({initializeAuth:()=>null,connectAuthEmulator:vi.fn(),browserSessionPersistence:{},browserPopupRedirectResolver:{}}));
import {api} from '../src/firebase';
import {setPractice,getPracticeSession} from '../src/practice';
afterEach(()=>{setPractice(false);vi.unstubAllGlobals();});
it('opens an empty practice workspace without a network or authentication request',async()=>{const network=vi.fn();vi.stubGlobal('fetch',network);setPractice(true);const result=await api<any>('planner.restore',{date:'2026-10-18'});expect(result.trips).toEqual([]);expect(result.home.pins).toEqual([]);expect(result.restore).toBeNull();expect(network).not.toHaveBeenCalled();});
it('restores populated practice data through its isolated endpoint',async()=>{setPractice(true);const session=getPracticeSession()!;session.documents=[['users/qa',{tripCount:1}]];const network=vi.fn().mockResolvedValue({ok:true,json:async()=>({practiceResult:{trips:[{id:'practice-trip'}]},practiceDocuments:session.documents})});vi.stubGlobal('fetch',network);expect(await api('planner.restore',{date:'2026-10-18'})).toEqual({trips:[{id:'practice-trip'}]});expect(network).toHaveBeenCalledTimes(1);});
