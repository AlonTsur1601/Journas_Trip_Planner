import {expect,it} from 'vitest';
import {blockIsNow,distanceMeters,nearbyActivities,nearbyTasks} from '../src/nearby-activity';
import type {Block,Pin,Task} from '../src/types';
const pin={id:'museum',lat:48.86,lng:2.34} as Pin;
const block={id:'visit',pinId:pin.id,start:'09:00',end:'10:00',timezone:'Europe/Paris'} as Block;
const position={lat:48.8601,lng:2.3401,accuracy:15};
const now=new Date('2026-10-23T07:30:00Z');
it('only highlights a nearby linked place during its allocated time',()=>{
 expect(nearbyActivities([block],[pin],'2026-10-23',position,now,'UTC')).toEqual({blockIds:['visit'],pinIds:['museum']});
 for(const [location,instant] of [[null,now],[{...position,lat:49},now],[position,new Date('2026-10-23T08:00:00Z')]] as const)
  expect(nearbyActivities([block],[pin],'2026-10-23',location,instant,'UTC').blockIds).toEqual([]);
 expect(nearbyActivities([block],[pin],'2026-10-24',position,now,'UTC').blockIds).toEqual([]);
});
it('uses exact stored instants for repeated hours and excludes the end boundary',()=>{
 const timed={...block,startEpoch:now.getTime(),endEpoch:now.getTime()+60000};
 expect(blockIsNow(timed,'2026-10-23',now,'UTC')).toBe(true);
 expect(blockIsNow(timed,'2026-10-23',new Date(now.getTime()+60000),'UTC')).toBe(false);
});
it('calculates real distances across the date line',()=>{
 expect(distanceMeters(pin,pin)).toBe(0);
 expect(distanceMeters({lat:0,lng:179.9999},{lat:0,lng:-179.9999})).toBeLessThan(30);
});
it('highlights open place tasks and uses the linked block time when present',()=>{
 const task={id:'tickets',pinId:pin.id,checked:false} as Task;
 expect(nearbyTasks([task],[block],[pin],'2026-10-23',position,now,'Europe/Paris').taskIds).toEqual(['tickets']);
 expect(nearbyTasks([{...task,checked:true}],[block],[pin],'2026-10-23',position,now,'Europe/Paris').taskIds).toEqual([]);
 expect(nearbyTasks([{...task,pinId:null,blockId:block.id}],[block],[pin],'2026-10-23',position,now,'Europe/Paris').taskIds).toEqual(['tickets']);
 expect(nearbyTasks([{...task,blockId:block.id}],[block],[pin],'2026-10-23',position,new Date('2026-10-23T08:30:00Z'),'Europe/Paris').taskIds).toEqual([]);
 expect(nearbyTasks([task],[block],[pin],'2026-10-24',position,now,'Europe/Paris').taskIds).toEqual([]);
});
