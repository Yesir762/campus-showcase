import {all,one,authenticate,bucket,json,type AssetRow} from '@/lib/admin/store';
import {HttpError,safePath} from '@/lib/admin/security';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{file:string[]}>}){
 try{
  const {file}=await params,path='/models/'+safePath(file.join('/'));
  const asset=await one<AssetRow>("SELECT * FROM assets WHERE json_extract(metadata,'$.legacyPath')=? AND status='ready'",path);if(!asset)throw new HttpError(404,'原有模型资源尚未导入');
  const rows=await all<{published:string}>('SELECT published FROM scenes WHERE published IS NOT NULL AND hidden=0 AND archived=0');let publicRef=false;
  const visit=(v:unknown)=>{if(typeof v==='string'&&(v===path||((v.endsWith('/lod-meta.json')||v.endsWith('/meta.json'))&&path.startsWith(v.slice(0,v.lastIndexOf('/')+1)))))publicRef=true;else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};for(const row of rows)visit(JSON.parse(row.published));
  if(!publicRef)await authenticate(req);
  const name=JSON.parse(asset.metadata).files[0].path;const object=await bucket().get(asset.key+name,{range:req.headers});if(!object)throw new HttpError(404,'模型资源不存在');
  const headers=new Headers({'Content-Type':path.endsWith('.json')?'application/json':path.endsWith('.webp')?'image/webp':'application/octet-stream','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','ETag':object.httpEtag,'Cache-Control':publicRef?'public, max-age=300':'private, no-store'});
  if(req.headers.has('range')&&object.range&&'offset' in object.range&&object.range.offset!==undefined){const length=object.range.length??object.size-object.range.offset;headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+length-1}/${object.size}`);headers.set('Content-Length',String(length));return new Response(object.body,{status:206,headers});}
  headers.set('Content-Length',String(object.size));return new Response(object.body,{headers});
 }catch(e){return json({error:e instanceof HttpError?e.message:'模型资源读取失败'},e instanceof HttpError?e.status:500);}
}
