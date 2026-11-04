export class HttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export const uid=()=>crypto.randomUUID();
export const now=()=>Date.now();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string|ArrayBuffer){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)));}
export async function passwordHash(password:string,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return `pbkdf2$${salt}$${hex(new Uint8Array(hash))}`;
}
export function safeEqual(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export async function verifyPassword(value:string,hash:string){const [kind,salt]=hash.split('$');return kind==='pbkdf2'&&safeEqual(await passwordHash(value,salt),hash);}
export function assertOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError(403,'请求来源校验失败');if(req.headers.get('x-admin-request')!=='1')throw new HttpError(403,'缺少请求校验标记');}
export function resourceUrl(value:string){
 if(typeof value!=='string')throw new HttpError(400,'资源地址必须是文本');
 if(value.startsWith('/')&&!/%(?:2e|2f|5c)/i.test(value)&&!value.startsWith('//')&&!/[\\\u0000-\u001f]/.test(value)&&!value.includes('..'))return value;
 let u:URL;try{u=new URL(value);}catch{throw new HttpError(400,'资源地址必须是 HTTPS 或本站路径');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':'))throw new HttpError(400,'资源地址不允许内网、IP 或带认证信息的地址');return u.href;
}
export function safePath(value:string){if(!value||value.length>500||value.startsWith('/')||value.split('/').some(s=>!s||s==='.'||s==='..')||/[\\\u0000-\u001f]/.test(value))throw new HttpError(400,'资源相对路径无效');return value;}
export function fileFormat(name:string){const ext=name.toLowerCase().split('.').pop()??'';if(!['ply','sog','splat','ksplat','spz','json','webp','png','jpg','jpeg'].includes(ext))throw new HttpError(400,'不支持该文件类型');return ext;}
export function validateSourceHeader(name:string,head:Uint8Array,bytes:number){
 const f=fileFormat(name),s=new TextDecoder().decode(head);
 if(f==='ply'){
  if(!s.startsWith('ply')||!s.includes('end_header'))throw new HttpError(400,'PLY 文件头无效或过大');
  const compressed=/element chunk\s+\d+/.test(s)&&/packed_position/.test(s)&&/packed_rotation/.test(s)&&/packed_scale/.test(s)&&/packed_color/.test(s);
  if(!compressed&&['x','y','z','scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3','opacity'].some(n=>!new RegExp(`property\\s+\\S+\\s+${n}(?:\\s|$)`).test(s)))throw new HttpError(400,'这是普通点云或缺少高斯属性的 PLY');
 }
 if(f==='sog'&&!(head[0]===80&&head[1]===75))throw new HttpError(400,'SOG 必须是有效的打包文件');
 if(f==='splat'&&bytes%32!==0)throw new HttpError(400,'SPLAT 数据长度无效');
 if(f==='spz'&&!(head[0]===31&&head[1]===139)&&s.slice(0,4)!=='NGSP')throw new HttpError(400,'SPZ 文件头无效');
 if(f==='ksplat'&&head[0]!==0)throw new HttpError(400,'KSPLAT 版本头无效');
 if(f==='json'){try{JSON.parse(s);}catch{throw new HttpError(400,'JSON 文件无效或超出 256 KB 限制');}}
 if(f==='png'&&!(head[0]===137&&s.slice(1,4)==='PNG'))throw new HttpError(400,'PNG 文件无效');
 if(['jpg','jpeg'].includes(f)&&!(head[0]===255&&head[1]===216))throw new HttpError(400,'JPEG 文件无效');
 if(f==='webp'&&!(head[0]===82&&head[1]===73&&head[2]===70&&head[3]===70&&head[8]===87&&head[9]===69&&head[10]===66&&head[11]===80))throw new HttpError(400,'WebP 文件无效');
 return f;
}
