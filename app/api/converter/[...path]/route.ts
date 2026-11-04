import {env} from 'cloudflare:workers';
import {all,one,run,db,bucket,json,body,type JobRow,type AssetRow} from '@/lib/admin/store';
import {HttpError,now,uid,safeEqual} from '@/lib/admin/security';
import {createUpload,uploadPart,finishUpload} from '@/lib/admin/uploads';
export const dynamic='force-dynamic';
async function route(req:Request,{params}:{params:Promise<{path:string[]}>}){
 try{
  if(!env.CONVERTER_TOKEN||!safeEqual(req.headers.get('authorization')??'',`Bearer ${env.CONVERTER_TOKEN}`))throw new HttpError(401,'转换节点认证失败');
  const {path}=await params,[action,id,part]=path;
  if(action==='claim'&&req.method==='POST'){
   const input=await body(req),node=String(input.node??'default').slice(0,80),time=now();
   await run('INSERT INTO conversion_nodes (id,lastSeen) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET lastSeen=excluded.lastSeen',node,time);
   await run("UPDATE conversion_jobs SET state='failed',error='转换超过时间限制',lease=NULL,leaseUntil=NULL,updatedAt=? WHERE state IN ('validating','converting','uploading') AND startedAt<?",time,time-Number(env.CONVERSION_TIMEOUT_MS??3600000));
   await run("UPDATE conversion_jobs SET state='queued',lease=NULL,leaseUntil=NULL,updatedAt=? WHERE state IN ('validating','converting','uploading') AND leaseUntil<?",time,time);
   // Claim is one atomic SQL write; a second node cannot claim while a live lease exists.
   const lease=uid()+uid();const job=await db().prepare("UPDATE conversion_jobs SET state='validating',lease=?,leaseUntil=?,startedAt=COALESCE(startedAt,?),updatedAt=?,attempt=attempt+1 WHERE id=(SELECT id FROM conversion_jobs WHERE state='queued' ORDER BY createdAt LIMIT 1) AND NOT EXISTS (SELECT 1 FROM conversion_jobs WHERE state IN ('validating','converting','uploading') AND leaseUntil>?) RETURNING *").bind(lease,time+90000,time,time,time).first<JobRow>();
   if(!job)return json({job:null});const asset=await one<AssetRow>('SELECT * FROM assets WHERE id=?',job.assetId);if(!asset)throw new HttpError(422,'源文件丢失');return json({job,asset});
  }
  const job=await one<JobRow>('SELECT * FROM conversion_jobs WHERE id=?',id);
  const lease=req.headers.get('x-job-lease')??'';
  if(action==='complete'&&job?.state==='succeeded'&&job.lease&&safeEqual(lease,job.lease))return json({ok:true,resultId:job.resultId});
  if(!job||!job.lease||!safeEqual(lease,job.lease)||!job.leaseUntil||job.leaseUntil<now()||!['validating','converting','uploading'].includes(job.state))throw new HttpError(409,'任务已取消、完成或租约失效');
  if(action==='heartbeat'&&req.method==='POST'){
   const node=req.headers.get('x-converter-node');if(node)await run('UPDATE conversion_nodes SET lastSeen=? WHERE id=?',now(),node.slice(0,80));
   const input=await body(req);const allowed=['validating','converting','uploading'];if(!allowed.includes(input.state))throw new HttpError(400,'阶段无效');
   await run('UPDATE conversion_jobs SET state=?,leaseUntil=?,updatedAt=? WHERE id=? AND lease=?',input.state,now()+90000,now(),id,lease);return json({ok:true});
  }
  if(action==='source'&&req.method==='GET'){
   const a=await one<AssetRow>('SELECT * FROM assets WHERE id=?',job.assetId);if(!a)throw new HttpError(404,'源文件不存在');const files=JSON.parse(a.metadata).files;const object=await bucket().get(a.key+files[0].path);if(!object)throw new HttpError(404,'源文件不存在');return new Response(object.body,{headers:{'Content-Length':String(object.size),'Cache-Control':'no-store'}});
  }
  if(action==='output'&&req.method==='POST'){
   const input=await body(req);if(!Number.isSafeInteger(input.bytes)||input.bytes<=0||!/^.{1,200}\.sog$/.test(input.name))throw new HttpError(400,'转换产物无效');
   const upload=await createUpload({name:input.name,files:[{path:'model.sog',bytes:input.bytes}]});await run('UPDATE conversion_jobs SET resultId=?,state=\'uploading\' WHERE id=? AND lease=?',upload.id,id,lease);return json(upload);
  }
  if(action==='part'&&req.method==='PUT'){
   const u=await one<{id:string}>('SELECT id FROM uploads WHERE assetId=? AND id=?',job.resultId,part);if(!u)throw new HttpError(403,'上传不属于该任务');return json(await uploadPart(req,part,Number(path[3])));
  }
  if(action==='complete'&&req.method==='POST'){
   const input=await body(req);if(!job.resultId||!Number.isSafeInteger(input.points)||input.points<1||! /^[a-f0-9]{64}$/.test(input.sha256??'')||input.converter!=='@playcanvas/splat-transform@3.8.0')throw new HttpError(422,'产物校验信息无效');
   await finishUpload(job.resultId);const a=await one<AssetRow>('SELECT * FROM assets WHERE id=?',job.resultId);const meta={...JSON.parse(a!.metadata),points:input.points,sha256:input.sha256,converter:input.converter,sourceAssetId:job.assetId};
   const time=now();const result=await db().batch([
    db().prepare("UPDATE conversion_jobs SET state='succeeded',leaseUntil=NULL,updatedAt=? WHERE id=? AND lease=? AND leaseUntil>?").bind(time,id,lease,time),
    db().prepare("UPDATE assets SET status='ready',metadata=? WHERE id=? AND changes()=1").bind(JSON.stringify(meta),job.resultId),
   ]);if(!result[0].meta.changes)throw new HttpError(409,'任务租约已变化');return json({ok:true,resultId:job.resultId});
  }
  if(action==='fail'&&req.method==='POST'){const input=await body(req);await run("UPDATE conversion_jobs SET state='failed',error=?,lease=NULL,leaseUntil=NULL,updatedAt=? WHERE id=? AND lease=?",String(input.error??'转换失败').slice(0,2000),now(),id,lease);return json({ok:true});}
  throw new HttpError(404,'转换接口不存在');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Conversion API failed',e instanceof Error?e.message:'unknown');return json({error:'转换服务请求失败'},500);}
}
export {route as GET,route as POST,route as PUT};
