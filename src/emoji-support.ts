import type {EmojiChoice} from './emoji-catalog';
type EmojiRaster={width:number;pixels:Uint8ClampedArray;signature?:string;ink?:boolean;color?:boolean};
function sameRaster(a:EmojiRaster,b:EmojiRaster){return Math.abs(a.width-b.width)<.01&&(a.signature!==undefined&&b.signature!==undefined?a.signature===b.signature:a.pixels.length===b.pixels.length&&a.pixels.every((value,index)=>value===b.pixels[index]));}
// Check the device's emoji font: unsupported sequences can show several separate
// characters, missing-glyph boxes, or regional-indicator letters instead of a flag.
export function emojiIsRenderable(value:string,draw:(text:string)=>EmojiRaster,referenceWidth:number){
 const raster=draw(value);
 if(!(raster.ink??raster.pixels.some((value,index)=>index%4===3&&value>0))||raster.width>referenceWidth*1.5)return false;
 const parts=Array.from(value).filter(char=>char!=='\u200d'&&char!=='\ufe0f'&&!/[\u{e0020}-\u{e007f}]/u.test(char));
 for(const part of parts){if(sameRaster(draw(part),draw('\u{10ffff}'))||sameRaster(draw(part),draw('\ufffd')))return false;}
 if(value.includes('\u200d')&&sameRaster(raster,draw(value.replaceAll('\u200d',''))))return false;
 if(/[\u{1f1e6}-\u{1f1ff}]/u.test(value)&&!(raster.color??raster.pixels.some((channel,index)=>index%4===0&&raster.pixels[index+3]>0&&(channel!==raster.pixels[index+1]||channel!==raster.pixels[index+2]))))return false;
 if(/[\u{e0020}-\u{e007f}]/u.test(value)&&sameRaster(raster,draw(value.replace(/[\u{e0020}-\u{e007f}]/gu,''))))return false;
 return true;
}
async function scanRenderableEmoji(entries:EmojiChoice[],surface?:OffscreenCanvas){
 if(!surface&&typeof document==='undefined')return entries;
 const canvas=surface??document.createElement('canvas');const cellWidth=96,cellHeight=40,columns=8,batch=64;canvas.width=cellWidth*columns;canvas.height=cellHeight*(batch/columns);
 const context=canvas.getContext('2d',{willReadFrequently:true}) as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null;if(!context)return entries;
 context.font='24px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';context.textBaseline='top';context.fillStyle='#000';
 const texts=new Set<string>(['\u{10ffff}','\ufffd','\u{1f600}']);
 for(const entry of entries){texts.add(entry.unicode);for(const char of Array.from(entry.unicode))texts.add(char);if(entry.unicode.includes('\u200d'))texts.add(entry.unicode.replaceAll('\u200d',''));if(/[\u{e0020}-\u{e007f}]/u.test(entry.unicode))texts.add(entry.unicode.replace(/[\u{e0020}-\u{e007f}]/gu,''));}
 const all=[...texts],rasters=new Map<string,EmojiRaster>();
 // Batch native font rendering and readback, then retain compact fingerprints
 // rather than thousands of full pixel buffers.
 for(let offset=0;offset<all.length;offset+=batch){
  context.clearRect(0,0,canvas.width,canvas.height);const group=all.slice(offset,offset+batch);
  for(let index=0;index<group.length;index++){const x=index%columns*cellWidth,y=Math.floor(index/columns)*cellHeight;context.save();context.beginPath();context.rect(x,y,cellWidth,cellHeight);context.clip();context.fillText(group[index],x,y);context.restore();}
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  for(let index=0;index<group.length;index++){let ink=false,color=false,hash=2166136261,second=5381;const left=index%columns*cellWidth,top=Math.floor(index/columns)*cellHeight;for(let y=0;y<cellHeight;y++)for(let x=0;x<cellWidth;x++){const pixel=((top+y)*canvas.width+left+x)*4;if(pixels[pixel+3]){ink=true;color||=pixels[pixel]!==pixels[pixel+1]||pixels[pixel]!==pixels[pixel+2];}if(pixels[pixel+3]){hash=Math.imul(hash^(y*cellWidth+x),16777619);for(let channel=0;channel<4;channel++){hash=Math.imul(hash^pixels[pixel+channel],16777619);second=Math.imul(second,33)^pixels[pixel+channel];}}}rasters.set(group[index],{width:context.measureText(group[index]).width,pixels:new Uint8ClampedArray(0),signature:`${hash}:${second}`,ink,color});}
  if(!surface)await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 const draw=(text:string)=>rasters.get(text)!;const width=draw('\u{1f600}').width;
 return entries.filter(entry=>emojiIsRenderable(entry.unicode,draw,width));
}

export async function renderableEmojiCatalog(entries:EmojiChoice[],surface?:OffscreenCanvas){
 if(entries.some(entry=>entry.version===undefined))return scanRenderableEmoji(entries,surface);
 // Font releases normally add a complete Unicode batch. Probe each release
 // and sequence form; scan a failed release individually to keep supported
 // entries from partially implemented releases. Flags have separate OS support.
 const groups=new Map<number,EmojiChoice[]>();
 for(const entry of entries){const group=groups.get(entry.version!)??[];group.push(entry);groups.set(entry.version!,group);}
 const probes:EmojiChoice[]=[],byVersion=new Map<number,EmojiChoice[]>();
 for(const [version,group] of groups){const selected=[group.find(entry=>!entry.unicode.includes('\u200d')&&!/[\u{1f3fb}-\u{1f3ff}]/u.test(entry.unicode)),group.find(entry=>entry.unicode.includes('\u200d')),group.find(entry=>/[\u{1f3fb}-\u{1f3ff}]/u.test(entry.unicode))].filter((entry):entry is EmojiChoice=>Boolean(entry));byVersion.set(version,selected);probes.push(...selected);}
 const regional=entries.find(entry=>entry.unicode==='\u{1f1fa}\u{1f1f8}'),subdivision=entries.find(entry=>/[\u{e0020}-\u{e007f}]/u.test(entry.unicode));
 if(regional)probes.push(regional);if(subdivision)probes.push(subdivision);
 const supported=new Set((await scanRenderableEmoji(probes,surface)).map(entry=>entry.unicode));
 const regionalSupported=!regional||supported.has(regional.unicode),subdivisionSupported=!subdivision||supported.has(subdivision.unicode);
 const check:EmojiChoice[]=[],known=new Set<string>();
 for(const [version,group] of groups){const releaseSupported=byVersion.get(version)!.every(entry=>supported.has(entry.unicode));for(const entry of group){if(!regionalSupported&&/[\u{1f1e6}-\u{1f1ff}]/u.test(entry.unicode)||!subdivisionSupported&&/[\u{e0020}-\u{e007f}]/u.test(entry.unicode))continue;if(releaseSupported)known.add(entry.unicode);else check.push(entry);}}
 for(const entry of await scanRenderableEmoji(check,surface))known.add(entry.unicode);
 return entries.filter(entry=>known.has(entry.unicode));
}
