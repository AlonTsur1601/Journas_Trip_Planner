import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {practiceExecute} from '../server/practice';
import {setPractice,getPracticeSession,practiceRequest,practiceLocal,practiceSession} from '../src/practice';
describe('temporary tutorial data',()=>{
 beforeEach(()=>vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-10-17T12:00:00Z')));
 afterEach(()=>vi.restoreAllMocks());
 it('creates a complete practice trip without any persistent store and restores its items',async()=>{const request={action:'trip.create',name:'Temporary',startDate:'2026-10-17',endDate:'2026-10-19',lodging:{name:'London',lng:0,lat:51},practiceDocuments:[]};let state=await practiceExecute('qa',request);const trip=state.practiceResult.trip as any;state=await practiceExecute('qa',{action:'item.patch',tripId:trip.id,date:'2026-10-17',kind:'pins',id:'pin',baseVersions:{},patch:{title:'Museum',note:'',color:'#123456',symbol:'icon:museum',lat:51,lng:0},practiceDocuments:state.practiceDocuments});const restored=await practiceExecute('qa',{action:'trip.get',tripId:trip.id,date:'2026-10-17',practiceDocuments:state.practiceDocuments});expect((restored.practiceResult.day as any).pins[0].title).toBe('Museum');expect((await practiceExecute('qa',{action:'trip.list',practiceDocuments:[]})).practiceResult.trips).toEqual([]);});
 it('does not issue real sharing links or account operations',async()=>{await expect(practiceExecute('qa',{action:'share.create',practiceDocuments:[]})).rejects.toMatchObject({code:'PRACTICE_ONLY'});await expect(practiceExecute('qa',{action:'auth.delete',practiceDocuments:[]})).rejects.toMatchObject({code:'PRACTICE_ONLY'});});
 it('discards all browser storage and isolates late requests from a new session',async()=>{setPractice(true);const old=getPracticeSession()!;practiceLocal.setItem('layout','draft');practiceSession.setItem('screen','draft');let release!:(value:any)=>void;const pending=practiceRequest(old,()=>new Promise(resolve=>{release=resolve;}));await Promise.resolve();setPractice(false);setPractice(true);const current=getPracticeSession()!;release({practiceResult:{ok:true},practiceDocuments:[['old',{}]]});await pending;expect(current.documents).toEqual([]);expect(practiceLocal.length).toBe(0);expect(practiceSession.length).toBe(0);setPractice(false);});
});

it('keeps the signed-in account identity while sandbox preference edits are discarded',async()=>{
 const profile={displayName:'Alex Rivers',photoURL:'https://example.test/avatar.png',theme:'dark' as const,accent:'#123456'};
 setPractice(true,'same-account',undefined,profile);const session=getPracticeSession()!;
 expect(session.profile).toEqual(profile);
 const before=await practiceExecute('same-account',{action:'planner.restore',date:'2026-10-23',practiceDocuments:session.documents});
 expect(before.practiceResult.settings).toMatchObject(profile);
 expect(new Map(before.practiceDocuments as any).has('users/same-account')).toBe(true);
 const changed=await practiceExecute('same-account',{action:'settings.save',settings:{accent:'#abcdef'},practiceDocuments:before.practiceDocuments});
 expect(session.profile).toEqual(profile);expect((changed.practiceResult.settings as any).accent).toBe('#abcdef');expect(profile.accent).toBe('#123456');
 setPractice(false);expect(getPracticeSession()).toBeNull();setPractice(true,'same-account',undefined,profile);
 const restarted=await practiceExecute('same-account',{action:'settings.get',practiceDocuments:getPracticeSession()!.documents});expect(restarted.practiceResult.settings).toMatchObject(profile);setPractice(false);
});
