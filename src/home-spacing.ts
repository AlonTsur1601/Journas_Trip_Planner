/** Restore the original gaps, then allow 24px more between the two sections. */
export function homeSpacingBudget(height:number,fullHeight:number,currentSpacing:number){
 return Math.floor(Math.max(0,Math.min(100,height-fullHeight+currentSpacing-1))*4)/4;
}
