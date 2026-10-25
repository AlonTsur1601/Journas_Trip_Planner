import {expect,it} from 'vitest';
import {taskLinkLabels,blockTitle} from '../src/plan-labels';
import {connectionTitle} from '../src/connection-label';
import type {Block,Pin,Task,Connection} from '../src/types';
const pins=[{id:'trip-lodging',title:'Hotel'},{id:'p',title:'Gallery'}] as Pin[];
const connection={id:'c',from:'trip-lodging',to:'p',arrow:true,title:'Old hotel → Museum',titleSource:'linked'} as Connection;
const block:Block={id:'b',pinId:'p',title:'Museum',overrides:[],start:'09:00',end:'10:00',detail:'',color:'#06b6d4',symbol:'',versions:{}};
it('resolves inherited names against current places and connections',()=>{expect(blockTitle(block,pins,[connection])).toBe('Gallery');expect(connectionTitle(connection,pins)).toBe('Hotel → Gallery');});
it('deduplicates matching place and time block labels while retaining distinct labels',()=>{const task={pinId:'p',blockId:'b'} as Task;expect(taskLinkLabels(task,[block],pins,[connection])).toEqual(['Gallery']);expect(taskLinkLabels(task,[{...block,title:'Tickets',overrides:['title']}],pins,[connection])).toEqual(['Gallery','Tickets']);});
