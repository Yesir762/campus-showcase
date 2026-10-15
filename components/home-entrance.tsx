'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode,ComponentType} from 'react';
import type {TechTextProps} from './react-bits/TechText';
import styles from './home-entrance.module.css';
import {BrandIcon} from './brand-icon';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {MotionReadyContext,MotionPlayingContext} from './campus-motion';
import {pixelGrid,pixelClipPath} from '@/lib/pixel-dissolve';
const sessionKey='yunman-wuli:entered:v1';
let enteredInMemory=false;
export function HomeEntrance({children}:{children:ReactNode}) {
 const [show,setShow]=useState(true),[leaving,setLeaving]=useState(false),[ready,setReady]=useState(false),[transitioning,setTransitioning]=useState(false);
 const [reduced,setReduced]=useState(true),[mobile,setMobile]=useState(false);
 const [openingDone,setOpeningDone]=useState(false);
 const [wordSize,setWordSize]=useState<number|undefined>();
 const opening=useRef<gsap.core.Timeline|null>(null);
 const [Visual,setVisual]=useState<ComponentType<TechTextProps>|null>(null);
 const finished=useRef(false);
 const cancelTransition=useRef<()=>void>(()=>{});
 const gate=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),entering=useRef(false);
 useLayoutEffect(()=>{
  let entered=enteredInMemory;
  try {entered ||= sessionStorage.getItem(sessionKey)==='1';} catch {}
  // Read session storage before paint so returning visitors never see the entrance flash.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  if(entered)setShow(false);
 },[]);
 useEffect(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),touch=matchMedia('(pointer: coarse)');
  const update=()=>{setReduced(reduce.matches);setMobile(touch.matches);};update();
  reduce.addEventListener('change',update);touch.addEventListener('change',update);
  return()=>{reduce.removeEventListener('change',update);touch.removeEventListener('change',update);};
 },[]);
 useEffect(()=>{
  if(!show||reduced)return;
  let alive=true;
  import('./react-bits/TechText').then(module=>{if(alive)setVisual(()=>module.default);}).catch(()=>{});
  return()=>{alive=false;};
 },[show,reduced]);
 useLayoutEffect(()=>{
  if(!show)return;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  gate.current?.focus({preventScroll:true});
  return()=>{document.body.style.overflow=overflow;};
 },[show]);
 useGSAP(()=>{
  if(!show)return;
  const el=gate.current;if(!el)return;
  if(reduced){setOpeningDone(true);return;}
  setOpeningDone(false);
  try {
   const tl=gsap.timeline({defaults:{ease:'power4.out'},onComplete:()=>{setOpeningDone(true);gsap.set(el.querySelectorAll('[data-opening]'),{clearProps:'transform,opacity,clipPath'});}});
   opening.current=tl;
   tl.fromTo(el.querySelector('[data-opening-grid]'),{scale:1.08,opacity:0},{scale:1,opacity:1,duration:1.7},0)
    .fromTo(el.querySelector('[data-opening-contours]'),{x:90,opacity:0},{x:0,opacity:.17,duration:1.9},.1)
    .fromTo(el.querySelector('[data-opening-school]'),{y:24,opacity:0},{y:0,opacity:1,duration:1},.2)
    .fromTo(el.querySelectorAll('[data-opening-glyph]'),{yPercent:110,scaleY:.72},{yPercent:0,scaleY:1,duration:1.4,stagger:.1,ease:'expo.out'},.35)
    .fromTo(el.querySelectorAll('[data-opening-copy]'),{y:24,opacity:0},{y:0,opacity:1,duration:.9,stagger:.12},1.05);
   return()=>{tl.kill();opening.current=null;};
  }catch{setOpeningDone(true);gsap.set(el.querySelectorAll('[data-opening]'),{clearProps:'all'});}
 },{scope:gate,dependencies:[show,reduced],revertOnUpdate:true});
 useEffect(()=>()=>{clearTimeout(timer.current);cancelTransition.current();},[]);
 const finish=useCallback(()=>{
  if(finished.current)return;
  finished.current=true;
  // Hide before removing the clip so cleanup cannot restore the entrance for a frame.
  if(gate.current)gate.current.style.visibility='hidden';
  cancelTransition.current();
  clearTimeout(timer.current);
  setShow(false);
  // Defer focus/anchor positioning until the overlay and inert flag are gone.
  timer.current=setTimeout(()=>{
   let anchor:HTMLElement|null=null;
   try {anchor=location.hash?document.getElementById(decodeURIComponent(location.hash.slice(1))):null;} catch {}
   const target=anchor??content.current?.querySelector<HTMLElement>('h1');
   if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});if(anchor)target.scrollIntoView({behavior:'instant'});}
  },0);
 },[]);
 const enter=useCallback((point?:{x:number;y:number})=>{
  if(entering.current)return;
  // Freeze the current opening frame. Reverting or completing it here causes a visible jump.
  entering.current=true;opening.current?.pause();enteredInMemory=true;
  try {sessionStorage.setItem(sessionKey,'1');} catch {}
  if(reduced){finish();return;}
  setTransitioning(true);
  const element=gate.current;
  let applied=false,raf=0,lastFrame=-Infinity;
  const fallback=()=>{
   if(applied){finish();return;}
   clearTimeout(timer.current);cancelTransition.current();
   setLeaving(true);timer.current=setTimeout(finish,350);
  };
  const probe='path("M0 0H1V1H0Z")';
  if(!element||!CSS.supports('clip-path',probe)&&!CSS.supports('-webkit-clip-path',probe)){fallback();return;}
  const initial=element.getBoundingClientRect(),width=initial.width,height=initial.height;
  if(width<=0||height<=0){fallback();return;}
  const origin={x:point?Math.min(width,Math.max(0,point.x-initial.left)):width/2,y:point?Math.min(height,Math.max(0,point.y-initial.top)):height/2};
  const small=mobile||matchMedia('(max-width:600px)').matches,duration=small?700:900;
  const onHidden=()=>{if(document.hidden)finish();};
  const onReduce=(event:MediaQueryListEvent)=>{if(event.matches)finish();};
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const onResize=()=>finish();
  cancelTransition.current=()=>{
   cancelAnimationFrame(raf);
   document.removeEventListener('visibilitychange',onHidden);media.removeEventListener('change',onReduce);
   window.removeEventListener('resize',onResize);window.visualViewport?.removeEventListener('resize',onResize);
   element.style.clipPath='';element.style.removeProperty('-webkit-clip-path');
   cancelTransition.current=()=>{};
  };
  try{
   const cells=pixelGrid(width,height,origin,small);
   const draw=(progress:number)=>{
    const clip=pixelClipPath(cells,progress);
    element.style.clipPath=clip;element.style.setProperty('-webkit-clip-path',clip);
   };
   draw(0);applied=true;
   document.addEventListener('visibilitychange',onHidden);media.addEventListener('change',onReduce);
   window.addEventListener('resize',onResize);window.visualViewport?.addEventListener('resize',onResize);
   const start=performance.now();
   const tick=(now:number)=>{
    if(finished.current)return;
    if(now-start>=duration){finish();return;}
    try{
     const bounds=element.getBoundingClientRect();
     if(bounds.width!==width||bounds.height!==height){finish();return;}
     if(now-lastFrame>=1000/30){lastFrame=now;draw((now-start)/duration);}
     raf=requestAnimationFrame(tick);
    }catch{finish();}
   };
   timer.current=setTimeout(finish,duration+150);raf=requestAnimationFrame(tick);
  }catch{fallback();}
 },[reduced,mobile,finish]);

 return <MotionReadyContext.Provider value={!show||transitioning}><MotionPlayingContext.Provider value={!show}>
  <div ref={content} inert={show} aria-hidden={show||undefined}>{children}</div>
  {show&&<div ref={gate} className={`${styles.entrance} ${leaving?styles.leaving:''} ${transitioning?styles.transitioning:''}`} role="dialog" aria-modal="true" aria-labelledby="entrance-title" tabIndex={-1} onClick={e=>enter(e.detail?{x:e.clientX,y:e.clientY}:undefined)} onKeyDown={e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();enter();}
   if(e.key==='Tab'){e.preventDefault();gate.current?.querySelector<HTMLButtonElement>('button')?.focus();}
  }}>
   <div data-opening data-opening-grid className={styles.grid} aria-hidden="true"/>
   <svg data-opening data-opening-contours className={styles.contours} viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1">{Array.from({length:10},(_,i)=><ellipse key={i} cx="1150" cy="740" rx={220+i*65} ry={110+i*45} transform="rotate(-22 1150 740)"/>)}</g></svg>
   <div data-opening data-opening-school className={styles.school}><span className={styles.schoolMark} aria-hidden="true"><BrandIcon/></span><span>武汉理工大学<small>余家头校区 · 数字校园</small></span></div>
   <div className={styles.center}><p data-opening data-opening-copy className={styles.eyebrow}>CAMPUS IN THE CLOUD</p><div className={styles.wordmark}>
    <h1 id="entrance-title" className={!reduced&&ready&&Visual&&openingDone?styles.hiddenTitle:styles.staticTitle} style={wordSize?{fontSize:wordSize}:undefined}>{Array.from('云漫武理').map(char=><span className={styles.glyphClip} key={char}><span data-opening data-opening-glyph>{char}</span></span>)}</h1>
    {!reduced&&Visual&&<div className={styles.canvasLayer} aria-hidden="true" style={{opacity:ready&&openingDone?1:0}}><Visual text="云漫武理" paused={transitioning||!openingDone} fontFamily='"PingFang SC", "Microsoft YaHei", sans-serif' fontWeight={600} fontSize={180} letterSpacing={.06} color="#005bac" accentColor="#1677d2" reveal="letter" dashLength={4} dashGap={2} strokeWidth={1.5} specks={mobile?4:8} selection labels={false} draggable={false} sweep speed={.7} onReady={layout=>{if(!entering.current){setWordSize(layout.fontSize);setReady(true);}}}/></div>}
   </div><p data-opening data-opening-copy className={styles.tagline}>让校园风景，触手可及</p><div className={styles.divider}/><button type="button" data-opening data-opening-copy className={styles.enter}><span className={styles.enterDot} aria-hidden="true"/>点击任意位置，开启校园之旅<span aria-hidden="true">↗</span></button></div>
   <div data-opening data-opening-copy className={styles.footer}><span>主校区 · 航海楼 · 航海博物馆</span><span>云漫武理 / 校园风光测试预览</span></div>
  </div>}
 </MotionPlayingContext.Provider></MotionReadyContext.Provider>;
}
