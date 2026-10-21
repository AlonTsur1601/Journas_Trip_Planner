import {it,expect} from 'vitest';
import {tourCardPosition,overlaps,tourBannerPosition} from '../src/tour-layout';
it('leaves a real gap beside a centered dialog without shifting it',()=>{const target={x:224,y:64,width:832,height:590};const result=tourCardPosition(target,340,400,1280,720,[target]);expect(overlaps(result,target,19)).toBe(false);expect(result.x+result.width).toBeLessThanOrEqual(1268);});
it('keeps floating guidance inside a narrow viewport',()=>{const result=tourCardPosition({x:8,y:16,width:374,height:810},366,300,390,844);expect(result.x).toBeGreaterThanOrEqual(12);expect(result.x+result.width).toBeLessThanOrEqual(378);expect(result.y+result.height).toBeLessThanOrEqual(832);});
it('moves the practice banner away from occupied controls',()=>{const obstacles=[{x:400,y:0,width:500,height:70}];const p=tourBannerPosition(300,40,1280,720,obstacles);expect(obstacles.every(r=>!overlaps({...p,width:300,height:40},r,8))).toBe(true);});

it('keeps a guide clear of a dropdown inside a large dialog',()=>{const menu={x:190,y:430,width:180,height:145};const parent={x:8,y:64,width:374,height:708};const card=tourCardPosition(menu,366,240,390,844,[parent,menu]);expect(overlaps(card,menu,19)).toBe(false);});
it('embeds the practice banner when the whole screen is occupied',()=>{expect(tourBannerPosition(232,44,390,844,[{x:0,y:0,width:390,height:844}]).embedded).toBe(true);});

it('preserves a grouped guide width when narrow side space would reflow its content',()=>{const target={x:224,y:64,width:832,height:590};const card=tourCardPosition(target,340,400,1280,720,[target],340);expect(card.width).toBe(340);expect(card.y+card.height).toBeLessThanOrEqual(708);});

it('fits a narrow guide beside every large dialog width without resizing the page',()=>{
 for(const vw of [1024,1280,1536])for(const nativeWidth of [640,760,820]){
  const width=Math.min(280,Math.max(200,vw*.2)),modalWidth=Math.min(nativeWidth,vw-2*(width+32));
  const modal={x:(vw-modalWidth)/2,y:40,width:modalWidth,height:600};
  const card=tourCardPosition(modal,width,420,vw,720,[modal],width);
  expect(card.width).toBe(width);expect(overlaps(card,modal,19)).toBe(false);
  expect(card.x+card.width).toBeLessThanOrEqual(vw-12);
 }
});
