'use client';
import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import type {ResolvedScene} from '@/lib/campus-config';
import CircularCarousel from './react-bits/CircularCarousel';
import TiltedCard from './react-bits/TiltedCard';
import {Reveal} from './campus-motion';
import styles from '@/app/page.module.css';
const shortTitle=(scene:ResolvedScene)=>scene.definition.title.replace('武汉理工大学（余家头校区）','');
const status=(scene:ResolvedScene)=>scene.version?'测试模型可浏览':scene.definition.availability==='pending'?'模型准备中':'三维暂不可用';
export function SceneCards({scenes,showcase=false}:{scenes:ResolvedScene[];showcase?:boolean}) {
 const [active,setActive]=useState(0);
 const [selection,setSelection]=useState<{index:number;nonce:number}>();
 const items=useMemo(()=>scenes.map(scene=>({src:scene.definition.poster,alt:scene.definition.posterAlt,title:shortTitle(scene),subtitle:scene.definition.kind==='indoor'?'室内体验':'室外风光'})),[scenes]);
 if(!showcase) return <div className={styles.sceneGrid}>{scenes.map((scene,index)=>{
 const d=scene.definition;
 return <Reveal key={d.id} delay={index*.14}><a href={`/scenes/${d.id}`} className={styles.sceneCard}>
  <div data-image-reveal className={styles.sceneCover}><TiltedCard imageSrc={d.poster} altText={d.posterAlt} containerHeight="220px" imageHeight="220px" imageWidth="100%" rotateAmplitude={5} scaleOnHover={1.025} showMobileWarning={false} showTooltip={false}/><span>{d.kind==='indoor'?'室内':'室外'}</span><small>占位封面 · 正式照片待提供</small></div>
  <div className={styles.sceneCardBody}><p className={styles.kicker}>{status(scene)}</p><h3>{shortTitle(scene)}</h3><p>{d.summary}</p><span>{scene.version?'进入三维展示':'查看板块介绍'} →</span></div>
 </a></Reveal>})}</div>;
 if(!scenes.length)return null;
 const scene=scenes[active] ?? scenes[0], d=scene.definition;
 const select=(index:number)=>setSelection(previous=>({index:(index+scenes.length)%scenes.length,nonce:(previous?.nonce ?? 0)+1}));
 return <div className={styles.sceneShowcase} role="region" aria-label="三大场景切换">
  <div className={styles.sceneReel}>
   <CircularCarousel items={items} preset="cylinder" intro="rise" cardWidth={460} aspectRatio={1.45} gap={48} curve={0.8} tilt={-8} perspective={2200} autoplay="off" speed={8} momentum={0.35} parallax={0.12} stretch={0.12} depthFade={0.38} fadeColor="#edf6ff" innerShade={0.75} cornerRadius={18} captions selection={selection} onChange={setActive} ariaLabel="选择校园模型，可拖动或使用左右方向键切换" />

  </div>
  <p className={styles.reelHint}>拖动卡片探索 · 点击封面聚焦</p>
  <div className={styles.reelControls}><button aria-label="上一个场景" onClick={()=>select(active-1)}><ArrowLeft size={18}/></button><div className={styles.reelTabs}>{scenes.map((item,index)=><button key={item.definition.id} aria-pressed={index===active} className={index===active?styles.reelTabActive:''} onClick={()=>select(index)}>{shortTitle(item)}</button>)}</div><button aria-label="下一个场景" onClick={()=>select(active+1)}><ArrowRight size={18}/></button></div>
  <div className={styles.reelCopy} aria-live="polite"><p className={styles.kicker}>{d.kind==='indoor'?'室内体验':'室外风光'} · {status(scene)}</p><h3>{shortTitle(scene)}</h3><p>{d.summary}</p><a className={`${styles.primaryButton} ${styles.linkButton}`} href={`/scenes/${d.id}`}>{scene.version?'进入三维展示':'查看板块介绍'} <ArrowRight size={17}/></a><small>占位封面 · 正式照片待提供</small></div>
 </div>;
}
