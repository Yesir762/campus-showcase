import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sceneSchema,resolveScene} from '../lib/scene-schema.ts';
const data=JSON.parse(fs.readFileSync(new URL('../config/scenes.json',import.meta.url),'utf8'));
const main=()=>structuredClone(data.scenes[0]);
test('all three scenes resolve, only main campus is enabled',()=>{
 const scenes=data.scenes.map((s:unknown)=>resolveScene(sceneSchema.parse(s)));
 assert.ok(scenes[0].version);assert.equal(scenes[1].version,null);assert.equal(scenes[2].version,null);
});
test('bad active version and binding mismatch fail closed without losing content',()=>{
 const s=main();s.bindings[s.activeVersion].sceneVersion='wrong';const result=resolveScene(sceneSchema.parse(s));
 assert.equal(result.version,null);assert.ok(result.definition.content.length);assert.match(result.issue!,/版本/);
 s.activeVersion='missing';assert.equal(resolveScene(sceneSchema.parse(s)).version,null);
});
test('invalid view links and duplicate variants disable only this scene',()=>{
 const s=main();s.bindings[s.activeVersion].locations=[{placeId:s.content[0].id,viewId:'missing'}];assert.equal(resolveScene(sceneSchema.parse(s)).version,null);
 const d=main();d.versions[d.activeVersion].variants.push(d.versions[d.activeVersion].variants[0]);assert.equal(resolveScene(sceneSchema.parse(d)).version,null);
});
test('museum requires calibration and every view inside boundaries',()=>{
 const s=main();s.kind='indoor';s.mode='walk';const b=s.bindings[s.activeVersion];b.navigation={calibrated:false,floorY:0,eyeHeight:1.6,radius:.25,speed:1.2,walkable:[[[0,0],[10,0],[10,10],[0,10]]],obstacles:[]};
 b.views=[{id:'entry',name:'入口',camera:[2,1.6,2],target:[2,1.6,1]}];b.camera.initialViewId='entry';
 assert.equal(resolveScene(sceneSchema.parse(s)).version,null);
 b.navigation.calibrated=true;assert.ok(resolveScene(sceneSchema.parse(s)).version);
 b.views[0].camera=[.1,1.6,2];assert.equal(resolveScene(sceneSchema.parse(s)).version,null);
});
test('rolling back selects matching old resource and bindings',()=>{
 const s=main();s.activeVersion='yujiatou-test-v1';const r=resolveScene(sceneSchema.parse(s));assert.ok(r.version);assert.match(r.version!.desktopUrl,/test-v1/);assert.equal(r.bindings!.sceneVersion,s.activeVersion);
});
