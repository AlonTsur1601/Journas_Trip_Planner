import type {Connection,Pin} from './types';
export function connectionTitle(connection:Pick<Connection,'from'|'to'|'arrow'|'title'>,pins:Pick<Pin,'id'|'title'>[]){
 return connection.title?.trim()||`${(pins.find(pin=>pin.id===connection.from)?.title??'Place').slice(0,90)} ${connection.arrow?'→':'—'} ${(pins.find(pin=>pin.id===connection.to)?.title??'Place').slice(0,90)}`;
}
