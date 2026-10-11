import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pixelGrid,pixelRect} from '../lib/pixel-dissolve.ts';
test('grid covers the viewport within the cell budget at desktop and mobile sizes',()=>{
 for(const [w,h,mobile] of [[1456,1034,false],[390,844,true],[844,390,true],[7680,4320,false]] as const){
  const cells=pixelGrid(w,h,{x:0,y:0},mobile);
  assert.ok(cells.length<=768);assert.ok(Math.abs(cells.reduce((a,c)=>a+c.width*c.height,0)-w*h)<.01);
  assert.ok(cells.every(c=>c.width>0&&c.height>0&&c.delay+.4<1));
 }
});
test('dissolve starts near the click, remains deterministic, and ends transparent',()=>{
 const origin={x:0,y:0},cells=pixelGrid(960,480,origin,false);
 assert.deepEqual(cells,pixelGrid(960,480,origin,false));assert.ok(cells[0].delay<cells.at(-1)!.delay);
 assert.ok(cells.every(c=>pixelRect(c,0).opacity===1));
 assert.ok(cells.every(c=>pixelRect(c,1).opacity===0));
});
test('each pixel shrinks inward with non-increasing opacity and never reappears',()=>{
 for(const [w,h,mobile] of [[1440,900,false],[390,844,true]] as const){
  const cells=pixelGrid(w,h,{x:w*.2,y:h*.7},mobile);
  for(const cell of cells){
   let previous=pixelRect(cell,0);
   for(let frame=1;frame<=100;frame++){
    const next=pixelRect(cell,frame/100);
    assert.ok(next.width<=previous.width&&next.height<=previous.height&&next.opacity<=previous.opacity);
    assert.ok(next.x>=previous.x&&next.y>=previous.y);
    assert.ok(next.x+next.width<=previous.x+previous.width+1e-9);
    assert.ok(next.y+next.height<=previous.y+previous.height+1e-9);
    previous=next;
   }
   assert.equal(previous.width,0);assert.equal(previous.height,0);assert.equal(previous.opacity,0);
  }
 }
});
