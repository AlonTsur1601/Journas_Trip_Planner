import {it,expect} from 'vitest';
import {homeSpacingBudget} from '../src/home-spacing';
it('restores every original gap when the full home fits',()=>{expect(homeSpacingBudget(980,760,0)).toBe(76);});
it('removes only the exact overflow from already expanded spacing',()=>{expect(homeSpacingBudget(735,800,76)).toBe(10);});
it('keeps the same budget regardless of the current spacing',()=>{expect(homeSpacingBudget(735,800,76)).toBe(homeSpacingBudget(735,724,0));});
it('never uses negative spacing or exceeds the original layout',()=>{expect(homeSpacingBudget(600,800,0)).toBe(0);expect(homeSpacingBudget(1200,800,76)).toBe(76);});
it('rounds down so fractional layout cannot create a scrollbar',()=>{const value=homeSpacingBudget(735,725.63,0);expect(value).toBe(8.25);expect(725.63+value).toBeLessThan(735);});
