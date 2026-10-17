import type {Block} from './types';
/** The visible portion uses the same dated wall clock as the time block editor. */
export function blockRange(block:Pick<Block,'start'|'end'|'startDate'|'endDate'>,day:string){
  const first=block.startDate??day,last=block.endDate??first;
  return {start:day>first?'00:00':block.start,end:day<last?'24:00':block.end};
}
