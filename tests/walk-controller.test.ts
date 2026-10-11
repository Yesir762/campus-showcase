import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalkController} from '../lib/walk-controller.ts';
import type {Navigation} from '../lib/walk-geometry.ts';
class Canvas extends EventTarget{focus(){}setPointerCapture(_id:number){}}
const nav:Navigation={calibrated:true,floorY:0,eyeHeight:1.6,radius:.25,speed:1.2,walkable:[[[-10,-10],[10,-10],[10,10],[-10,10]]],obstacles:[]};
const key=(name:string,value:string)=>{const e=new Event(name,{cancelable:true});Object.assign(e,{key:value});return e;};
test('pause, focus loss, keyup and pointer cancellation stop movement; disposal removes listeners',()=>{
 const win=new EventTarget(),doc=new EventTarget();Object.assign(doc,{hidden:false});Object.assign(globalThis,{window:win,document:doc});
 const el=new Canvas();const c=createWalkController(el as unknown as HTMLCanvasElement,nav,{camera:[0,1.6,0],target:[0,1.6,-1]});
 el.dispatchEvent(key('keydown','w'));assert.ok(c.update(.1).camera[2]<0);
 c.setPaused(true);const p=c.update(.1).camera;assert.deepEqual(c.update(.1).camera,p);
 c.setPaused(false);el.dispatchEvent(key('keydown','w'));win.dispatchEvent(new Event('blur'));assert.deepEqual(c.update(.1).camera,p);
 c.setMove(1,0);el.dispatchEvent(new Event('pointercancel'));assert.deepEqual(c.update(.1).camera,p);
 el.dispatchEvent(key('keydown','w'));win.dispatchEvent(key('keyup','w'));assert.deepEqual(c.update(.1).camera,p);
 el.dispatchEvent(key('keydown','w'));Object.assign(doc,{hidden:true});doc.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(c.update(.1).camera,p);
 c.destroy();el.dispatchEvent(key('keydown','w'));assert.deepEqual(c.update(.1).camera,p);
});
test('drag look keeps eye level, ignores second pointer, and valid teleport stops previous input',()=>{
 const win=new EventTarget(),doc=new EventTarget();Object.assign(doc,{hidden:false});Object.assign(globalThis,{window:win,document:doc});
 const el=new Canvas();const c=createWalkController(el as unknown as HTMLCanvasElement,nav,{camera:[0,1.6,0],target:[0,1.6,-1]});
 const pointer=(name:string,id:number,x:number,y:number)=>{const e=new Event(name);Object.assign(e,{pointerId:id,clientX:x,clientY:y});return e;};
 el.dispatchEvent(pointer('pointerdown',1,100,100));el.dispatchEvent(pointer('pointermove',1,160,30));const p=c.update(.1);
 assert.equal(p.camera[1],1.6);assert.ok(p.target[1]>1.6);
 el.dispatchEvent(pointer('pointerdown',2,10,10));el.dispatchEvent(pointer('pointermove',2,300,300));assert.deepEqual(c.update(.1),p);
 c.setMove(1,0);c.goToView([2,1.6,2],[2,1.6,1]);assert.deepEqual(c.update(.1).camera,[2,1.6,2]);
 assert.throws(()=>c.goToView([20,1.6,2],[20,1.6,1]));c.destroy();
});
