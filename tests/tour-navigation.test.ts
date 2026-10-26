import {tripForDate} from '../src/map-start';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {it,expect,vi} from 'vitest';
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('async function switchDate(value:string){'),source.indexOf('  const readonly =',source.indexOf('async function switchDate(value:string){')));
const javascript=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
it('ignores attempts to leave the tutorial trip while preserving normal date navigation',async()=>{const trip={startDate:'2026-10-23',endDate:'2026-10-25'},showPlanner=vi.fn();const create=(practice:boolean)=>new Function('tripForDate','trips','lastTarget','practice','trip','shareTrip','date','showPlanner',javascript+';return switchDate;')(tripForDate,[trip],null,practice,trip,false,'2026-10-23',showPlanner);await create(true)('2026-10-26');expect(showPlanner).not.toHaveBeenCalled();await create(true)('2026-10-24');expect(showPlanner).toHaveBeenLastCalledWith(trip,'2026-10-24');await create(false)('2026-10-26');expect(showPlanner).toHaveBeenLastCalledWith(null,'2026-10-26');});
