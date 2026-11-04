import {env} from 'cloudflare:workers';
import {bucket,db,one,all,run,type AssetRow} from './store';
import {uid,now,HttpError,safePath,fileFormat,validateSourceHeader} from './security';
import {dependencyPaths} from './validation';
export const PART_SIZE=8*1024*1024;
type Upload={id:string;assetId:string;uploadId:string;key:string;bytes:number;parts:string;createdAt:number};
export async function createUpload(input:{name:string;files:{path:string;bytes:number}[]}){
 if(!input.name?.trim()||!input.files?.length||input.files.length>5000)throw new HttpError(400,'请提供文件名和文件列表（最多 5000 个）');
 const total=input.files.reduce((n,f)=>n+f.bytes,0),max=Number(env.MAX_SOURCE_BYTES??2147483648);
 if(!Number.isSafeInteger(total)||total<=0||total>max)throw new HttpError(413,`资源超过上传大小限制 ${max} 字节`);
 const paths=new Set<string>();for(const f of input.files){safePath(f.path);fileFormat(f.path);if(!Number.isSafeInteger(f.bytes)||f.bytes<=0||paths.has(f.path))throw new HttpError(400,'文件大小或路径无效');paths.add(f.path);}
 const directory=input.files.length>1||input.files[0].path.includes('/');
 if(directory&&!input.files.some(f=>f.path.endsWith('lod-meta.json')||f.path.endsWith('meta.json')))throw new HttpError(400,'目录必须包含 meta.json 或 lod-meta.json');
 const id=uid(),key=`assets/${id}/`,created=now();
 await run('INSERT INTO assets (id,name,format,status,bytes,key,metadata,createdAt) VALUES (?,?,?,?,?,?,?,?)',id,input.name,directory?'directory':fileFormat(input.name),'uploading',total,key,JSON.stringify({files:input.files}),created);
 try{
  for(const file of input.files){const objectKey=key+file.path;const multi=await bucket().createMultipartUpload(objectKey);await run('INSERT INTO uploads (id,assetId,uploadId,key,bytes,parts,createdAt) VALUES (?,?,?,?,?,?,?)',uid(),id,multi.uploadId,objectKey,file.bytes,'[]',created);}
 }catch(e){await run("UPDATE assets SET status='failed' WHERE id=?",id);throw e;}
 return {id,partSize:PART_SIZE,uploads:await all<Upload>('SELECT * FROM uploads WHERE assetId=?',id)};
}
export async function uploadPart(req:Request,id:string,part:number){
 const u=await one<Upload>('SELECT * FROM uploads WHERE id=?',id);if(!u)throw new HttpError(404,'上传不存在');
 const a=await one<AssetRow>('SELECT * FROM assets WHERE id=?',u.assetId);if(a?.status!=='uploading')throw new HttpError(409,'上传已结束');
 const count=Math.ceil(u.bytes/PART_SIZE);if(!Number.isInteger(part)||part<1||part>count)throw new HttpError(400,'分片编号无效');
 if(!req.body)throw new HttpError(400,'缺少分片内容');const reader=req.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>PART_SIZE){await reader.cancel();throw new HttpError(413,'分片过大');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}if(bytes.byteLength!==(part===count?u.bytes-(count-1)*PART_SIZE:PART_SIZE))throw new HttpError(400,'分片长度不匹配');
 const result=await bucket().resumeMultipartUpload(u.key,u.uploadId).uploadPart(part,bytes);
 const parts=JSON.parse(u.parts).filter((p:R2UploadedPart)=>p.partNumber!==part);parts.push(result);parts.sort((a:R2UploadedPart,b:R2UploadedPart)=>a.partNumber-b.partNumber);
 await run('UPDATE uploads SET parts=? WHERE id=?',JSON.stringify(parts),id);return result;
}
export async function finishUpload(id:string){
 const asset=await one<AssetRow>('SELECT * FROM assets WHERE id=?',id);if(!asset)throw new HttpError(404,'资源不存在');if(asset.status!=='uploading')return asset;
 const rows=await all<Upload>('SELECT * FROM uploads WHERE assetId=?',id),meta=JSON.parse(asset.metadata);
 for(const row of rows){
  const parts=JSON.parse(row.parts);if(parts.length!==Math.ceil(row.bytes/PART_SIZE))throw new HttpError(409,'仍有文件分片未上传完成');
  if(!await bucket().head(row.key))await bucket().resumeMultipartUpload(row.key,row.uploadId).complete(parts);
  const head=await bucket().get(row.key,{range:{offset:0,length:Math.min(row.bytes,262144)}});if(!head)throw new HttpError(422,'文件未保存完整');
  const path=row.key.slice(asset.key.length),bytes=new Uint8Array(await head.arrayBuffer());validateSourceHeader(path,bytes,row.bytes);
  const file=meta.files.find((f:{path:string})=>f.path===path);if(path.endsWith('.json')){const manifest=JSON.parse(new TextDecoder().decode(bytes));
   if(path.endsWith('lod-meta.json')&&(!Number.isSafeInteger(manifest.count)||manifest.count<=0||!Array.isArray(manifest.filenames)||!manifest.filenames.length||!manifest.tree))throw new HttpError(422,'Streamed SOG 清单结构无效');
   if(path.endsWith('meta.json')&&!path.endsWith('lod-meta.json')&&(!Number.isSafeInteger(manifest.count)||manifest.count<=0||!manifest.means?.files?.length||!manifest.scales?.files?.length||!manifest.quats?.files?.length||!manifest.sh0?.files?.length))throw new HttpError(422,'SOG 清单结构无效');
   file.dependencies=dependencyPaths(manifest);
  }
 }
 if(asset.format==='directory'){
  for(const file of meta.files)for(const dep of file.dependencies??[]){
   if(/^[a-z]+:/i.test(dep)||dep.startsWith('/'))throw new HttpError(422,'目录依赖必须使用相对路径');
   const stack=file.path.split('/').slice(0,-1);for(const p of dep.split('/')){if(p==='..'){if(!stack.length)throw new HttpError(422,'依赖路径越界');stack.pop();}else if(p!=='.')stack.push(p);}
   if(!meta.files.some((f:{path:string})=>f.path===stack.join('/')))throw new HttpError(422,`目录缺少依赖文件：${stack.join('/')}`);
  }
  meta.entry=meta.files.find((f:{path:string})=>f.path.endsWith('lod-meta.json'))?.path??meta.files.find((f:{path:string})=>f.path.endsWith('meta.json'))?.path;
 }
 const state=['png','jpg','jpeg','webp'].includes(asset.format)?'ready':asset.format==='directory'?'ready':'uploaded';
 await run('UPDATE assets SET status=?,metadata=? WHERE id=?',state,JSON.stringify(meta),id);await run('DELETE FROM uploads WHERE assetId=?',id);return {id,status:state};
}
export async function abortUpload(id:string){for(const u of await all<Upload>('SELECT * FROM uploads WHERE assetId=?',id)){try{await bucket().resumeMultipartUpload(u.key,u.uploadId).abort();}catch{/* may already be complete */}}
 await run('DELETE FROM uploads WHERE assetId=?',id);
}
