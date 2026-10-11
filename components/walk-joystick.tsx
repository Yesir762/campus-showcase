'use client';
import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import styles from '@/app/page.module.css';
export function WalkJoystick({onMove}:{onMove:(x:number,z:number)=>void}) {
 const pointer=useRef<number|null>(null);const [offset,setOffset]=useState({x:0,y:0});const moveHandler=useRef(onMove);moveHandler.current=onMove;
 const stop=()=>{pointer.current=null;setOffset({x:0,y:0});moveHandler.current(0,0);};
 useEffect(()=>{const hidden=()=>{if(document.hidden)stop();};window.addEventListener('blur',stop);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',hidden);moveHandler.current(0,0);};},[]);
 const move=(e:PointerEvent<HTMLDivElement>)=>{if(pointer.current!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/40,y=(e.clientY-r.top-r.height/2)/40;const size=Math.max(1,Math.hypot(x,y));x/=size;y/=size;setOffset({x:x*28,y:y*28});moveHandler.current(x,y);};
 return <div className={styles.joystick} role="group" aria-label="移动摇杆" onPointerDown={e=>{if(pointer.current!==null)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={move} onPointerUp={e=>{if(e.pointerId===pointer.current)stop();}} onPointerCancel={e=>{if(e.pointerId===pointer.current)stop();}} onLostPointerCapture={e=>{if(e.pointerId===pointer.current)stop();}}><span style={{transform:`translate(${offset.x}px,${offset.y}px)`}}/><small>移动</small></div>;
}
