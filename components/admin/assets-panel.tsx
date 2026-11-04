'use client';
import {useEffect,useRef,useState} from 'react';
import {request,assetUrl,stageLabels,type Asset,type Job,type Upload} from './model';
export function AssetsPanel({onUse,onMessage}:{onUse:(a:Asset)=>void;onMessage:(m:string)=>void}){
 const [assets,setAssets]=useState<Asset[]>([]),[jobs,setJobs]=useState<Job[]>([]),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[health,setHealth]=useState<{nodes:{id:string;lastSeen:number}[];storage:{bytes:number;count:number}}|null>(null);const input=useRef<HTMLInputElement>(null),folder=useRef<HTMLInputElement>(null),cancel=useRef(false);
 const refresh=async()=>{const [a,j,h]=await Promise.all([request<Asset[]>('assets'),request<Job[]>('jobs'),request<NonNullable<typeof health>>('health')]);setAssets(a);setJobs(j);setHealth(h);};
 useEffect(()=>{refresh().catch(e=>onMessage(e.message));const timer=setInterval(()=>refresh().catch(()=>{}),5000);return()=>{clearInterval(timer);cancel.current=true;};},[]);
 const act=async(path:string,method='POST',data?:unknown)=>{try{await request(path,method,data);await refresh();}catch(e){onMessage((e as Error).message);}};
 async function upload(files:File[]){
  if(!files.length)return;cancel.current=false;setBusy(true);let id='';
  try{
   const manifest=files.map(f=>({path:f.webkitRelativePath||f.name,bytes:f.size}));const fingerprint=JSON.stringify(files.map(f=>[f.webkitRelativePath||f.name,f.size,f.lastModified]));
   const key=`campus-upload-${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(n=>n.toString(16).padStart(2,'0')).join('')}`;
   id=localStorage.getItem(key)??'';let rows:Upload[]=[],partSize=8*1024*1024;
   if(id)rows=await request<Upload[]>(`uploads/${id}`);if(!rows.length){const result=await request<{id:string;partSize:number;uploads:Upload[]}>('assets','POST',{name:files.length===1?files[0].name:files[0].webkitRelativePath.split('/')[0],files:manifest});id=result.id;rows=result.uploads;partSize=result.partSize;localStorage.setItem(key,id);}
   const total=manifest.reduce((n,f)=>n+f.bytes,0);let done=0;
   for(let index=0;index<files.length;index++){
    const file=files[index],row=rows.find(r=>r.key.endsWith(`/${manifest[index].path}`));if(!row)throw Error('续传文件不匹配，请使用原文件重试');const parts=JSON.parse(row.parts) as {partNumber:number}[];
    for(let n=0;n<Math.ceil(file.size/partSize);n++){
     if(cancel.current)throw Error('已暂停，重新选择相同文件可续传');const chunk=file.slice(n*partSize,Math.min(file.size,(n+1)*partSize));
     if(!parts.some(p=>p.partNumber===n+1)){let success=false;for(let attempt=0;attempt<3;attempt++){const response=await fetch(`/api/admin/uploads/${row.id}/${n+1}`,{method:'PUT',headers:{'X-Admin-Request':'1'},body:chunk});if(response.ok){success=true;break;}if(attempt===2){const data=await response.json() as {error?:string};throw Error(data.error??'分片上传失败');}}if(!success)throw Error('上传失败');}
     done+=chunk.size;setProgress(`${file.name} · ${Math.round(done/total*100)}%`);
    }
   }
   setProgress('校验文件与目录依赖…');await request(`assets/${id}/complete`,'POST',{});localStorage.removeItem(key);setProgress('上传完成。模型请点击“转为 SOG”或“校验 SOG”。');await refresh();
  }catch(e){onMessage((e as Error).message);setProgress('上传未完成，重新选择相同文件可继续；无效资源可从列表删除。');await refresh().catch(()=>{});}finally{setBusy(false);if(input.current)input.current.value='';if(folder.current)folder.current.value='';}
 }
 return <div className="ad-assets"><div className="ad-panel-title"><div><p className="ad-eyebrow">RESOURCE LIBRARY</p><h2>模型与资源</h2></div><span>{health?`${health.storage.count} 项 · ${(health.storage.bytes/1e9).toFixed(2)} GB`:''}</span></div><div className="ad-upload"><h3>上传模型，一键转为 SOG</h3><p>支持高斯 PLY、压缩 PLY、SPLAT、KSPLAT、SPZ；SOG 校验后直接入库。普通点云与网格不支持转换。</p><div className="ad-inline"><button className="ad-primary" disabled={busy} onClick={()=>input.current?.click()}>上传文件</button><button disabled={busy} onClick={()=>folder.current?.click()}>导入 SOG 目录</button>{busy&&<button onClick={()=>{cancel.current=true;}}>暂停上传</button>}</div><input hidden ref={input} type="file" accept=".ply,.sog,.splat,.ksplat,.spz,.png,.jpg,.jpeg,.webp" onChange={e=>upload(Array.from(e.target.files??[]))}/><input hidden ref={folder} type="file" {...{webkitdirectory:'',directory:''} as object} multiple onChange={e=>upload(Array.from(e.target.files??[]))}/><p role="status">{progress||'分片上传 · 失败可续传 · 保留原始文件'}</p></div>
 <div className="ad-health"><b>转换服务</b>{health?.nodes.length?health.nodes.map(n=><span key={n.id}>{n.id} · {Date.now()-n.lastSeen<120000?'在线':'离线'}</span>):<span>尚未连接转换节点，请部署 converter 服务</span>}</div>
 <div className="ad-resource-list">{assets.map(a=>{const meta=JSON.parse(a.metadata);return <article key={a.id}><div className="ad-file-icon">{a.format.toUpperCase()}</div><div className="ad-resource-copy"><h3>{a.name}</h3><p>{stageLabels[a.status]??a.status} · {(a.bytes/1e6).toFixed(2)} MB{meta.points?` · ${meta.points.toLocaleString()} 点`:''}</p><small>{meta.converter??a.id}</small></div><div className="ad-inline">{a.status==='uploaded'&&<button onClick={()=>act('jobs','POST',{assetId:a.id})}>{a.format==='sog'?'校验 SOG':'转为 SOG'}</button>}{a.status==='ready'&&<><button onClick={()=>onUse(a)}>用于当前场景</button><a href={assetUrl(a)} download={a.name}>下载</a></>}<button className="ad-danger" onClick={()=>{if(confirm('删除该资源？被草稿或历史版本引用的资源无法删除。'))act(`assets/${a.id}`,'DELETE');}}>删除</button></div></article>;})}{!assets.length&&<p className="ad-empty">上传第一个模型，建立你的三维资源库。</p>}</div>
 <h3>转换任务</h3>{jobs.map(j=><div key={j.id} className="ad-job"><div><b>{assets.find(a=>a.id===j.assetId)?.name??j.assetId}</b><p>{stageLabels[j.state]??j.state} · {new Date(j.updatedAt).toLocaleString()}{j.error&&<span className="ad-error">{j.error}</span>}</p></div><div>{['failed','cancelled'].includes(j.state)?<button onClick={()=>act(`jobs/${j.id}/retry`)}>重试</button>:!['succeeded'].includes(j.state)&&<button onClick={()=>act(`jobs/${j.id}/cancel`)}>取消</button>}</div></div>)}
 </div>;
}
