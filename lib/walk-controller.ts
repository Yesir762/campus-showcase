import {isWalkable,moveWithinBounds,movementDelta} from './walk-geometry.ts';
import type {Navigation,Point2} from './walk-geometry.ts';
type Vec3=[number,number,number];
export function createWalkController(canvas:HTMLCanvasElement,nav:Navigation,initial:{camera:Vec3;target:Vec3}) {
 let position:Point2=[initial.camera[0],initial.camera[2]],yaw=0,pitch=0,analog:Point2=[0,0],paused=false;
 const keys=new Set<string>();let pointer:{id:number;x:number;y:number}|null=null;
 const stop=()=>{keys.clear();analog=[0,0];pointer=null;};
 const goToView=(camera:Vec3,target:Vec3)=>{
  if(!isWalkable([camera[0],camera[2]],nav)) throw Error('视点不在可行走区域');
  stop();position=[camera[0],camera[2]];
  yaw=Math.atan2(camera[0]-target[0],camera[2]-target[2]);
  pitch=Math.max(-Math.PI*75/180,Math.min(Math.PI*75/180,Math.atan2(target[1]-camera[1],Math.hypot(target[0]-camera[0],target[2]-camera[2]))));
 };
 goToView(initial.camera,initial.target);
 const keyDown=(e:KeyboardEvent)=>{const key=e.key.toLowerCase();if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown'].includes(key)){e.preventDefault();if(!paused)keys.add(key);}};
 const keyUp=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
 const down=(e:PointerEvent)=>{if(paused||pointer)return;canvas.focus();canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY};};
 const move=(e:PointerEvent)=>{if(!pointer||pointer.id!==e.pointerId||paused)return;yaw-=(e.clientX-pointer.x)*0.004;pitch=Math.max(-Math.PI*75/180,Math.min(Math.PI*75/180,pitch-(e.clientY-pointer.y)*0.004));pointer={id:e.pointerId,x:e.clientX,y:e.clientY};};
 const up=(e:PointerEvent)=>{if(pointer?.id===e.pointerId)pointer=null;};
 const cancel=()=>stop();const visibility=()=>{if(document.hidden)stop();};
 canvas.addEventListener('keydown',keyDown);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('blur',stop);
 window.addEventListener('keyup',keyUp);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',visibility);
 return {
  goToView,stop,setPaused(value:boolean){paused=value;stop();},setMove(x:number,z:number){if(!paused)analog=[x,z];},
  update(dt:number):{camera:Vec3;target:Vec3}{
   if(!paused){const turn=Math.min(dt,0.1)*1.2;yaw+=(Number(keys.has('arrowleft'))-Number(keys.has('arrowright')))*turn;pitch=Math.max(-Math.PI*75/180,Math.min(Math.PI*75/180,pitch+(Number(keys.has('arrowup'))-Number(keys.has('arrowdown')))*turn));
    const input:Point2=[analog[0]+Number(keys.has('d'))-Number(keys.has('a')),analog[1]+Number(keys.has('s'))-Number(keys.has('w'))];position=moveWithinBounds(position,movementDelta(input,yaw,nav.speed,dt),nav);
   }
   const y=nav.floorY+nav.eyeHeight;
   return {camera:[position[0],y,position[1]],target:[position[0]-Math.sin(yaw)*Math.cos(pitch),y+Math.sin(pitch),position[1]-Math.cos(yaw)*Math.cos(pitch)]};
  },
  destroy(){stop();canvas.removeEventListener('keydown',keyDown);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('blur',stop);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility);}
 };
}
