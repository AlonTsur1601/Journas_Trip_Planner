import{beforeEach,it,expect,vi}from'vitest';
import{tourVersion,tourStorageKey,hasAcknowledgedTour}from'../src/tour-state';
const state=vi.hoisted(()=>({docs:new Map<string,any>()}));
vi.mock('../server/store.js',()=>({adminAuth:()=>({verifyIdToken:async()=>({uid:'qa',email_verified:true}),getUser:async()=>({email:'qa@example.test',emailVerified:true,disabled:false})}),firestoreStore:()=>({transaction:async(fn:any)=>fn({get:async(path:string)=>state.docs.get(path),set:(path:string,value:any)=>state.docs.set(path,value)})}),purgeExpiredRateLimits:vi.fn()}));
vi.mock('../server/service.js',()=>({JournasService:class{}}));
import{journasHandler}from'../server/http';
beforeEach(()=>{state.docs.clear();state.docs.set('users/qa',{verificationCampaign:'email-confirmation-2026-10-17',verifiedEmail:'qa@example.test',tourVersion});});
async function call(action:string){const res={setHeader:vi.fn(),end:vi.fn(),statusCode:0};await journasHandler({method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:{action},socket:{remoteAddress:'127.0.0.1'}}as any,res as any);expect(res.statusCode).toBe(200);return JSON.parse(res.end.mock.calls[0][0]);}
it('ignores the legacy flag until the user acknowledges the invitation',async()=>{expect(await call('tour.status')).toEqual({seen:false});expect(state.docs.get('users/qa').tourAcknowledged).toBeUndefined();expect(await call('tour.seen')).toEqual({seen:true});expect(await call('tour.status')).toEqual({seen:true});});
it('does not reuse a browser marker that was written before user interaction',()=>{expect(tourStorageKey('new-user')).not.toBe(`journas-guided-tour:${tourVersion}:new-user`);expect(tourStorageKey('new-user')).not.toBe(tourStorageKey('another-user'));});
it('requires a current, explicit decision',()=>{expect(hasAcknowledgedTour(null)).toBe(false);expect(hasAcknowledgedTour({tourVersion})).toBe(false);expect(hasAcknowledgedTour({tourVersion:'older',tourAcknowledged:true})).toBe(false);expect(hasAcknowledgedTour({tourVersion,tourAcknowledged:true})).toBe(true);});
