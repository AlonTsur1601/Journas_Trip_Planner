/** Complete, real calendar dates are clamped consistently for typed and picked input. */
export function boundedDate(value:string,min?:string,max?:string){
 const parsed=new Date(value+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)return value;
 return min&&value<min?min:max&&value>max?max:value;
}
