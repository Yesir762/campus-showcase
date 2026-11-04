import {env} from 'cloudflare:workers';
import {one,all,run,json,body,type AssetRow} from '@/lib/admin/store';
import {HttpError,safeEqual,safePath} from '@/lib/admin/security';
import {createUpload,uploadPart,finishUpload} from '@/lib/admin/uploads';
import resources from '@/config/resource-index.json';
export const dynamic='force-dynamic';
async function route(req:Request,{params}:{params:Promise<{path:string[]}>}){
 try{
  if(!env.ADMIN_SETUP_TOKEN||!safeEqual(req.headers.get('authorization')??'',`Bearer ${env.ADMIN_SETUP_TOKEN}`))throw new HttpError(401,'部署认证失败');
  const {path}=await params,[action,id,part]=path;
  if(action==='start'&&req.method==='POST'){
   const input=await body(req);if(typeof input.path!=='string'||!input.path.startsWith('/models/')||!resources.includes(input.path)||!/^[a-f0-9]{64}$/.test(input.sha256??''))throw new HttpError(400,'只能导入本次构建列出的原有模型资源');
   safePath(input.path.slice(1));const existing=await one<AssetRow>("SELECT * FROM assets WHERE json_extract(metadata,'$.legacyPath')=?",input.path);
   if(existing){const meta=JSON.parse(existing.metadata);if(meta.sha256!==input.sha256||existing.bytes!==input.bytes)throw new HttpError(409,'原有模型路径内容发生变化，请使用新版本目录');return json({id:existing.id,complete:existing.status==='ready',partSize:8*1024*1024,uploads:await all('SELECT * FROM uploads WHERE assetId=?',existing.id)});}
   const name=input.path.split('/').at(-1)!;const upload=await createUpload({name,files:[{path:name,bytes:input.bytes}]});const asset=await one<AssetRow>('SELECT * FROM assets WHERE id=?',upload.id);
   await run('UPDATE assets SET metadata=? WHERE id=?',JSON.stringify({...JSON.parse(asset!.metadata),legacyPath:input.path,sha256:input.sha256}),upload.id);return json(upload);
  }
  if(action==='part'&&req.method==='PUT'){
   const upload=await one<{assetId:string}>('SELECT assetId FROM uploads WHERE id=?',id);if(!upload||!await one("SELECT id FROM assets WHERE id=? AND json_extract(metadata,'$.legacyPath') IS NOT NULL",upload.assetId))throw new HttpError(404,'部署上传不存在');return json(await uploadPart(req,id,Number(part)));
  }
  if(action==='complete'&&req.method==='POST'){
   const asset=await one<AssetRow>('SELECT * FROM assets WHERE id=?',id);if(!asset||!JSON.parse(asset.metadata).legacyPath)throw new HttpError(404,'部署资源不存在');await finishUpload(id);await run("UPDATE assets SET status='ready' WHERE id=?",id);return json({ok:true});
  }
  throw new HttpError(404,'部署接口不存在');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Deployment asset import failed',e instanceof Error?e.message:'unknown');return json({error:'原有模型资源导入失败'},500);}
}
export {route as POST,route as PUT};
