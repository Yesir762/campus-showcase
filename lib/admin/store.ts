import {env} from 'cloudflare:workers';
import {HttpError,uid,now,digest} from './security';
export function db(){if(!env.DB)throw new HttpError(503,'数据库尚未配置，请先完成部署初始化');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new HttpError(503,'模型存储尚未配置');return env.BUCKET;}
export async function all<T=Record<string,unknown>>(sql:string,...args:unknown[]):Promise<T[]>{return (await db().prepare(sql).bind(...args).all<T>()).results;}
export async function one<T=Record<string,unknown>>(sql:string,...args:unknown[]):Promise<T|null>{return db().prepare(sql).bind(...args).first<T>();}
export async function run(sql:string,...args:unknown[]){return db().prepare(sql).bind(...args).run();}
export async function log(adminId:string,action:string,target:string){await run('INSERT INTO audit_log (id,adminId,action,target,createdAt) VALUES (?,?,?,?,?)',uid(),adminId,action,target,now());}
export async function authenticate(req:Request){
 const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('campus_admin='))?.slice(13);
 if(!token)throw new HttpError(401,'请先登录管理员账号');
 const user=await one<{id:string;username:string}>('SELECT a.id,a.username FROM admins a JOIN admin_sessions s ON s.adminId=a.id WHERE s.id=? AND s.expiresAt>?',await digest(token),now());
 if(!user)throw new HttpError(401,'登录已过期');return user;
}
export const json=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function body(req:Request):Promise<Record<string, any>>{
 if(!req.body)throw new HttpError(400,'缺少请求内容');
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024){await reader.cancel();throw new HttpError(413,'请求过大');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'JSON 请求无效');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'请求必须是对象');return value;
}
export type SceneRow={id:string;draft:string;revision:number;published:string|null;position:number;hidden:number;archived:number;updatedAt:number};
export type AssetRow={id:string;name:string;format:string;status:string;bytes:number;key:string;metadata:string;createdAt:number};
export type JobRow={id:string;assetId:string;resultId:string|null;state:string;error:string|null;lease:string|null;leaseUntil:number|null;startedAt:number|null;updatedAt:number;createdAt:number;attempt:number};
