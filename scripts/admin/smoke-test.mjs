import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.ADMIN_TEST_URL??'http://127.0.0.1:5173';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('This mutating smoke test is restricted to a local, disposable preview.');
const username=process.env.ADMIN_TEST_USERNAME,password=process.env.ADMIN_TEST_PASSWORD;
if(!username||!password)throw Error('Set ADMIN_TEST_USERNAME and ADMIN_TEST_PASSWORD for an existing local test administrator.');let cookie='';
async function call(path,method='GET',data,expected=200){const r=await fetch(`${base}/api/admin/${path}`,{method,headers:{Origin:base,'X-Admin-Request':'1',Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const result=await r.json();assert.equal(r.status,expected,`${path}: ${JSON.stringify(result)}`);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return result;}
await call('scenes','GET',undefined,401);await call('login','POST',{username,password});const id=`smoke-${randomUUID().slice(0,8)}`;
try{
 const scene={id,title:'本地集成验证',summary:'original',kind:'outdoor',mode:'orbit',availability:'pending',poster:'/campus-scan-placeholder.jpg',posterAlt:'测试',activeVersion:null,versions:{},bindings:{},content:[]};await call('scenes','POST',{scene});await call(`scenes/${id}/publish`,'POST',{revision:1});
 scene.summary='draft only';let r=await call(`scenes/${id}`,'PUT',{scene,revision:2});await call(`scenes/${id}`,'PUT',{scene,revision:2},409);let current=await call(`scenes/${id}`);assert.equal(JSON.parse(current.published).summary,'original');assert.equal(JSON.parse(current.draft).summary,'draft only');
 const releases=await call(`scenes/${id}/releases`);await call(`scenes/${id}/rollback`,'POST',{releaseId:releases[0].id,revision:r.revision});current=await call(`scenes/${id}`);assert.equal(JSON.parse(current.draft).summary,'original');
 const cross=await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{Origin:'https://invalid.example','X-Admin-Request':'1',Cookie:cookie}});assert.equal(cross.status,403);
 console.log('PASS: login, scene creation, publishing, draft isolation, revision conflict, rollback, CSRF.');
}finally{await call(`scenes/${id}/visibility`,'POST',{hidden:true,archived:true,position:999});await call('logout','POST',{});}
