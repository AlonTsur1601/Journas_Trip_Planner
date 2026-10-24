import {isBlackAccent} from './appearance-cache';

const rgb=(hex:string)=>{const value=hex.length===4?'#'+[...hex.slice(1)].map(c=>c+c).join(''):hex;return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);};
const linear=(n:number)=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
const luminance=(hex:string)=>rgb(hex).map(linear).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
export const colorContrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const distance=(a:string,b:string)=>Math.hypot(...rgb(a).map((n,i)=>n-rgb(b)[i]));
function hueColor(hue:number,lightness:number){const a=.85*Math.min(lightness,1-lightness);return '#'+[0,8,4].map(n=>{const k=(n+hue/30)%12;return Math.round(255*(lightness-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');}).join('');}

/** Legend and day markers use the same stable assignment on either background. */
export function calendarTripColors(trips:{id:string}[],accent:string,dark:boolean){
 const selected=dark&&isBlackAccent(accent)?'#ffffff':accent;
 const surface=dark?'#211f2d':'#ffffff';
 const regular=['#8b5cf6','#3b82f6','#06b6d4','#22c55e','#eab308','#f97316','#ef4444','#ec4899','#64748b','#292637'];
 const extra=Array.from({length:240},(_,i)=>hueColor(i*15%360,[.12,.18,.24,.3,.4,.5,.6,.7,.8,.88][Math.floor(i/24)]));
 const candidates=[...new Set([...regular,...extra])].filter(color=>colorContrast(color,selected)>=2.2&&colorContrast(color,surface)>=2.2&&distance(color,selected)>.45);
 const chosen:string[]=[],result:Record<string,string>={};
 for(const trip of [...trips].sort((a,b)=>a.id.localeCompare(b.id))){
  const available=candidates.filter(color=>!chosen.includes(color));
  const pool=available.length?available:candidates;
  const color=pool.reduce((best,candidate)=>Math.min(...[selected,...chosen].map(other=>distance(candidate,other)))>Math.min(...[selected,...chosen].map(other=>distance(best,other)))?candidate:best,pool[0]??(dark?'#facc15':'#075985'));
  result[trip.id]=color;chosen.push(color);
 }
 return result;
}
