import {db,all,one,run,log,type SceneRow,type AssetRow} from './store';
import {HttpError,uid,now,safePath} from './security';
import {validateDraft,publishIssues,assetIds,dependencyPaths} from './validation';
import bundledResources from '@/config/resource-index.json';
import {initialSceneCatalog,siteConfig} from '../campus-config';
export async function seed(adminId:string){
 const statements=[db().prepare('INSERT OR IGNORE INTO settings (id,data) VALUES (?,?)').bind('site',JSON.stringify(siteConfig))];
 initialSceneCatalog.forEach((s,i)=>{const data=JSON.stringify(s.definition);statements.push(db().prepare('INSERT OR IGNORE INTO scenes (id,draft,revision,published,position,hidden,archived,updatedAt) VALUES (?,?,1,?,?,0,0,?)').bind(s.definition.id,data,data,i,now()));});
 for(const s of initialSceneCatalog)statements.push(db().prepare('INSERT INTO releases (id,sceneId,data,createdAt,adminId) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM releases WHERE sceneId=?)').bind(uid(),s.definition.id,JSON.stringify(s.definition),now(),adminId,s.definition.id));
 await db().batch(statements);await log(adminId,'import-initial-content','site');
}
export async function checkAssets(value:unknown){
 const issues=publishIssues(value);
 const urls:string[]=[];const visit=(v:unknown)=>{if(typeof v==='string'&&v.startsWith('/'))urls.push(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(value);
 for(const url of new Set(urls))if(!url.startsWith('/api/assets/')&&!bundledResources.includes(url))issues.push(`本地资源不存在：${url}`);
 for(const id of assetIds(value)){
  const a=await one<AssetRow>('SELECT * FROM assets WHERE id=?',id);
  if(!a||a.status!=='ready'){issues.push(`资源 ${id} 不存在或未校验完成`);continue;}
  const meta=JSON.parse(a.metadata);if(meta.files){
   for(const file of meta.files as {path:string;dependencies?:string[]}[])for(const dep of file.dependencies??[]){
    if(/^[a-z]+:/i.test(dep)||dep.startsWith('/')){issues.push(`${file.path}：目录依赖必须是相对路径`);continue;}
    const stack=file.path.split('/').slice(0,-1);for(const part of dep.split('/')){if(part==='..')stack.pop();else if(part!=='.')stack.push(part);}const path=stack.join('/');
    try{safePath(path);}catch{issues.push(`无效依赖：${dep}`);continue;}
    if(!meta.files.some((x:{path:string})=>x.path===path))issues.push(`缺少依赖文件：${path}`);
   }
  }
 }
 return issues;
}
export async function saveScene(id:string,value:unknown,revision:number,adminId:string){
 const s=validateDraft(value);if(s.id!==id)throw new HttpError(400,'场景编号不可修改');
 const result=await run('UPDATE scenes SET draft=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=?',JSON.stringify(s),now(),id,revision);
 if(!result.meta.changes)throw new HttpError(409,'草稿已被其他窗口修改，请先重新载入');await log(adminId,'save-draft',id);return revision+1;
}
export async function publish(id:string,revision:number,adminId:string,releaseId?:string){
 const row=await one<SceneRow>('SELECT * FROM scenes WHERE id=?',id);if(!row)throw new HttpError(404,'场景不存在');
 let value=JSON.parse(row.draft);
 if(releaseId){const r=await one<{data:string}>('SELECT data FROM releases WHERE id=? AND sceneId=?',releaseId,id);if(!r)throw new HttpError(404,'历史版本不存在');value=JSON.parse(r.data);}
 const issues=await checkAssets(value);if(issues.length)throw new HttpError(422,issues.join('\n'));
 const data=JSON.stringify(value),release=uid(),time=now();
 const results=await db().batch([
  db().prepare('UPDATE scenes SET published=?,draft=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=?').bind(data,data,time,id,revision),
  db().prepare('INSERT INTO releases (id,sceneId,data,createdAt,adminId) SELECT ?,?,?,?,? WHERE changes()=1').bind(release,id,data,time,adminId),
 ]);
 if(!results[0].meta.changes)throw new HttpError(409,'草稿已变化，请重新载入后发布');await log(adminId,releaseId?'rollback':'publish',id);return revision+1;
}
export async function assetReferenced(id:string){
 const needle=`/api/assets/${id}/`;
 return Boolean(await one('SELECT id FROM scenes WHERE instr(draft,?)>0 OR instr(published,?)>0 LIMIT 1',needle,needle)||await one('SELECT id FROM releases WHERE instr(data,?)>0 LIMIT 1',needle)||await one("SELECT id FROM conversion_jobs WHERE (assetId=? OR resultId=?) AND state NOT IN ('failed','cancelled') LIMIT 1",id,id));
}
export {dependencyPaths,all};
