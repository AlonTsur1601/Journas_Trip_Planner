import {connectionTitle} from './connection-label';
import type {Block,Connection,Pin,Task} from './types';
export function blockTitle(block:Block,pins:Pin[],connections:Connection[]){
 if(block.overrides.includes('title'))return block.title;
 const pin=pins.find(pin=>pin.id===block.pinId),connection=connections.find(connection=>connection.id===block.connectionId);
 return pin?.title??(connection?connectionTitle(connection,pins):block.title);
}
export function taskLinkLabels(task:Task,blocks:Block[],pins:Pin[],connections:Connection[]){
 const pin=pins.find(pin=>pin.id===task.pinId),connection=connections.find(connection=>connection.id===task.connectionId),block=blocks.find(block=>block.id===task.blockId);
 return [...new Set([pin?.title,connection?connectionTitle(connection,pins):undefined,block?blockTitle(block,pins,connections):undefined].filter((title):title is string=>Boolean(title)))];
}
