import {env} from 'cloudflare:workers';
import {db,all,one,run,log,authenticate,json,body,SceneRow,AssetRow,JobRow,bucket} from '@/lib/admin/store';
import {HttpError,assertOrigin,uid,now,digest,passwordHash,verifyPassword,safeEqual,resourceUrl} from '@/lib/admin/security';
import {seed,saveScene,publish,checkAssets,assetReferenced} from '@/lib/admin/content';
import {validateDraft} from '@/lib/admin/validation';
import {createUpload,uploadPart,finishUpload,abortUpload} from '@/lib/admin/uploads';
export const dynamic='force-dynamic';
const cookie=(req:Request,value:string,age:number)=>`campus_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
async function route(req:Request,{params}:{params:Promise<{path:string[]}>}){
 try{
  const {path}=await params;const [action,id,sub]=path,method=req.method;
  if(method!=='GET')assertOrigin(req);
  if(action==='status'&&method==='GET')return json({initialized:Boolean(await one('SELECT id FROM admins LIMIT 1'))});
  if(action==='setup'&&method==='POST'){
   if(await one('SELECT id FROM admins LIMIT 1'))throw new HttpError(409,'管理员已初始化');
   const input=await body(req);if(!env.ADMIN_SETUP_TOKEN||!safeEqual(String(input.token??''),env.ADMIN_SETUP_TOKEN))throw new HttpError(403,'初始化口令无效，请在部署环境配置 ADMIN_SETUP_TOKEN');
   if(typeof input.password!=='string'||input.password.length<12||input.password.length>256||!/^.{3,80}$/.test(input.username??''))throw new HttpError(400,'账号至少 3 字符，密码需 12–256 字符');
   const adminId=uid();const created=await run('INSERT INTO admins (id,username,password,createdAt) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM admins)',adminId,input.username,await passwordHash(input.password),now());
   if(!created.meta.changes)throw new HttpError(409,'管理员已初始化');await seed(adminId);return json({ok:true});
  }
  if(action==='bootstrap'&&method==='POST'){
   const input=await body(req);if(!env.ADMIN_SETUP_TOKEN||!safeEqual(String(input.token??''),env.ADMIN_SETUP_TOKEN))throw new HttpError(403,'部署口令无效');
   if(!await one('SELECT id FROM settings WHERE id=?','site'))await seed('deployment');return json({ok:true});
  }
  if(action==='recovery'&&method==='POST'){
   const input=await body(req);if(!env.ADMIN_SETUP_TOKEN||!safeEqual(String(input.token??''),env.ADMIN_SETUP_TOKEN))throw new HttpError(403,'部署口令无效');
   if(typeof input.password!=='string'||input.password.length<12||input.password.length>256)throw new HttpError(400,'密码需 12–256 字符');
   const admin=await one<{id:string}>('SELECT id FROM admins WHERE username=?',String(input.username??''));if(!admin)throw new HttpError(404,'管理员不存在');
   await db().batch([db().prepare('UPDATE admins SET password=? WHERE id=?').bind(await passwordHash(input.password),admin.id),db().prepare('DELETE FROM admin_sessions WHERE adminId=?').bind(admin.id)]);await log(admin.id,'deployment-reset-password',admin.id);return json({ok:true});
  }
  if(action==='login'&&method==='POST'){
   const input=await body(req);const username=String(input.username??'').slice(0,80),password=String(input.password??'').slice(0,257),time=now();
   const keys=await Promise.all([digest(`account:${username}`),digest(`ip:${req.headers.get('cf-connecting-ip')??'local'}`)]);
   for(const key of keys){await run('INSERT INTO login_attempts (id,count,expiresAt) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expiresAt<? THEN 1 ELSE count+1 END,expiresAt=CASE WHEN expiresAt<? THEN excluded.expiresAt ELSE expiresAt END',key,time+900000,time,time);const attempt=await one<{count:number}>('SELECT count FROM login_attempts WHERE id=?',key);if(attempt!.count>10)throw new HttpError(429,'登录尝试过多，请 15 分钟后重试');}
   const user=await one<{id:string;password:string}>('SELECT id,password FROM admins WHERE username=?',username);
   const dummy='pbkdf2$00000000000000000000000000000000$'+'0'.repeat(64);
   const valid=await verifyPassword(password,user?.password??dummy);if(!user||!valid)throw new HttpError(401,'账号或密码错误');
   await run('DELETE FROM login_attempts WHERE id=?',keys[0]);const token=uid()+uid();await run('INSERT INTO admin_sessions (id,adminId,expiresAt) VALUES (?,?,?)',await digest(token),user.id,time+8*3600000);
   await log(user.id,'login','session');return json({ok:true},200,{'Set-Cookie':cookie(req,token,28800)});
  }
  const user=await authenticate(req);
  if(action==='me'&&method==='GET')return json(user);
  if(action==='logout'&&method==='POST'){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)campus_admin=([^;]+)/)?.[1];if(token)await run('DELETE FROM admin_sessions WHERE id=?',await digest(token));return json({ok:true},200,{'Set-Cookie':cookie(req,'',0)});}
  if(action==='password'&&method==='POST'){
   const input=await body(req),a=await one<{password:string}>('SELECT password FROM admins WHERE id=?',user.id);
   if(!await verifyPassword(String(input.current??''),a!.password))throw new HttpError(403,'原密码错误');if(typeof input.password!=='string'||input.password.length<12||input.password.length>256)throw new HttpError(400,'新密码需 12–256 字符');
   await db().batch([db().prepare('UPDATE admins SET password=? WHERE id=?').bind(await passwordHash(input.password),user.id),db().prepare('DELETE FROM admin_sessions WHERE adminId=?').bind(user.id)]);await log(user.id,'change-password',user.id);return json({ok:true},200,{'Set-Cookie':cookie(req,'',0)});
  }
  if(action==='initialize'&&method==='POST'){await seed(user.id);return json({ok:true});}
  if(action==='scenes'){
   if(!id&&method==='GET')return json(await all<SceneRow>('SELECT * FROM scenes ORDER BY position,id'));
   if(!id&&method==='POST'){const input=await body(req),s=validateDraft(input.scene);await run('INSERT INTO scenes (id,draft,revision,position,hidden,archived,updatedAt) VALUES (?,?,1,?,1,0,?)',s.id,JSON.stringify(s),now(),now());await log(user.id,'create-scene',s.id);return json({id:s.id});}
   const row=await one<SceneRow>('SELECT * FROM scenes WHERE id=?',id);if(!row)throw new HttpError(404,'场景不存在');
   if(!sub&&method==='GET')return json(row);
   if(!sub&&method==='PUT'){const input=await body(req);return json({revision:await saveScene(id,input.scene,input.revision,user.id)});}
   if(sub==='visibility'&&method==='POST'){const input=await body(req);if(!Number.isFinite(input.position))throw new HttpError(400,'排序数值无效');await run('UPDATE scenes SET hidden=?,archived=?,position=? WHERE id=?',input.hidden?1:0,input.archived?1:0,Math.trunc(input.position),id);await log(user.id,'visibility',id);return json({ok:true});}
   if(sub==='check'&&method==='GET')return json({issues:await checkAssets(JSON.parse(row.draft))});
   if(sub==='publish'&&method==='POST'){const input=await body(req);return json({revision:await publish(id,input.revision,user.id)});}
   if(sub==='rollback'&&method==='POST'){const input=await body(req);return json({revision:await publish(id,input.revision,user.id,input.releaseId)});}
   if(sub==='releases'&&method==='GET')return json(await all('SELECT * FROM releases WHERE sceneId=? ORDER BY createdAt DESC',id));
  }
  if(action==='assets'){
   if(!id&&method==='GET')return json(await all("SELECT * FROM assets WHERE json_extract(metadata,'$.legacyPath') IS NULL ORDER BY createdAt DESC"));
   if(!id&&method==='POST'){const input=await body(req);const result=await createUpload({name:input.name,files:input.files});await log(user.id,'upload-start',result.id);return json(result);}
   if(sub==='complete'&&method==='POST'){const result=await finishUpload(id);await log(user.id,'upload-complete',id);return json(result);}
   if(id&&method==='DELETE'){
    if(await assetReferenced(id))throw new HttpError(409,'资源仍被草稿、历史版本或转换任务引用');
    const a=await one<AssetRow>('SELECT * FROM assets WHERE id=?',id);if(a&&JSON.parse(a.metadata).legacyPath)throw new HttpError(409,'原有模型资源需通过部署流程维护，不能在资源库删除');await abortUpload(id);if(a){let cursor:string|undefined;do{const list=await bucket().list({prefix:a.key,cursor});if(list.objects.length)await bucket().delete(list.objects.map(o=>o.key));cursor=list.truncated?list.cursor:undefined;}while(cursor);await run('DELETE FROM assets WHERE id=?',id);}await log(user.id,'delete-asset',id);return json({ok:true});
   }
  }
  if(action==='uploads'&&id){
   if(method==='GET')return json(await all('SELECT * FROM uploads WHERE assetId=?',id));
   if(method==='PUT')return json(await uploadPart(req,id,Number(sub)));
  }
  if(action==='jobs'){
   if(!id&&method==='GET')return json(await all('SELECT * FROM conversion_jobs ORDER BY createdAt DESC LIMIT 200'));
   if(!id&&method==='POST'){
    const input=await body(req),a=await one<AssetRow>('SELECT * FROM assets WHERE id=?',input.assetId);if(!a||!['uploaded','ready'].includes(a.status)||!['ply','splat','ksplat','spz','sog'].includes(a.format))throw new HttpError(400,'请先完整上传可转换的高斯模型');
    const active=await one<JobRow>("SELECT * FROM conversion_jobs WHERE assetId=? AND state IN ('queued','validating','converting','uploading')",a.id);if(active)return json(active);
    const jobId=uid();const inserted=await run('INSERT OR IGNORE INTO conversion_jobs (id,assetId,state,updatedAt,createdAt,attempt) VALUES (?,?,\'queued\',?,?,0)',jobId,a.id,now(),now());if(!inserted.meta.changes)return json(await one("SELECT * FROM conversion_jobs WHERE assetId=? AND state IN ('queued','validating','converting','uploading')",a.id));await log(user.id,'conversion-create',jobId);return json({id:jobId});
   }
   if(sub==='cancel'&&method==='POST'){await run("UPDATE conversion_jobs SET state='cancelled',lease=NULL,leaseUntil=NULL,updatedAt=? WHERE id=? AND state IN ('queued','validating','converting','uploading')",now(),id);await log(user.id,'conversion-cancel',id);return json({ok:true});}
   if(sub==='retry'&&method==='POST'){const retried=await run("UPDATE OR IGNORE conversion_jobs SET state='queued',error=NULL,lease=NULL,leaseUntil=NULL,startedAt=NULL,updatedAt=? WHERE id=? AND state IN ('failed','cancelled')",now(),id);if(!retried.meta.changes)throw new HttpError(409,'任务状态不可重试，或该源文件已有其他任务进行中');await log(user.id,'conversion-retry',id);return json({ok:true});}
  }
  if(action==='health'&&method==='GET')return json({nodes:await all('SELECT * FROM conversion_nodes'),storage:await one('SELECT COALESCE(SUM(bytes),0) AS bytes,COUNT(*) AS count FROM assets'),jobs:await all('SELECT state,COUNT(*) AS count FROM conversion_jobs GROUP BY state')});
  if(action==='audit'&&method==='GET')return json(await all('SELECT * FROM audit_log ORDER BY createdAt DESC LIMIT 200'));
  if(action==='backup'&&method==='GET')return json({schemaVersion:1,exportedAt:now(),scenes:await all('SELECT * FROM scenes'),releases:await all('SELECT * FROM releases'),assets:await all('SELECT * FROM assets'),settings:await all('SELECT * FROM settings')},200,{'Content-Disposition':'attachment; filename="campus-backup.json"'});
  if(action==='settings'){
   if(method==='GET')return json(await one('SELECT data FROM settings WHERE id=?','site'));
   if(method==='PUT'){const input=await body(req);const {siteSchema}=await import('@/lib/campus-config');const value=siteSchema.parse(input);await run('UPDATE settings SET data=? WHERE id=?',JSON.stringify(value),'site');await log(user.id,'site-settings','site');return json({ok:true});}
  }
  if(action==='validate-url'&&method==='POST'){const input=await body(req);return json({url:resourceUrl(input.url)});}
  throw new HttpError(404,'接口不存在');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof Error&&e.name==='ZodError')return json({error:e.message},400);console.error('Admin request failed',e instanceof Error?e.message:'unknown');return json({error:'操作失败，请检查配置与服务日志'},500);}
}
export {route as GET,route as POST,route as PUT,route as DELETE};
