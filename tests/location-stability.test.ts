import {expect,it} from 'vitest';
import {createLocationStabilizer} from '../src/location-stability';
const fix=(meters:number,accuracy=10)=>({lng:2.37,lat:48.85+meters/111195,accuracy});
it('keeps a stationary marker at the accepted coordinates through GPS jitter',()=>{
 const stabilize=createLocationStabilizer(),initial=stabilize(fix(0));
 for(const offset of [2,-4,7,1,-6,0])expect(stabilize(fix(offset))).toBe(initial);
});
it('uses the reported uncertainty to reject larger imprecise fluctuations',()=>{
 const stabilize=createLocationStabilizer(),initial=stabilize(fix(0,100));
 for(const offset of [30,-45,70,20])expect(stabilize(fix(offset,100))).toBe(initial);
});
it('does not move to an isolated GPS outlier',()=>{
 const stabilize=createLocationStabilizer(),initial=stabilize(fix(0));
 expect(stabilize(fix(120))).toBe(initial);expect(stabilize(fix(2))).toBe(initial);
 expect(stabilize(fix(120))).toBe(initial);
});
it('follows movement after two consistent readings outside the accuracy radius',()=>{
 const stabilize=createLocationStabilizer(),initial=stabilize(fix(0));
 expect(stabilize(fix(20))).toBe(initial);expect(stabilize(fix(24))).toEqual(fix(24));
});
it('corrects an imprecise first fix when a substantially better one arrives',()=>{
 const stabilize=createLocationStabilizer();stabilize(fix(0,200));
 expect(stabilize(fix(80,5))).toEqual(fix(80,5));
});
it('improves accuracy without shifting coordinates for a small correction',()=>{
 const stabilize=createLocationStabilizer();stabilize(fix(0,100));
 expect(stabilize(fix(3,5))).toEqual(fix(0,5));
});
it('ignores invalid coordinates and accuracy',()=>{
 const stabilize=createLocationStabilizer(),initial=stabilize(fix(0));
 expect(stabilize({...fix(0),lng:NaN})).toBe(initial);
 expect(stabilize({...fix(0),lat:91})).toBe(initial);
 expect(stabilize(fix(0,-1))).toBe(initial);
});
