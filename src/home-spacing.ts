/** Restore the original spacing, removing only the amount a full home needs. */
export function homeSpacingBudget(height:number,fullHeight:number,currentSpacing:number){
 return Math.floor(Math.max(0,Math.min(76,height-fullHeight+currentSpacing-1))*4)/4;
}
