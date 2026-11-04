'use client';
import {useEffect,useRef,useState} from 'react';
import type {SceneBindings,SceneVersion} from '@/lib/scene-schema';
import type {SplatViewer} from '@/lib/playcanvas-viewer';
type Vec3=[number,number,number];
export function EditorCanvas({binding,version,selected,onReady,onPosition}:{binding:SceneBindings|null;version:SceneVersion|null;selected:string|null;onReady:(v:SplatViewer|null)=>void;onPosition:(position:Vec3)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),viewer=useRef<SplatViewer|null>(null),abort=useRef<AbortController|null>(null),bindingRef=useRef(binding),versionRef=useRef(version),readyRef=useRef(onReady);bindingRef.current=binding;versionRef.current=version;readyRef.current=onReady;
 const [state,setState]=useState('idle'),[message,setMessage]=useState(''),[tick,setTick]=useState(0);const last=useRef(0),dragging=useRef(false);
 useEffect(()=>()=>{abort.current?.abort();viewer.current?.destroy();readyRef.current(null);},[]);
 useEffect(()=>{abort.current?.abort();viewer.current?.destroy();viewer.current=null;readyRef.current(null);setState('idle');},[version?.desktopUrl,version?.format]);
 useEffect(()=>{if(binding&&viewer.current){viewer.current.setMarkers(binding.markers);viewer.current.setTransform(binding.transform);viewer.current.setCameraOptions(binding.camera);}},[binding]);
 const load=async()=>{
  if(!canvas.current||!bindingRef.current||!versionRef.current)return;abort.current?.abort();viewer.current?.destroy();const controller=new AbortController();abort.current=controller;setState('loading');setMessage('正在下载与准备模型');
  try{const b=bindingRef.current,v=versionRef.current;const initial=b.views.find(x=>x.id===b.camera.initialViewId)??b.views[0];const {createSplatViewer}=await import('@/lib/playcanvas-viewer');
   const instance=await createSplatViewer(canvas.current,{url:v.desktopUrl,streamed:v.format==='streamed-sog',transform:b.transform,initial,...b.camera,mode:'orbit',markers:b.markers,signal:controller.signal,onCamera:()=>{if(performance.now()-last.current>100){last.current=performance.now();setTick(x=>x+1);}},onError:m=>{setMessage(m);setState('error');}},p=>setMessage(p.phase==='download'?`下载模型${p.percent===undefined?'':` ${p.percent}%`}`:p.phase==='parse'?'解析模型':'已就绪'));
   if(controller.signal.aborted){instance.destroy();return;}viewer.current=instance;readyRef.current(instance);setState('ready');
  }catch(e){if(controller.signal.aborted)return;setState('error');setMessage((e as Error).message);}
 };
 const marker=binding?.markers.find(m=>m.placeId===selected),camera=viewer.current?.getCamera();const length=camera?Math.max(.1,Math.hypot(...camera.camera.map((n,i)=>n-camera.target[i]))*.12):1;
 const project=(p:Vec3)=>viewer.current?.project(p);const anchor=marker?project(marker.position):null;
 function dragAxis(event:React.PointerEvent,axis:number){
  if(!marker||!viewer.current||!anchor)return;event.preventDefault();event.stopPropagation();dragging.current=true;
  const origin=[...marker.position] as Vec3,end=[...origin] as Vec3;end[axis]+=length;const projected=project(end)!;const dx=projected.x-anchor.x,dy=projected.y-anchor.y,denom=dx*dx+dy*dy;
  if(denom<4)return;const start=[event.clientX,event.clientY];let next=origin;
  const move=(e:PointerEvent)=>{next=[...origin] as Vec3;next[axis]+=((e.clientX-start[0])*dx+(e.clientY-start[1])*dy)/denom*length;viewer.current?.setMarkers(binding!.markers.map(m=>m.placeId===selected?{...m,position:next}:m));};
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);dragging.current=false;onPosition(next);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',up,{once:true});
 }
 return <div className="ad-stage" data-tick={tick}><canvas ref={canvas} tabIndex={0} aria-label="模型编辑画布，拖动旋转，右键平移，滚轮缩放"/>{state!=='ready'&&<div className="ad-stage-gate"><span className="ad-orbit">◎</span><h2>{!version?'为场景添加模型':state==='loading'?'正在准备三维空间':'三维编辑预览'}</h2><p>{state==='idle'?'载入后调整视角、放置热点；修改先保存在草稿中。':message}</p>{version&&state!=='loading'&&<button className="ad-primary" onClick={load}>{state==='error'?'重新载入':'载入模型'}</button>}</div>}
 {state==='ready'&&<><div className="ad-canvas-hint">拖动旋转 · 右键平移 · 滚轮缩放<span>编辑模式：自由观察</span></div><svg className="ad-overlay" aria-label="热点位置与三轴手柄">{binding?.markers.map(m=>{const p=project(m.position);return p?.visible?<g key={m.placeId}><circle cx={p.x} cy={p.y} r={m.placeId===selected?9:5} fill={m.placeId===selected?'#e7a34d':'#2e79bf'}/><text x={p.x+13} y={p.y+4}>{m.placeId}</text></g>:null;})}{anchor?.visible&&marker&&[0,1,2].map(axis=>{const p=[...marker.position] as Vec3;p[axis]+=length;const end=project(p)!;return <g key={axis} className="ad-axis" onPointerDown={e=>dragAxis(e,axis)}><line x1={anchor.x} y1={anchor.y} x2={end.x} y2={end.y} stroke={['#e26767','#49ac7d','#639bdf'][axis]} strokeWidth="5"/><circle cx={end.x} cy={end.y} r="9" fill={['#e26767','#49ac7d','#639bdf'][axis]}/><text x={end.x+12} y={end.y}>{['X','Y','Z'][axis]}</text></g>;})}</svg><button className="ad-reload" onClick={load}>重新载入预览</button></>}
 </div>;
}
