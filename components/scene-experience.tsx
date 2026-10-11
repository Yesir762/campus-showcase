'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Expand,Shrink,Focus,Compass,X,Rotate3D,MousePointer2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import type {SceneVersion,SceneBindings,SceneDefinition} from '@/lib/campus-config';
import type {SplatViewer,ViewerProgress,ViewerMetrics} from '@/lib/playcanvas-viewer';
import {WalkJoystick} from './walk-joystick';
import GlideSelect from './react-bits/GlideSelect';
import {SectionTitle} from './campus-motion';
import styles from '@/app/page.module.css';
type State='idle'|'loading'|'ready'|'error'|'unsupported'|'mobile-fallback';
const mobileQuery='(max-width:1024px) and (pointer:coarse)';
const resourceSize=(bytes?:number)=>bytes?`约 ${(bytes/1000000).toFixed(1)} MB`:'按需加载';
function ModelGate({state,progress,notice,label,onStart}:{state:State;progress:ViewerProgress;notice:string;label:string;onStart:()=>void}) {
 if(state==='ready')return null;
 return <div className={styles.viewerGate} aria-live="polite" role={['error','unsupported','mobile-fallback'].includes(state)?'alert':undefined}><span className={styles.gateIcon}><Rotate3D/></span>
  <h3>{state==='idle'?'进入三维场景':state==='loading'?(progress.phase==='download'?'下载模型资源':'解析与建立场景'):state==='unsupported'?'当前浏览器不支持 WebGL2':state==='mobile-fallback'?'手机轻量模型尚未配置':'三维场景加载失败'}</h3>
  <p>{state==='idle'?notice:state==='loading'?'下载完成后仍需解码与准备场景，请稍候。':'图文内容仍可独立浏览。'}</p>
  {state==='idle'&&<><small>已选择：{label}</small><Button className={styles.primaryButton} onClick={onStart}>载入测试场景 <MousePointer2/></Button><small>点击后才下载三维资源</small></>}
  {state==='loading'&&<><Progress value={progress.percent??null} className={styles.progress}/><small>{progress.percent===undefined?'正在处理，请稍候':`${progress.percent}%`}</small></>}
  {state==='error'&&<Button onClick={onStart} className={styles.primaryButton}>重新载入</Button>}
  {['error','unsupported','mobile-fallback'].includes(state)&&<a className={styles.fallbackLink} href="#places">浏览图文介绍</a>}
 </div>;
}
export function SceneExperience({scene,bindings,definition}:{scene:SceneVersion;bindings:SceneBindings;definition:SceneDefinition}) {
 const [state,setState]=useState<State>('idle'),[variantId,setVariantId]=useState(scene.defaultVariant??''),[viewId,setViewId]=useState(bindings.camera.initialViewId);
 const [mobile,setMobile]=useState(false),[diagnostic,setDiagnostic]=useState(false),[fullscreen,setFullscreen]=useState(false),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState('');
 const [metrics,setMetrics]=useState<ViewerMetrics|null>(null),[progress,setProgress]=useState<ViewerProgress>({phase:'download'}),[fading,setFading]=useState(false);
 const [markers,setMarkers]=useState<{placeId:string;x:number;y:number;visible:boolean}[]>([]);
 const viewer=useRef<SplatViewer|null>(null),abort=useRef<AbortController|null>(null),canvas=useRef<HTMLCanvasElement>(null),stage=useRef<HTMLDivElement>(null),transition=useRef<ReturnType<typeof setTimeout>|null>(null);
 const walk=definition.mode==='walk';const variant=scene.variants.find(v=>v.id===variantId);const place=definition.content.find(c=>c.id===selected);
 const mobileLabel=`${scene.mobileLabel} · ${resourceSize(scene.mobileBytes)}`;
 const instruction=walk?'WASD 行走 · 拖动观察 · 方向键转向':'拖动旋转 · 右键平移 · 滚轮缩放';
 const cancelTransition=useCallback(()=>{if(transition.current)clearTimeout(transition.current);transition.current=null;setFading(false);},[]);
 const stop=useCallback(()=>{abort.current?.abort();viewer.current?.destroy();viewer.current=null;cancelTransition();setMetrics(null);setMarkers([]);},[cancelTransition]);
 useEffect(()=>{const q=window.matchMedia(mobileQuery);const update=()=>setMobile(q.matches);update();q.addEventListener('change',update);setDiagnostic(new URLSearchParams(window.location.search).get('model-compare')==='1');return()=>q.removeEventListener('change',update);},[]);
 useEffect(()=>()=>{abort.current?.abort();viewer.current?.destroy();if(transition.current)clearTimeout(transition.current);},[]);
 useEffect(()=>{const el=canvas.current;const lost=(event:Event)=>{event.preventDefault();stop();setError('图形上下文丢失，请重新载入。');setState('error');};el?.addEventListener('webglcontextlost',lost);return()=>el?.removeEventListener('webglcontextlost',lost);},[stop]);
 useEffect(()=>{viewer.current?.setPaused(Boolean(selected)||fading);},[selected,fading]);
 useEffect(()=>{
  if(!fullscreen||!stage.current)return;const doc=stage.current.ownerDocument,previous=doc.body.style.overflow,focus=doc.activeElement as HTMLElement|null;
  doc.body.style.overflow='hidden';stage.current.querySelector<HTMLButtonElement>('[data-fullscreen-toggle]')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setFullscreen(false);viewer.current?.stopMotion();}else if(e.key==='Tab'){const items=[...stage.current!.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],canvas[tabindex="0"]')];if(e.shiftKey&&doc.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&doc.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}};
  doc.addEventListener('keydown',key,true);return()=>{doc.body.style.overflow=previous;doc.removeEventListener('keydown',key,true);if(focus?.isConnected)focus.focus({preventScroll:true});};
 },[fullscreen]);
 const start=async()=>{
  stop();setError('');setSelected(null);setState('loading');setProgress({phase:'download'});
  const controller=new AbortController();abort.current=controller;
  try{
   const touch=window.matchMedia(mobileQuery).matches;const url=touch?scene.mobileUrl:variant?.url??scene.desktopUrl;
   if(touch&&!url){setState('mobile-fallback');return;}if(!url||!canvas.current)throw Error('模型资源尚未准备完成');
   if(!document.createElement('canvas').getContext('webgl2')){setState('unsupported');return;}
   const {createSplatViewer}=await import('@/lib/playcanvas-viewer');
   if(controller.signal.aborted)return;
   const current=bindings.views.find(v=>v.id===viewId)!;
   const instance=await createSplatViewer(canvas.current,{url,transform:bindings.transform,initial:current,...bindings.camera,mode:definition.mode,navigation:bindings.navigation,streamed:(touch?scene.mobileFormat:variant?.format??scene.format)==='streamed-sog',maxPixelRatio:touch?1:1.5,markers:bindings.markers,signal:controller.signal,
    onMarkers:items=>{if(!controller.signal.aborted)setMarkers(items);},
    onMetrics:next=>{if(!controller.signal.aborted)setMetrics(next);},
    onError:message=>{if(!controller.signal.aborted){setError(message);controller.abort();cancelTransition();setState('error');}},
   },next=>{if(!controller.signal.aborted)setProgress(next);});
   if(controller.signal.aborted){instance.destroy();return;}viewer.current=instance;setState('ready');
  }catch(e){if(controller.signal.aborted)return;stop();setError(e instanceof Error?e.message:'模型无法读取');setState('error');}
 };
 const goToView=(id:string)=>{
  const view=bindings.views.find(v=>v.id===id);if(!view)return;cancelTransition();viewer.current?.stopMotion();setViewId(id);
  if(!walk||state!=='ready'){viewer.current?.goToView(view.camera,view.target);return;}
  setFading(true);viewer.current?.setPaused(true);
  transition.current=setTimeout(()=>{if(abort.current?.signal.aborted)return;try{viewer.current?.goToView(view.camera,view.target);}catch(e){setError((e as Error).message);}setFading(false);transition.current=null;},220);
 };
 const selectPlace=(id:string)=>{setSelected(id);viewer.current?.stopMotion();const location=bindings.locations.find(l=>l.placeId===id);if(location)goToView(location.viewId);stage.current?.scrollIntoView({behavior:'smooth',block:'center'});};
 return <>
  <section id="campus-3d" className={styles.experienceSection}><div className={styles.sectionHeading}><div><p className={styles.kicker}>{walk?'展厅漫游':'数字校园'}</p><h2>{walk?'走进空间，探索航海文化':'在浏览器里，漫游校园光影'}</h2></div><div className={styles.sceneStatus}><span className={styles.statusDot}/><div><b>{scene.label}</b><small>更新于 {scene.updatedAt}</small></div></div></div>
   {mobile?<div className={styles.modelControls}><span>{scene.mobileUrl?mobileLabel:'手机轻量资源准备中'}</span></div>:scene.variants.length>0&&<div className={styles.modelControls}><div className={styles.modelPicker}><span>模型精度</span><GlideSelect value={variantId} options={scene.variants.filter(v=>diagnostic||!v.diagnostic).map(v=>({value:v.id,label:v.label,tag:v.bytes?`${(v.bytes/1000000).toFixed(1)} MB`:'按需'}))} onChange={value=>{stop();setVariantId(value);setViewId(bindings.camera.initialViewId);setSelected(null);setError('');setState('idle');}} ariaLabel="模型精度" size="lg" menuWidth={340} accentColor="var(--brand)" surfaceColor="#ffffff" highlightColor="#deedfc" textColor="#234c74" radius={10} /></div><span>{resourceSize(variant?.bytes)}{variant?.points?` · ${(variant.points/10000).toFixed(0)} 万点`:''} · 切换后点击载入</span></div>}
   <div data-model-active={state==='loading'||state==='ready'} ref={stage} className={`${styles.experience} ${fullscreen?styles.pageFullscreen:''}`} role={fullscreen?'dialog':undefined} aria-modal={fullscreen||undefined} aria-label={fullscreen?'三维校园全屏浏览':undefined}>
    <div className={styles.viewer}><canvas ref={canvas} className={styles.canvas} tabIndex={0} aria-label={`${definition.title}三维画布，${instruction}`}/>
     <ModelGate state={state} progress={progress} notice={mobile?`手机使用${mobileLabel}。${walk?'左侧摇杆移动，右侧滑动观察。':'单指旋转，双指缩放与平移。'}`:scene.modelNotice} label={mobile?mobileLabel:variant?.label??scene.label} onStart={start}/>
     {state==='ready'&&<><div className={styles.viewerHint}>{mobile&&walk?'左侧移动 · 右侧滑动观察':instruction}</div>{markers.filter(m=>m.visible).map(m=><button key={m.placeId} className={styles.marker} style={{left:m.x,top:m.y}} aria-label={`查看${definition.content.find(c=>c.id===m.placeId)?.name??'详情'}`} onClick={()=>selectPlace(m.placeId)}><span>●</span></button>)}
      <div className={styles.viewTabs} aria-label={walk?'展区视点':'预设视角'}>{bindings.views.map(v=><button key={v.id} className={viewId===v.id?styles.viewActive:''} onClick={()=>{setSelected(null);goToView(v.id);}}>{v.name}</button>)}</div>
      {walk&&!selected&&!fading&&<WalkJoystick onMove={(x,z)=>viewer.current?.setMove(x,z)}/>}</>}
     {(state==='ready'||fullscreen)&&<div className={styles.viewerTools}>{state==='ready'&&<button aria-label={walk?'回到入口':'回到初始视角'} title={walk?'回到入口':'回到初始视角'} onClick={()=>{setSelected(null);goToView(bindings.camera.initialViewId);}}><Focus/></button>}<button data-fullscreen-toggle onClick={()=>{viewer.current?.stopMotion();setFullscreen(!fullscreen);}} aria-label={fullscreen?'退出全屏':'进入全屏'} title={fullscreen?'退出全屏':'进入全屏'} aria-pressed={fullscreen}>{fullscreen?<Shrink/>:<Expand/>}</button></div>}
     {walk&&<div className={`${styles.walkFade} ${fading?styles.walkFading:''}`} aria-hidden="true"/>}
    </div>
    <aside className={`${styles.placePanel} ${place?styles.placePanelOpen:''}`} aria-live="polite">{place?<><button className={styles.closePanel} aria-label="关闭景点介绍" onClick={()=>{setSelected(null);canvas.current?.focus();}}><X/></button><p className={styles.kicker}>{place.category}</p><h3>{place.name}</h3><p>{place.description}</p><p className={styles.panelMeta}>{bindings.locations.some(l=>l.placeId===place.id)?'已校准观察视点':'位置待校准 · 图文独立展示'}</p></>:<div className={styles.panelEmpty}><Compass/><h3>{definition.title.replace('武汉理工大学（余家头校区）','')}</h3><p>{walk?'仅在已校准的单层区域行走。可回到入口或选择展区。':'当前为实测扫描区域。拖动观察或选择预设视角；未校准景点不开放定位。'}</p></div>}</aside>
   </div>
   {error&&<p role="alert" className={styles.performanceInfo}>{error}</p>}
   {metrics&&<details className={styles.performanceInfo}><summary>模型运行信息</summary><p>首次可交互：{metrics.loadSeconds.toFixed(1)} 秒；近 60 秒中位帧率：{Math.round(metrics.medianFps)} FPS；浏览时长：{Math.round(metrics.elapsedSeconds)} 秒。{metrics.resolutionReduced?'已降低渲染分辨率。':''}</p>{diagnostic&&<p>相机：{metrics.camera.join(', ')}；观察目标：{metrics.target.join(', ')}</p>}<p>本地记录不能替代正式设备、网络与内存验收。</p></details>}
   {state==='ready'&&<p className={styles.performanceInfo}>{metrics?.suggestFallback?'设备持续较慢，可选择轻量精度或退出。':''}<button onClick={()=>{stop();setSelected(null);setFullscreen(false);setState('idle');}}>退出三维浏览</button></p>}
   <p className={styles.performanceInfo}>{walk?'电脑：WASD 移动、鼠标拖动观察、方向键转向；手机：左侧摇杆移动、右侧滑动观察。':'电脑：拖动旋转、右键平移、滚轮缩放；手机：单指旋转、双指缩放和平移。'} {scene.mobileUrl?`手机资源：${mobileLabel}。`:'手机未配置轻量资源时使用图文浏览。'}</p>
  </section>
  <section data-motion-section id="places" className={styles.placesSection}><div className={styles.placesIntro}><SectionTitle english="STORIES"/><div data-motion-copy><p className={styles.kicker}>{walk?'展区与展品':'相关图文'}</p><h2>{walk?'在展厅里，发现故事':'每一处风景，都有故事'}</h2><p>介绍和照片独立于模型维护，未确认内容明确标示为占位资料。</p></div></div><div className={styles.placeList}>{[...definition.content].sort((a,b)=>a.order-b.order).map(c=><article data-motion-card className={styles.placeCard} key={c.id}><button data-image-reveal className={styles.cardImage} onClick={()=>selectPlace(c.id)} aria-label={`查看${c.name}介绍`}><div className={styles.parallaxLayer} data-parallax><img src={c.image} alt={c.imageAlt}/></div><span>{String(c.order).padStart(2,'0')}</span></button><div className={styles.cardCopy}><p>{c.category}</p><h3>{c.name}</h3><span>{c.description}</span><button onClick={()=>selectPlace(c.id)}>{bindings.locations.some(l=>l.placeId===c.id)?'在三维中定位':'查看介绍'} →</button></div></article>)}</div></section>
 </>;
}
