import type {Connection} from './types';
export type PendingConnection={tripId:string;date:string;connection:Connection};
export function visibleConnections(saved:Connection[],pending:PendingConnection[],tripId:string|undefined,date:string){
 return [...saved,...pending.filter(item=>item.tripId===tripId&&item.date===date&&!saved.some(connection=>connection.id===item.connection.id)).map(item=>item.connection)];
}
