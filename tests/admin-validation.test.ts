import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resourceUrl,safePath,validateSourceHeader,passwordHash,verifyPassword,assertOrigin} from '../lib/admin/security.ts';
import {publishIssues} from '../lib/admin/validation.ts';
const data=JSON.parse(fs.readFileSync(new URL('../config/scenes.json',import.meta.url),'utf8'));
test('resource URLs exclude credentials, unsafe protocols, local IPs and traversal',()=>{
 for(const url of ['javascript:alert(1)','//evil.test/a','http://cdn.test/a','https://127.0.0.1/a','https://[::1]/a','https://u:p@cdn.test/a','/models/../secret','/\\evil.test/a'])assert.throws(()=>resourceUrl(url));
 assert.equal(resourceUrl('/models/test.sog'),'/models/test.sog');assert.equal(resourceUrl('https://cdn.example.com/model.sog'),'https://cdn.example.com/model.sog');for(const p of ['../a','a/../../b','/a','a//b','a\\b'])assert.throws(()=>safePath(p));
});
test('ordinary PLY is rejected, gaussian PLY and compressed PLY accepted',()=>{
 const encode=(s:string)=>new TextEncoder().encode(s);assert.throws(()=>validateSourceHeader('a.ply',encode('ply\nproperty float x\nend_header'),128),/普通点云/);
 const fields=['x','y','z','scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3','opacity'];assert.equal(validateSourceHeader('a.ply',encode('ply\n'+fields.map(x=>`property float ${x}\n`).join('')+'end_header'),256),'ply');
 assert.equal(validateSourceHeader('a.compressed.ply',encode('ply\nelement chunk 1\nproperty uint packed_position\nproperty uint packed_rotation\nproperty uint packed_scale\nproperty uint packed_color\nend_header'),256),'ply');
 assert.throws(()=>validateSourceHeader('fake.sog',encode('not zip'),8));assert.throws(()=>validateSourceHeader('a.splat',new Uint8Array(10),10));
});
test('password hashes use random salts and verify without storing plaintext',async()=>{const a=await passwordHash('correct horse battery staple'),b=await passwordHash('correct horse battery staple');assert.notEqual(a,b);assert.ok(await verifyPassword('correct horse battery staple',a));assert.equal(await verifyPassword('wrong',a),false);assert.ok(!a.includes('correct horse'));});
test('all write requests require same-origin and explicit request header',()=>{
 assert.throws(()=>assertOrigin(new Request('https://campus.test/api/admin/scenes',{headers:{origin:'https://evil.test','x-admin-request':'1'}})));
 assert.throws(()=>assertOrigin(new Request('https://campus.test/api/admin/scenes',{headers:{origin:'https://campus.test'}})));
 assert.doesNotThrow(()=>assertOrigin(new Request('https://campus.test/api/admin/scenes',{headers:{origin:'https://campus.test','x-admin-request':'1'}})));
});
test('publishing rejects conflicting hotspot distance and degenerate cameras',()=>{const s=structuredClone(data.scenes[0]);const b=s.bindings[s.activeVersion];b.locations=[{placeId:s.content[0].id,viewId:b.views[0].id}];b.markers=[{placeId:s.content[0].id,position:[0,0,0],minDistance:10,maxDistance:2}];assert.ok(publishIssues(s).some(x=>x.includes('距离')));b.markers=[];b.views[0].camera=b.views[0].target;assert.ok(publishIssues(s).some(x=>x.includes('重合')));});
test('self-intersecting, duplicate and degenerate indoor boundaries are rejected',async()=>{const {isSimplePolygon}=await import('../lib/walk-geometry.ts');assert.equal(isSimplePolygon([[0,0],[2,2],[0,2],[2,0]]),false);assert.equal(isSimplePolygon([[0,0],[1,0],[2,0]]),false);assert.equal(isSimplePolygon([[0,0],[2,0],[2,2],[0,2]]),true);});
