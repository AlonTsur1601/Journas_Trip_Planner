import {api} from './firebase';
type Paddle={Environment:{set:(environment:'sandbox')=>void};Initialize:(options:{token:string;checkout:{settings:{displayMode:'overlay';successUrl:string}};eventCallback:(event:{name:string})=>void})=>void;Checkout:{open:(options:{transactionId:string})=>void}};
declare global{interface Window{Paddle?:Paddle}}
let loading:Promise<Paddle>|null=null;
/** Only the public Sandbox client token reaches the browser. Server API credentials never do. */
export function sandboxCheckout(){
 if(loading)return loading;
 loading=(async()=>{
  const config=await api<{token:string;environment:string}>('billing.checkout-config');
  if(config.environment!=='sandbox'||!config.token.startsWith('test_'))throw new Error('Sandbox checkout is not configured.');
  if(!window.Paddle)await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.paddle.com/paddle/v2/paddle.js';script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error('Checkout could not load. Please try again.'));};document.head.append(script);});
  const paddle=window.Paddle;if(!paddle)throw new Error('Checkout could not load. Please try again.');
  paddle.Environment.set('sandbox');paddle.Initialize({token:config.token,checkout:{settings:{displayMode:'overlay',successUrl:`${location.origin}/upgrade?checkout=complete`}},eventCallback:event=>{if(event.name==='checkout.completed')window.dispatchEvent(new Event('journas-checkout-completed'));}});return paddle;
 })().catch(error=>{loading=null;throw error;});return loading;
}
