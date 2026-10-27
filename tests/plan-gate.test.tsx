import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {plans} from '../shared/plans';
vi.mock('../src/plan-state',()=>({usePlan:()=>({personal:plans.tourist,effective:plans.tourist,practice:false}),openUpgrade:vi.fn()}));
import {PlanGate} from '../src/PlanGate';
describe('plan gate control boundaries',()=>{
 it('keeps the heading and tier marks outside the disabled dropdown hit area',()=>{
  const html=renderToStaticMarkup(<PlanGate feature="linkedPlanning"><div className="field"><span>Linked place</span><button>Choose place</button></div></PlanGate>);
  expect(html).toContain('Linked place<span class="plan-requirement plan-requirement-inline"');
  expect(html).toContain('class="plan-control"><div inert=""><button>Choose place</button></div>');
  expect(html).toContain('plan-traveler');expect(html).toContain('plan-adventurer');
 });
 it('uses the original button for a locked action without a field-sized overlay',()=>{
  const html=renderToStaticMarkup(<PlanGate feature="advancedColor"><button className="text-button">Advanced color</button></PlanGate>);
  expect(html.match(/<button/g)).toHaveLength(1);expect(html).not.toContain('plan-gate-hit');expect(html).toContain('Advanced color<span');
 });
});
