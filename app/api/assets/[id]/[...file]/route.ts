import {bucket,one,authenticate,type AssetRow,json} from '@/lib/admin/store';
import {HttpError,safePath} from '@/lib/admin/security';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string;file:string[]}>}){
 try{
  const {id,file}=await params,path=safePath(file.join('/')),asset=await one<AssetRow>('SELECT * FROM assets WHERE id=?',id);
  if(!asset)throw new HttpError(404,'资源不存在');
  const publicRef=asset.status==='ready'&&await one('SELECT id FROM scenes WHERE instr(published,?)>0 AND hidden=0 AND archived=0 LIMIT 1',`/api/assets/${id}/`);
  if(!publicRef)await authenticate(req);
  const object=await bucket().get(asset.key+path,{range:req.headers,onlyIf:req.headers});if(!object)throw new HttpError(404,'文件不存在');
  const h=new Headers({'X-Content-Type-Options':'nosniff','Cache-Control':publicRef?'public, max-age=300':'private, no-store','ETag':object.httpEtag,'Accept-Ranges':'bytes'});
  object.writeHttpMetadata(h);const ext=path.split('.').pop();h.set('Content-Type',ext==='json'?'application/json':ext==='png'?'image/png':['jpg','jpeg'].includes(ext??'')?'image/jpeg':ext==='webp'?'image/webp':'application/octet-stream');
  if(!('body' in object))return new Response(null,{status:req.headers.has('if-none-match')?304:412,headers:h});
  if(req.headers.has('range')&&object.range&&'offset' in object.range&&object.range.offset!==undefined){const length=object.range.length??object.size-object.range.offset;h.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+length-1}/${object.size}`);h.set('Content-Length',String(length));return new Response(object.body,{status:206,headers:h});}
  h.set('Content-Length',String(object.size));return new Response(object.body,{headers:h});
 }catch(e){if(!(e instanceof HttpError))console.error('Asset request failed',e instanceof Error?e.message:'unknown');return json({error:e instanceof HttpError?e.message:'资源读取失败'},e instanceof HttpError?e.status:500);}
}
