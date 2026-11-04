import {createReadStream} from 'node:fs';import {open,stat,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const base=process.env.SITE_URL?.replace(/\/$/,''),token=process.env.ADMIN_SETUP_TOKEN;
if(!base||!token)throw Error('Set SITE_URL and ADMIN_SETUP_TOKEN via the deployment environment.');
if(!base.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))throw Error('HTTPS required');
const resources=JSON.parse(await readFile(new URL('../../config/resource-index.json',import.meta.url),'utf8')).filter(p=>p.startsWith('/models/'));
async function api(path,body,method='POST'){
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(`${base}/api/deployment/${path}`,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,...(process.env.SITE_SERVICE_TOKEN?{'OAI-Sites-Authorization':`Bearer ${process.env.SITE_SERVICE_TOKEN}`}:{}),...(body instanceof Uint8Array?{}:{'Content-Type':'application/json'})},body:body instanceof Uint8Array?body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const value=await r.json();if(!r.ok)throw Error(value.error??`HTTP ${r.status}`);return value;}catch(e){if(attempt===2)throw e;}
 }
}
let completed=0;
for(const path of resources){
 const local=new URL('../../public'+path,import.meta.url),bytes=(await stat(local)).size,hash=createHash('sha256');for await(const chunk of createReadStream(local))hash.update(chunk);
 const u=await api('start',{path,bytes,sha256:hash.digest('hex')});
 if(!u.complete){const f=await open(local,'r');try{for(const upload of u.uploads){const parts=JSON.parse(upload.parts);for(let n=0;n<Math.ceil(bytes/u.partSize);n++){
  if(parts.some(p=>p.partNumber===n+1))continue;const chunk=Buffer.alloc(Math.min(u.partSize,bytes-n*u.partSize));let offset=0;while(offset<chunk.length){const result=await f.read(chunk,offset,chunk.length-offset,n*u.partSize+offset);if(!result.bytesRead)throw Error('Model source truncated');offset+=result.bytesRead;}await api(`part/${upload.id}/${n+1}`,chunk,'PUT');
 }}}finally{await f.close();}await api(`complete/${u.id}`,{});}
 completed++;console.log(`${completed}/${resources.length} ${path}`);
}
console.log('Original model assets imported. Existing /models URLs now resolve through R2.');
