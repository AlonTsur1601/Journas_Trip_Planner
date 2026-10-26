import {it,expect} from 'vitest';
import {draftIsSaved} from '../src/draft-recovery';
import {emptyDay} from '../src/types';
it('recognizes already saved changes despite newer metadata and unrelated edits',()=>{
 const day=emptyDay();day.tasks=[{id:'t',title:'New',checked:false,pinId:null,blockId:null,versions:{title:3}}];
 expect(draftIsSaved({kind:'tasks',item:{id:'t',title:'New',checked:true,versions:{title:1}},base:{id:'t',title:'Old',checked:true}},day)).toBe(true);
});
it('retains a genuinely unsaved change',()=>{const day=emptyDay();day.tasks=[{id:'t',title:'Old',checked:false,pinId:null,blockId:null,versions:{}}];expect(draftIsSaved({kind:'tasks',item:{id:'t',title:'New'},base:{id:'t',title:'Old'}},day)).toBe(false);});
it('keeps unsaved new items and recognizes no-op existing drafts',()=>{const day=emptyDay();expect(draftIsSaved({kind:'tasks',item:{id:'t',title:'New'}},day)).toBe(false);day.tasks=[{id:'t',title:'Old',checked:false,pinId:null,blockId:null,versions:{}}];expect(draftIsSaved({kind:'tasks',item:{id:'t',title:'Old'},base:{id:'t',title:'Old'}},day)).toBe(true);});
