export type PlanId = 'tourist' | 'traveler' | 'adventurer';
export type Feature = 'linkedPlanning' | 'homePins' | 'placeMenus' | 'copyPlaces' | 'nearbyBlocks' | 'nearbyTasks' | 'advancedColor' | 'basicEmoji' | 'allEmoji';
export type Entitlements = {plan:PlanId; trips:number; days:number|null; horizonYears:number|null; members:number|null; homePins:number; retentionDays:number|null; overlaps:boolean; ads:boolean; features:Record<Feature,boolean>};
const features=(paid:boolean,full:boolean):Record<Feature,boolean>=>({linkedPlanning:paid,homePins:paid,placeMenus:paid,copyPlaces:paid,nearbyBlocks:paid,nearbyTasks:full,advancedColor:full,basicEmoji:paid,allEmoji:full});
export const plans:Record<PlanId,Entitlements & {monthly:number;yearly:number}>={
 tourist:{plan:'tourist',monthly:0,yearly:0,trips:5,days:14,horizonYears:1,members:5,homePins:0,retentionDays:90,overlaps:false,ads:true,features:features(false,false)},
 traveler:{plan:'traveler',monthly:499,yearly:4999,trips:20,days:60,horizonYears:2,members:10,homePins:4,retentionDays:365,overlaps:false,ads:false,features:features(true,false)},
 adventurer:{plan:'adventurer',monthly:999,yearly:9999,trips:100,days:null,horizonYears:null,members:null,homePins:8,retentionDays:null,overlaps:true,ads:false,features:features(true,true)},
};
export const planIds:PlanId[]=['tourist','traveler','adventurer'];
export const isPlan=(value:unknown):value is PlanId=>planIds.includes(value as PlanId);
export const requiredPlan=(feature:Feature):PlanId=>plans.traveler.features[feature]?'traveler':'adventurer';
export const basicColors=['#8b5cf6','#3b82f6','#06b6d4','#22c55e','#eab308','#f97316','#ef4444','#ec4899','#64748b','#292637','#7c5ce7','#2563eb','#059669','#ea580c','#0891b2','#ca8a04','#dc2626','#db2777','#475569'];
export const basicEmojiBases='😀 😎 🥳 😍 😂 😴 🤔 😅 👋 👍 👎 👏 🙌 🙏 💪 🤝 🚶 🏃 🧗 🏊 🏄 🚴 🧘 💃 🙋 🙅 🙆 🤷 🤦 🙇 🧑 🫶 🌅 🌄 🌈 ☀️ 🌤️ 🌧️ ❄️ 🌊 🍜 🍣 🥗 🥐 🍓 🥑 🍰 🥤 🎉 🎨 🎬 🎤 🎲 🎯 ⚽ 🏀 💡 💬 💤 💰 💳 🔋 📶 🆘'.split(' ');
const emojiKey=(value:string)=>value.replace(/[\uFE0E\uFE0F]|[\u{1F3FB}-\u{1F3FF}]/gu,'');
const basicEmojiKeys=new Set(basicEmojiBases.map(emojiKey));
basicEmojiKeys.add('🫱‍🫲');
export const isBasicEmoji=(value:string)=>basicEmojiKeys.has(emojiKey(value));
export const isJournasSymbol=(value:string)=>!value||/^icon:[a-z][a-z0-9-]{0,30}$/.test(value)||['★','●','◆','■','▲','✦','✧',''].includes(value);
export function addCalendarYears(day:string,years:number){const [y,m,d]=day.split('-').map(Number);const last=new Date(Date.UTC(y+years,m,0)).getUTCDate();return `${y+years}-${String(m).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;}
export type BillingStatus={plan:PlanId;source:'free'|'sandbox'|'test';status:string;periodEnd:number|null;pendingPlan:PlanId|null;pendingInterval?:'month'|'year'|null;paidChange?:{plan:PlanId;interval:'month'|'year';startsAt:number;periodEnd:number}|null;subscriptionId?:string;interval?:'month'|'year';graceUntil?:number;changedAt?:number;downgradedAt?:number};
export function billingStatus(user:Record<string,unknown>|undefined,now=Date.now()):BillingStatus{
 let raw=user?.billing as Partial<BillingStatus>|undefined;
 const paid=raw?.paidChange;
 if(paid&&isPlan(paid.plan)&&paid.startsAt<=now)raw={...raw,plan:paid.plan,interval:paid.interval,periodEnd:paid.periodEnd,pendingPlan:null,pendingInterval:null,paidChange:null,...(planIds.indexOf(paid.plan)<planIds.indexOf(raw!.plan!)?{downgradedAt:paid.startsAt}:{})};
 if(raw?.source==='test'&&isPlan(raw.plan))return {...raw,plan:raw.plan,source:'test',status:'active',periodEnd:null,pendingPlan:null};
 if(raw?.source==='sandbox'&&isPlan(raw.plan)){
  const end=Number(raw.periodEnd??0),pending=raw.pendingPlan;
  if(end>now)return {...raw,plan:raw.plan,source:'sandbox',status:raw.status??'active',periodEnd:end,pendingPlan:isPlan(pending)?pending:null};
  if(raw.status==='past_due'&&Number(raw.graceUntil)>now)return {...raw,plan:raw.plan,source:'sandbox',status:'past_due',periodEnd:end,pendingPlan:null};
 }
 return {...raw,plan:'tourist',source:'free',status:raw?.status==='canceled'||raw?.status==='refunded'?raw.status:'free',periodEnd:null,pendingPlan:null,paidChange:null,downgradedAt:Math.max(Number(raw?.downgradedAt??0),Number((raw?.status==='past_due'?raw.graceUntil:raw?.periodEnd)??0))||undefined};
}
