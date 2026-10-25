import type {Connection,Pin} from './types';
export function generatedConnectionTitle(connection:Pick<Connection,'from'|'to'|'arrow'>,pins:Pick<Pin,'id'|'title'>[]){
 return `${(pins.find(pin=>pin.id===connection.from)?.title??'Place').slice(0,90)} ${connection.arrow?'→':'—'} ${(pins.find(pin=>pin.id===connection.to)?.title??'Place').slice(0,90)}`;
}
export function connectionTitle(connection:Pick<Connection,'from'|'to'|'arrow'|'title'|'titleSource'>,pins:Pick<Pin,'id'|'title'>[]){
 return connection.titleSource==='linked'?generatedConnectionTitle(connection,pins):connection.title?.trim()||generatedConnectionTitle(connection,pins);
}
export function connectionTitleSource(connection:Pick<Connection,'from'|'to'|'arrow'|'title'|'titleSource'>,pins:Pick<Pin,'id'|'title'>[]){
 return connection.titleSource??(!connection.title?.trim()||connection.title===generatedConnectionTitle(connection,pins)?'linked':'custom');
}
