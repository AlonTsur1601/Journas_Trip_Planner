import {firestoreStore} from './store.js';
import {defaultSettings} from './types.js';
export async function accountEmailAccent(uid:string){const user=await firestoreStore().transaction(tx=>tx.get(`users/${uid}`));return (user?.settings as any)?.accent;}
export function applyEmailAccent(html:string,value:unknown){
 const accent=typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)?value:defaultSettings.accent;
 const rgb=[1,3,5].map(i=>parseInt(accent.slice(i,i+2),16));
 const mix=(light:number)=>'#'+rgb.map(v=>Math.round(light>=0?v+(255-v)*light:v*(1+light)).toString(16).padStart(2,'0')).join('');
 const linear=rgb.map(v=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4),luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
 const ink=luminance>.179?'#111111':'#ffffff';
 const colors:Record<string,string>={'#261c42':mix(-.72),'#f3f0fa':mix(.94),'#d7c9fa':mix(.78),'#eee9f6':mix(.88),'#8b5cf6':accent,'#7545cf':accent};
 return html.replace(/#[a-f0-9]{6}/gi,color=>colors[color.toLowerCase()]??color).replaceAll(`style="color:${accent};"`,`style="color:${luminance>.179?mix(-.5):accent};"`).replace(/(font-weight:bold;color:)#ffffff(;text-decoration:none)/g,`$1${ink}$2`);
}
