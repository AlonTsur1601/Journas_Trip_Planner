import{expect,it}from'vitest';
import{matchesSearch}from'../src/SearchableList';
it('matches words across names, dates, notes and endpoints regardless of case or accents',()=>{
 expect(matchesSearch('PARIS 2026','A weekend in Paris','2026-10-24')).toBe(true);
 expect(matchesSearch('cafe ticket','Café Musée','Buy tickets here')).toBe(true);
 expect(matchesSearch('airport museum','Express','Airport','Museum')).toBe(true);
 expect(matchesSearch('  ','anything')).toBe(true);
 expect(matchesSearch('Rome','Paris','2026-10-24')).toBe(false);
 expect(matchesSearch('airport missing','Airport','Museum')).toBe(false);
 expect(matchesSearch('[','A [special] place')).toBe(true);
});
