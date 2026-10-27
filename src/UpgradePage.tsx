import {useEffect,useState} from 'react';
import {sandboxCheckout} from './paddle-checkout';
import {plans,planIds,type PlanId} from '../shared/plans';
import {PlanIcon,PlanBadge} from './PlanBadge';
import {usePlan} from './plan-state';
import {api} from './firebase';
import {AsyncButton} from './AsyncButton';
const money=(cents:number,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100);
const benefits:Record<PlanId,string[]>={
 tourist:['Map, search, places and connections','Independent schedule and tasks','5 saved trips · up to 14 days each','Plan up to 1 year ahead · 5 travelers','Basic colors and Journas symbols','90-day retention · ads on eligible screens','No home pins, emoji or advanced colors','No linked items, place menus, copying or nearby highlights','No overlapping owned trips'],
 traveler:['No ads · 20 saved trips','Up to 60 days · plan 2 years ahead','Up to 10 travelers · 4 home pins','Linked schedule and tasks','Basic emoji and all supported skin tones','Place and connection menus · copy places','Nearby time-block highlights','365-day retention','No advanced colors, task highlights or overlapping trips'],
 adventurer:['100 saved trips · 8 home pins','Unlimited trip length, horizon and travelers','Advanced colors and full emoji catalog','Nearby task highlights','Overlapping owned trips','Unlimited retention'],
};
export default function UpgradePage({onClose}:{onClose:()=>void}){
 const {billing}=usePlan(),[annual,setAnnual]=useState(billing.interval==='year'),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState<any>(null);
 useEffect(()=>{
  let active=true;
  const completed=async()=>{setMessage('Payment received. Confirming your plan…');for(let attempt=0;attempt<8&&active;attempt++){try{const result:any=await api('billing.status');if(result.billing.source==='sandbox'){setMessage('Your plan is ready.');return;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}if(active)setMessage('Confirmation is still processing. Reopen this page shortly; access changes only after server confirmation.');};
  window.addEventListener('journas-checkout-completed',completed);
  const query=new URLSearchParams(location.search);
  if(query.get('manage')==='cancel')setMessage('To stop future charges, choose Switch to tourist below and confirm the change. Your paid access continues until the end of the period.');
  if(query.get('manage')==='downgrade')setMessage('To lower future charges, choose traveler below and confirm the change. Your current plan continues until the end of the paid period.');
  if(query.has('_ptxn'))void sandboxCheckout().catch(error=>{if(active)setMessage(error.message);});
  if(query.get('checkout')==='complete')void completed();
  return()=>{active=false;window.removeEventListener('journas-checkout-completed',completed);};
 },[]);
 async function run(plan:PlanId,confirm=false){setBusy(plan);setMessage('');try{
  const interval=annual?'year':'month';
  if(billing.source==='test'){setMessage('This is a fixed test-plan account. Use a separate billing account to test Sandbox checkout.');return;}
  if(billing.subscriptionId&&!['canceled','refunded'].includes(billing.status)){const result:any=await api(confirm?'billing.change-plan':'billing.preview-change',{plan,interval,...(confirm?{previewId:preview.previewId}:{})});if(confirm){setPreview(null);setMessage(result.pending?'Your change is scheduled for the end of the paid period.':'Payment is processing. Your plan updates after confirmation.');}else setPreview({...result,plan,interval});}
  else{if(plan==='tourist')return;const paddle=await sandboxCheckout();const result:any=await api('billing.checkout',{plan,interval});if(result.transactionId)paddle.Checkout.open({transactionId:result.transactionId});else throw new Error('Checkout is not ready. Please try again.');}
 }catch(error:any){setMessage(error.message);}finally{setBusy('');}}
 async function portal(){setBusy('portal');try{const result:any=await api('billing.portal');location.assign(result.url);}catch(error:any){setMessage(error.message);}finally{setBusy('');}}
 return <main className="upgrade-page"><div className="auth-map-background" aria-hidden="true"/><header><button className="button upgrade-back" type="button" onClick={onClose}>← Back to Journas</button></header><div className="upgrade-intro"><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>Make room for your adventures.</h1><div className="billing-switch" aria-label="Billing period"><button aria-pressed={!annual} onClick={()=>{setAnnual(false);setPreview(null);}}>Monthly</button><button aria-pressed={annual} onClick={()=>{setAnnual(true);setPreview(null);}}>Yearly · save 17%</button></div></div>
 <div className="plan-cards">{planIds.map((id,index)=>{const p=plans[id],price=annual?p.yearly:p.monthly;return <article className={`plan-card plan-${id}${billing.plan===id?' current':''}`} key={id}><PlanIcon plan={id} size={36}/><h2>{id}</h2>{billing.plan===id&&<span className="current-plan">Your plan</span>}<div className="plan-pricing"><p className="plan-price">{money(price)}<small>/{annual?'year':'month'}</small></p>{annual&&price>0&&<p className="annual-detail">{money(Math.round(price/12))}/month equivalent · save {money(p.monthly*12-p.yearly)}/year</p>}</div><p className="plan-inheritance">{index===0?'Start planning your next trip.':`Everything in ${planIds[index-1]}, and:`}</p><ul>{benefits[id].map(text=><li key={text}>{text}</li>)}</ul><AsyncButton className="button primary" pending={busy===id} disabled={Boolean(busy)||id===billing.plan&&(!billing.interval||billing.interval===(annual?'year':'month'))} onClick={()=>run(id)}>{id===billing.plan?(billing.interval&&billing.interval!==(annual?'year':'month')?`Switch to ${annual?'yearly':'monthly'}`:'Current plan'):id==='tourist'?'Switch to tourist':`Choose ${id}`}</AsyncButton></article>;})}</div>
 <p className="billing-disclosure">Annual plans are charged once per year. Taxes, if applicable, are shown before payment. Cancel renewal at any time; access continues through the paid period. Shared trip features may be included by the trip owner.</p>
 <section className="subscription-status"><PlanBadge plan={billing.plan}/><span>{billing.source==='test'?'Fixed test entitlement':billing.status}{billing.periodEnd?` · Period ends ${new Date(billing.periodEnd).toLocaleDateString()}`:''}{billing.pendingPlan?` · Scheduled: ${billing.pendingPlan}`:''}</span>{billing.subscriptionId&&<AsyncButton className="button" pending={busy==='portal'} onClick={portal}>Manage subscription</AsyncButton>}</section>
 {preview&&<section className="billing-preview" aria-label="Review plan change"><h2>Review your change</h2><p>{preview.plan} · {preview.interval} · Effective: {typeof preview.effectiveAt==='number'?new Date(preview.effectiveAt).toLocaleString():preview.effectiveAt}</p>{preview.preview?.update_summary&&<p>{preview.preview.update_summary.result?.action==='credit'?'Prorated credit':'Prorated charge'}: <strong>{money(Number(preview.preview.update_summary.result?.amount??0),preview.preview.update_summary.result?.currency_code??'USD')}</strong></p>}<AsyncButton className="button primary" pending={busy===preview.plan} onClick={()=>run(preview.plan,true)}>Confirm change</AsyncButton><button className="button" onClick={()=>setPreview(null)}>Keep current plan</button></section>}
 {message&&<p className="upgrade-message" role="status">{message}</p>}<footer><a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/refunds.html">Refunds</a></footer></main>;
}
