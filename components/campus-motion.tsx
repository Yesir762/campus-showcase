'use client';
import {createContext,useContext,useLayoutEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {useGSAP} from '@gsap/react';
import styles from '@/app/page.module.css';
gsap.registerPlugin(ScrollTrigger,useGSAP);
export const MotionReadyContext=createContext(true);
export const MotionPlayingContext=createContext(true);
export function CampusTitle({text}:{text:string}) {
 return <h1 className={styles.motionTitle}>{text.split('\n').map(line=><span className={styles.lineMask} key={line}><span data-hero-line>{line}</span></span>)}</h1>;
}
export function SectionTitle({english}:{english:string}) {
 return <div className={styles.englishTitle} aria-hidden="true">{english.split('\n').map(line=><div className={styles.lineMask} key={line}><span data-motion-title>{line}</span></div>)}</div>;
}
export function Reveal({children,delay=0}:{children:ReactNode;delay?:number}) {
 return <div data-motion-card data-motion-delay={delay}>{children}</div>;
}
export function CreativeMotion({children}:{children:ReactNode}) {
 const scope=useRef<HTMLDivElement>(null),ready=useContext(MotionReadyContext),playing=useContext(MotionPlayingContext);
 const heroTimeline=useRef<gsap.core.Timeline|null>(null),playingRef=useRef(playing);
 // Media-query rebuilds must use the current playback state, not the click-time closure.
 useLayoutEffect(()=>{playingRef.current=playing;},[playing]);
 useGSAP(()=>{
  const root=scope.current;if(!root||!ready)return;
  const media=gsap.matchMedia();
  const images=Array.from(root.querySelectorAll('img'));
  let alive=true,refreshFrame=0;
  let lastSize='';
  const resizeObserver=new ResizeObserver(([entry])=>{const size=`${entry.contentRect.width}:${entry.contentRect.height}`;if(size!==lastSize){lastSize=size;cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(()=>{if(alive)ScrollTrigger.refresh();});}});resizeObserver.observe(root);
  const refresh=()=>{if(alive)ScrollTrigger.refresh();};
  images.forEach(image=>image.addEventListener('load',refresh));document.fonts?.ready.then(refresh);
  try {media.add({all:'all',reduce:'(prefers-reduced-motion: reduce)',small:'(max-width:700px), (pointer:coarse)'},context=>{
   const {reduce,small}=context.conditions!;if(reduce)return;
   const factor=small?.8:1;
   const timelines:{section:HTMLElement;tl:gsap.core.Timeline}[]=[];
   const hero=root.querySelector<HTMLElement>('[data-hero]');
   if(hero&&!location.hash){
    // Prepare once beneath the opaque entrance; keep the whole intro paused until
    // the pixel overlay is removed, then continue this same timeline from its start.
    const tl=gsap.timeline({paused:!playingRef.current,defaults:{ease:'power4.out',duration:1.2*factor}});
    heroTimeline.current=tl;
    tl.fromTo(hero.querySelector('[data-hero-image]'),{clipPath:'inset(100% 0 0 0)',scale:1.1},{clipPath:'inset(0% 0 0 0)',scale:1,duration:1.8*factor,clearProps:'clipPath,transform'},0)
     .fromTo(hero.querySelectorAll('[data-hero-line]'),{yPercent:110,scaleY:.82},{yPercent:0,scaleY:1,stagger:.16,clearProps:'transform'},.18)
     .fromTo(root.querySelector('[data-motion-header]'),{y:-28,opacity:0},{y:0,opacity:1,clearProps:'transform,opacity'},.3)
     .fromTo(hero.querySelectorAll('[data-hero-copy]'),{y:40,opacity:0},{y:0,opacity:1,stagger:.14,clearProps:'transform,opacity'},.55);
    timelines.push({section:hero,tl});
    ScrollTrigger.create({trigger:hero,start:'bottom top',onEnter:()=>tl.progress(1)});
   }
   root.querySelectorAll<HTMLElement>('[data-motion-section]').forEach(section=>{
    const title=section.querySelectorAll('[data-motion-title]'),copy=section.querySelectorAll('[data-motion-copy]'),cards=section.querySelectorAll('[data-motion-card]');
    const tl=gsap.timeline({paused:true,defaults:{ease:'power4.out'},onComplete:()=>gsap.set([...title,...copy,...cards],{clearProps:'transform,opacity,willChange'})});
    tl.fromTo(title,{yPercent:110,scaleY:.8},{yPercent:0,scaleY:1,duration:1.4*factor},0)
     .fromTo(copy,{y:small?20:40,opacity:0},{y:0,opacity:1,duration:factor,stagger:.08},.25)
     .fromTo(cards,{y:small?40:80,rotation:small?0:2,opacity:0},{y:0,rotation:0,opacity:1,duration:1.1*factor,stagger:.14},.45);
    const reveals=section.querySelectorAll<HTMLElement>('[data-image-reveal]');
    reveals.forEach(wrapper=>{
     tl.fromTo(wrapper,{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0% 0 0 0)',duration:1.3*factor,ease:'expo.out',clearProps:'clipPath'},.45);
     const image=wrapper.querySelector('img');if(image)tl.fromTo(image,{scale:1.08},{scale:1,duration:1.3*factor,clearProps:'transform'},.45);
    });
    timelines.push({section,tl});
    if(section.getBoundingClientRect().bottom<0)tl.progress(1);
    ScrollTrigger.create({trigger:section,start:'top 80%',once:true,onEnter:()=>tl.play(),onLeave:()=>tl.progress(1)});
   });
   const parallax:ScrollTrigger[]=[];
   if(!small)root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(image=>{
    const tween=gsap.fromTo(image,{y:-24},{y:24,ease:'none',scrollTrigger:{trigger:image.parentElement,start:'top bottom',end:'bottom top',scrub:.8}});
    if(tween.scrollTrigger)parallax.push(tween.scrollTrigger);
   });
   // Complete hidden regions before keyboard interaction; never animate the viewer itself.
   const focus=(event:FocusEvent)=>{if((event.target as HTMLElement)?.tabIndex===-1)return;for(const item of timelines)if(item.section.contains(event.target as Node))item.tl.progress(1);};
   const suspend=()=>{const busy=root.querySelector('[data-model-active="true"]');parallax.forEach(trigger=>{if(busy)trigger.disable(false);else trigger.enable(false);});};
   const observer=new MutationObserver(suspend);observer.observe(root,{subtree:true,attributes:true,attributeFilter:['data-model-active']});suspend();
   root.addEventListener('focusin',focus);
   const hidden=()=>{if(document.hidden)timelines.forEach(({tl})=>tl.progress(1));};document.addEventListener('visibilitychange',hidden);
   return()=>{observer.disconnect();root.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',hidden);};
  });}catch{media.revert();gsap.set(root.querySelectorAll('[data-motion-title],[data-motion-copy],[data-motion-card],[data-image-reveal],[data-hero-line],[data-hero-image],[data-hero-copy],[data-motion-header]'),{clearProps:'transform,opacity,clipPath,visibility'});}
  return()=>{heroTimeline.current=null;alive=false;resizeObserver.disconnect();cancelAnimationFrame(refreshFrame);images.forEach(image=>image.removeEventListener('load',refresh));media.revert();};
 },{scope,dependencies:[ready],revertOnUpdate:true});
 useLayoutEffect(()=>{if(playing)heroTimeline.current?.play();},[playing,ready]);
 return <div ref={scope}>{children}</div>;
}
