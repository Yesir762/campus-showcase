import test from 'node:test';
import assert from 'node:assert/strict';
import {isWalkable,moveWithinBounds,movementDelta} from '../lib/walk-geometry.ts';
import type {Navigation} from '../lib/walk-geometry.ts';
const nav:Navigation={calibrated:true,floorY:0,eyeHeight:1.6,radius:.25,speed:1.2,walkable:[[[0,0],[10,0],[10,10],[0,10]]],obstacles:[[[4,2],[4.05,2],[4.05,8],[4,8]]]};
test('radius keeps camera clear of walls, corners, and displays',()=>{
 assert.equal(isWalkable([.1,.1],nav),false);assert.equal(isWalkable([.25,.25],nav),true);
 assert.equal(isWalkable([3.9,5],nav),false);assert.equal(isWalkable([5,5],nav),true);
 assert.equal(isWalkable([2,2],{...nav,calibrated:false}),false);
});
test('a large displacement cannot cross a thin obstacle or exterior wall',()=>{
 const p=moveWithinBounds([2,5],[6,0],nav);assert.ok(p[0]<=3.75);assert.ok(isWalkable(p,nav));
 const outside=moveWithinBounds([2,1],[-10,0],nav);assert.ok(outside[0]>=.25-1e-7);
});
test('diagonal movement is normalized and slow frames are bounded',()=>{
 const direct=movementDelta([1,0],0,1.2,.1),diagonal=movementDelta([1,1],0,1.2,.1);
 assert.ok(Math.abs(Math.hypot(...direct)-Math.hypot(...diagonal))<1e-9);
 assert.ok(Math.hypot(...movementDelta([1,0],0,1.2,2))<=.120001);
});
test('narrow corridor refuses character when clearance is insufficient',()=>{
 assert.equal(isWalkable([.2,2],{...nav,walkable:[[[0,0],[.4,0],[.4,5],[0,5]]],obstacles:[]}),false);
});
