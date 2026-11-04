import {mkdtemp,rm,stat,open} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=process.env.SITE_URL?.replace(/\/$/,''),token=process.env.CONVERTER_TOKEN;
if(!base||!token)throw Error('Configure SITE_URL and CONVERTER_TOKEN');
if(!base.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))throw Error('SITE_URL requires HTTPS outside local development');
const cli=fileURLToPath(new URL('./node_modules/@playcanvas/splat-transform/bin/cli.mjs',import.meta.url));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,{method='POST',data,lease,body,signal}={}){
 const response=await fetch(`${base}/api/converter/${path}`,{method,redirect:'error',signal:signal??AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,...(lease?{'X-Job-Lease':lease}:{}),...(data?{'Content-Type':'application/json'}:{})},body:body??(data?JSON.stringify(data):undefined)});
 if(!response.ok){const value=await response.json().catch(()=>({error:`HTTP ${response.status}`}));throw Object.assign(Error(value.error),{status:response.status});}return response;
}
function command(args,signal){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[cli,'--gpu','cpu','--max-workers','2',...args],{signal,stdio:['ignore','pipe','pipe']});let out='',err='';
 child.stdout.on('data',data=>{out=(out+data).slice(-65536);});child.stderr.on('data',data=>{err=(err+data).slice(-4096);});child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(`转换工具退出 ${code}: ${err}`)));
});}
async function info(file,signal){const out=await command([file,'--info','json','null'],signal);const start=out.indexOf('{'),end=out.lastIndexOf('}');const value=JSON.parse(out.slice(start,end+1));if(!value.gaussian||!Number.isSafeInteger(value.numGaussians)||value.numGaussians<1)throw Error('源文件不是有效的高斯模型');return value;}
async function execute(job,asset){
 const directory=await mkdtemp(join(tmpdir(),'campus-convert-')),controller=new AbortController();let phase='validating',heartbeatRunning=false;
 const timer=setTimeout(()=>controller.abort(Error('转换超过时间限制')),Number(process.env.CONVERSION_TIMEOUT_MS??3600000));
 const interval=setInterval(async()=>{if(heartbeatRunning)return;heartbeatRunning=true;try{await api(`heartbeat/${job.id}`,{data:{state:phase},lease:job.lease,signal:controller.signal});}catch(e){controller.abort(e);}finally{heartbeatRunning=false;}},20000);
 try{
  const input=join(directory,`source.${asset.format}`),output=join(directory,'model.sog');
  const source=await api(`source/${job.id}`,{method:'GET',lease:job.lease,signal:controller.signal});let downloaded=0;
  const checked=async function*(stream){for await(const data of stream){downloaded+=data.byteLength;if(downloaded>asset.bytes)throw Error('源文件超过声明大小');yield data;}};
  await pipeline(checked(Readable.fromWeb(source.body)),createWriteStream(input),{signal:controller.signal});if(downloaded!==asset.bytes)throw Error('源文件下载不完整');
  const sourceInfo=await info(input,controller.signal);phase='converting';await api(`heartbeat/${job.id}`,{data:{state:phase},lease:job.lease});
  let result=input;if(asset.format!=='sog'){await command(['--overwrite',input,output],controller.signal);result=output;}
  const resultInfo=await info(result,controller.signal);if(resultInfo.numGaussians!==sourceInfo.numGaussians)throw Error('转换前后高斯点数不一致');
  const hash=createHash('sha256');for await(const data of createReadStream(result))hash.update(data);
  phase='uploading';const bytes=(await stat(result)).size;
  const upload=await (await api(`output/${job.id}`,{lease:job.lease,data:{name:`${asset.name.replace(/\.[^.]+$/,'')}.sog`,bytes}})).json();
  const file=await open(result,'r');try{for(const u of upload.uploads){for(let index=0;index<Math.ceil(bytes/upload.partSize);index++){
   const buffer=Buffer.alloc(Math.min(upload.partSize,bytes-index*upload.partSize));let read=0;while(read<buffer.length){const next=await file.read(buffer,read,buffer.length-read,index*upload.partSize+read);if(!next.bytesRead)throw Error('产物读取不完整');read+=next.bytesRead;}
   await api(`part/${job.id}/${u.id}/${index+1}`,{method:'PUT',lease:job.lease,body:buffer,signal:controller.signal});
  }}}finally{await file.close();}
  await api(`complete/${job.id}`,{lease:job.lease,data:{sha256:hash.digest('hex'),points:resultInfo.numGaussians,converter:'@playcanvas/splat-transform@3.8.0'}});
  console.log(JSON.stringify({job:job.id,state:'succeeded',points:resultInfo.numGaussians,bytes}));
 }catch(error){console.error(JSON.stringify({job:job.id,error:error.message}));await api(`fail/${job.id}`,{lease:job.lease,data:{error:error.message}}).catch(()=>{});}
 finally{clearTimeout(timer);clearInterval(interval);controller.abort();await rm(directory,{recursive:true,force:true});}
}
for(;;){try{const {job,asset}=await (await api('claim',{data:{node:process.env.NODE_NAME??'converter-1'}})).json();if(job)await execute(job,asset);else await pause(10000);}catch(error){console.error(JSON.stringify({error:error.message}));await pause(10000);}}
