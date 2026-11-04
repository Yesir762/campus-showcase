import {sceneSchema,resolveScene,bindingSchema,versionSchema,type SceneDefinition} from '../scene-schema.ts';
import {resourceUrl,HttpError} from './security.ts';
export function validateDraft(value:unknown):SceneDefinition{
 const s=sceneSchema.parse(value);if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(s.id))throw new HttpError(400,'场景编号只能包含小写字母、数字和连字符');
 if(!s.title.trim())throw new HttpError(400,'请填写场景名称');
 resourceUrl(s.poster);for(const c of s.content){if(c.image)resourceUrl(c.image);}
 for(const v of Object.values(s.versions)){const version=versionSchema.parse(v);resourceUrl(version.desktopUrl);if(version.mobileUrl)resourceUrl(version.mobileUrl);resourceUrl(version.poster);for(const x of version.variants)resourceUrl(x.url);}
 for(const b of Object.values(s.bindings))bindingSchema.parse(b);
 if(JSON.stringify(s).length>2*1024*1024)throw new HttpError(413,'场景配置过大');return s;
}
export function publishIssues(value:unknown){
 const issues:string[]=[];let s:SceneDefinition;try{s=validateDraft(value);}catch(e){return [(e as Error).message];}
 if(s.availability==='ready'){const r=resolveScene(s);if(r.issue)issues.push(r.issue);}
 const ids=s.content.map(c=>c.id);if(new Set(ids).size!==ids.length)issues.push('图文内容编号重复');
 for(const [id,b] of Object.entries(s.bindings)){
  const x=bindingSchema.parse(b);if(new Set(x.markers.map(m=>m.placeId)).size!==x.markers.length)issues.push(`${id}：热点编号重复`);
  if(x.views.some(v=>v.camera.every((n,i)=>Math.abs(n-v.target[i])<1e-6)))issues.push(`${id}：相机与观察目标不能重合`);
  for(const m of x.markers)if(m.maxDistance!==undefined&&m.maxDistance<=m.minDistance)issues.push(`${id}：热点 ${m.placeId} 的距离范围无效`);
 }
 return issues;
}
export function assetIds(value:unknown){const text=JSON.stringify(value);return [...new Set([...text.matchAll(/\/api\/assets\/([a-f0-9-]{36})\//g)].map(m=>m[1]))];}
export function dependencyPaths(value:unknown):string[]{
 const paths:string[]=[];const visit=(v:unknown)=>{if(typeof v==='string'&&/\.(?:sog|webp|json|bin|ply)(?:$|[?#])/i.test(v))paths.push(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(value);return paths;
}
