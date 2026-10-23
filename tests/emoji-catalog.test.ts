import{it,expect}from'vitest';import data from'emojibase-data/en/compact.json';import{completeEmojiCatalog}from'../src/emoji-catalog';
it('includes every base emoji and nested skin-tone sequence once, including components',()=>{const catalog=completeEmojiCatalog(data),unicode=new Set(catalog.map(e=>e.unicode));for(const entry of data){expect(unicode.has(entry.unicode)).toBe(true);for(const skin of entry.skins??[])expect(unicode.has(skin.unicode)).toBe(true);}expect(catalog.length).toBe(unicode.size);expect(catalog.length).toBeGreaterThan(3900);expect(catalog.some(e=>e.group===2)).toBe(true);expect(catalog.some(e=>e.unicode==='👍🏽')).toBe(true);});
it('preserves searchable parent keywords in skin variants and puts ungrouped components last',()=>{const catalog=completeEmojiCatalog([{unicode:'x',label:'component'},{unicode:'a',label:'hand',group:1,order:1,tags:['hello'],skins:[{unicode:'b',label:'hand variant',order:2}]}]);expect(catalog.map(e=>e.unicode)).toEqual(['a','b','x']);expect(catalog[1]).toMatchObject({group:1,tags:['hello']});});

import {emojiIsRenderable} from '../src/emoji-catalog';
it('hides missing glyphs and broken sequences, preserving supported native emoji',()=>{
 const raster=(id:number,width=32,color=false)=>({width,pixels:new Uint8ClampedArray([id,color?30:id,id,255])});
 const missing=raster(1),replacement=raster(2),face=raster(4,32,true),flag=raster(5,32,true);
 const draw=(text:string)=>text==='\u{10ffff}'?missing:text==='\ufffd'?replacement:text==='\u{1faeb}'?missing:text==='blank'?{width:0,pixels:new Uint8ClampedArray(4)}:text==='a\u200db'||text==='ab'?raster(6,64):text==='\u{1f1fa}\u{1f1f8}'?flag:face;
 expect(emojiIsRenderable('face',draw,32)).toBe(true);
 expect(emojiIsRenderable('\u{1faeb}',draw,32)).toBe(false);
 expect(emojiIsRenderable('blank',draw,32)).toBe(false);
 expect(emojiIsRenderable('a\u200db',draw,32)).toBe(false);
 expect(emojiIsRenderable('\u{1f1fa}\u{1f1f8}',draw,32)).toBe(true);
 expect(emojiIsRenderable('\u{1f1fa}\u{1f1f8}',()=>raster(8),32)).toBe(false);
});
it('rejects unjoined sequences and ignored flag tags even if their width fits',()=>{
 const pixels=new Uint8ClampedArray([22,66,88,255]),other=new Uint8ClampedArray([1,1,1,255]);
 const draw=(text:string)=>({width:32,pixels:text==='\u{10ffff}'||text==='\ufffd'?other:pixels});
 expect(emojiIsRenderable('a\u200db',draw,32)).toBe(false);
 expect(emojiIsRenderable('\u{1f3f4}\u{e0067}\u{e0062}\u{e007f}',draw,32)).toBe(false);
});

import versions from '../src/emoji-versions.json';
import fullData from 'emojibase-data/en/data.json';
it('keeps the native font release probes in sync with the installed emoji catalog',()=>{
 const lookup=versions as Record<string,number>;const visit=(entry:{emoji:string;version?:number;skins?:any[]})=>{expect(lookup[entry.emoji]).toBe(entry.version??0);for(const skin of entry.skins??[])visit(skin);};
 for(const entry of fullData)visit(entry);
 expect(Object.keys(lookup).length).toBe(completeEmojiCatalog(data).length);
});
