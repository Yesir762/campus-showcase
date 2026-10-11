import {createWalkController} from './walk-controller';
import type {Navigation} from './walk-geometry';
export type ViewerProgress = { phase: 'download' | 'parse' | 'ready'; percent?: number };
export type ViewerMetrics = { loadSeconds: number; medianFps: number; elapsedSeconds: number; resolutionReduced: boolean; suggestFallback: boolean; camera: Vec3; target: Vec3 };
type Vec3 = [number, number, number];
export type ViewerScene = {
  url: string;
  transform: { position: Vec3; rotation: Vec3; scale: Vec3 };
  initial: { camera: Vec3; target: Vec3 };
  minDistance: number;
  maxDistance: number;
  fov: number;
  panMin: Vec3;
  panMax: Vec3;
  streamed: boolean;
  splatBudget: number;
  maxPixelRatio?: number;
  mode?: "orbit" | "walk";
  navigation?: Navigation;
  markers?: {placeId:string;position:Vec3}[];
  onMarkers?: (markers:{placeId:string;x:number;y:number;visible:boolean}[])=>void;
  onMetrics?: (metrics: ViewerMetrics) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
};
export type SplatViewer = {
  goToView(camera: Vec3, target: Vec3): void;
  setQuality(scale: number): void;
  stopMotion(): void;
  setMove(x:number,z:number): void;
  setPaused(paused:boolean): void;
  destroy(): void;
};

export async function createSplatViewer(canvas: HTMLCanvasElement, scene: ViewerScene, onProgress: (progress: ViewerProgress) => void): Promise<SplatViewer> {
  if(scene.mode==='walk'&&!scene.navigation?.calibrated) throw Error('室内区域未校准');
  const startedAt = performance.now();
  const pc = await import('playcanvas');
  if (scene.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false, deviceTypes: ['webgl2'] } });
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, scene.maxPixelRatio ?? 1.5);
  app.scene.gsplat.splatBudget = scene.splatBudget;
  app.scene.gsplat.lodMode = pc.GSPLAT_LODMODE_DISTANCE;
  const camera = new pc.Entity('Campus camera');
  camera.addComponent('camera', { clearColor: new pc.Color(0.91, 0.945, 0.975), nearClip: 0.05, farClip: 1000, fov: scene.fov });
  app.root.addChild(camera);
  const target = new pc.Vec3(...scene.initial.target);
  const desired = new pc.Vec3(...scene.initial.camera);
  camera.setPosition(desired);
  camera.lookAt(target);
  let yaw = 0, pitch = 0, distance = 1;
  const syncOrbit = () => {
    const offset = desired.clone().sub(target);
    distance = offset.length();
    yaw = Math.atan2(offset.x, offset.z);
    pitch = Math.asin(offset.y / Math.max(distance, 0.0001));
  };
  syncOrbit();
  const applyOrbit = () => desired.set(target.x + distance * Math.sin(yaw) * Math.cos(pitch), target.y + distance * Math.sin(pitch), target.z + distance * Math.cos(yaw) * Math.cos(pitch));
  const zoom = (factor: number) => { distance = Math.max(scene.minDistance, Math.min(scene.maxDistance, distance * factor)); applyOrbit(); };
  const pan = (dx: number, dy: number) => {
    const offset = camera.right.clone().mulScalar(-dx * distance * 0.0015).add(camera.up.clone().mulScalar(dy * distance * 0.0015));
    target.add(offset);
    target.x = Math.max(scene.panMin[0], Math.min(scene.panMax[0], target.x));
    target.y = Math.max(scene.panMin[1], Math.min(scene.panMax[1], target.y));
    target.z = Math.max(scene.panMin[2], Math.min(scene.panMax[2], target.z));
    applyOrbit();
  };
  const walk=scene.mode==='walk'&&scene.navigation?createWalkController(canvas,scene.navigation,scene.initial):null;
  const pointers = new Map<number, { x: number; y: number }>();
  const pointerDown = (e: PointerEvent) => { canvas.focus(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); syncOrbit(); };
  const pointerMove = (e: PointerEvent) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const next = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (after > 0) zoom(before / after);
      pan((next.x - previous.x) / 2, (next.y - previous.y) / 2);
    } else if (e.buttons === 2 || e.shiftKey) pan(next.x - previous.x, next.y - previous.y);
    else {
      yaw -= (next.x - previous.x) * 0.004;
      pitch = Math.max(0.03, Math.min(1.48, pitch + (next.y - previous.y) * 0.004));
      applyOrbit();
    }
    pointers.set(e.pointerId, next);
  };
  const pointerUp = (e: PointerEvent) => { pointers.delete(e.pointerId); };
  const wheel = (e: WheelEvent) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.001)); };
  const contextMenu = (e: Event) => e.preventDefault();
  const keyDown = (e: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft') yaw += 0.1;
    if (e.key === 'ArrowRight') yaw -= 0.1;
    if (e.key === 'ArrowUp') pitch = Math.min(1.48, pitch + 0.08);
    if (e.key === 'ArrowDown') pitch = Math.max(0.03, pitch - 0.08);
    if (e.key === '+' || e.key === '=') zoom(0.9);
    if (e.key === '-') zoom(1.1);
    applyOrbit();
  };
  const resize = () => {
    const rect = canvas.parentElement!.getBoundingClientRect();
    app.resizeCanvas(rect.width, rect.height);
    canvas.style.width = '100%'; canvas.style.height = '100%';
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);
  resize();
  if(!walk){
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', contextMenu);
  canvas.addEventListener('keydown', keyDown);
  }
  let destroyed = false;
  let readyAt = 0, lowSeconds = 0, resolutionReduced = false, suggestFallback = false, lastMetricsAt = 0;
  const frameRates: { at: number; fps: number }[] = [];
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    observer.disconnect();
    walk?.destroy();
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerUp);
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('contextmenu', contextMenu);
    canvas.removeEventListener('keydown', keyDown);
    scene.signal?.removeEventListener('abort', destroy);
    app.assets.off('error', streamError);
    app.destroy();
  };
  scene.signal?.addEventListener('abort', destroy, { once: true });
  const streamError = (error: string, asset: { file?: { url: string } }) => {
    if (scene.streamed && readyAt && asset?.file?.url.includes(scene.url.slice(0, scene.url.lastIndexOf('/')))) scene.onError?.(`分块资源加载失败：${error}`);
  };
  app.assets.on('error', streamError);
  app.on('update', (dt: number) => {
    const position = camera.getPosition().clone();
    if(walk){const state=walk.update(readyAt?dt:0);position.set(...state.camera);target.set(...state.target);}
    else position.lerp(position, desired, 1 - Math.pow(0.002, dt));
    camera.setPosition(position); camera.lookAt(target);
    if(scene.markers?.length && scene.onMarkers){
      const width=canvas.clientWidth,height=canvas.clientHeight;
      scene.onMarkers(scene.markers.map(m=>{const world=new pc.Vec3(...m.position),screen=camera.camera!.worldToScreen(world);return {placeId:m.placeId,x:screen.x,y:screen.y,visible:world.clone().sub(position).dot(camera.forward)>0&&screen.x>=0&&screen.y>=0&&screen.x<=width&&screen.y<=height};}));
    }
    if (!readyAt || document.hidden || dt <= 0) { lowSeconds = 0; return; }
    const now = performance.now();
    frameRates.push({ at: now, fps: 1 / dt });
    while (frameRates.length && frameRates[0].at < now - 60000) frameRates.shift();
    lowSeconds = dt > 0.05 ? lowSeconds + dt : 0;
    if (lowSeconds >= 10) {
      lowSeconds = 0;
      if (!resolutionReduced) { resolutionReduced = true; app.graphicsDevice.maxPixelRatio = 0.75; resize(); }
      else suggestFallback = true;
    }
    if (now - lastMetricsAt > 1000) {
      lastMetricsAt = now;
      const sorted = frameRates.map(f => f.fps).sort((a, b) => a - b);
      scene.onMetrics?.({ loadSeconds: (readyAt - startedAt) / 1000, medianFps: sorted[Math.floor(sorted.length / 2)], elapsedSeconds: (now - readyAt) / 1000, resolutionReduced, suggestFallback, camera: [position.x, position.y, position.z], target: [target.x, target.y, target.z] });
    }
  });
  app.start();
  try {
    const asset = new pc.Asset('Yujiatou campus', 'gsplat', { url: scene.url });
    asset.on('progress', (received: number, total: number) => {
      const complete = total > 0 && received >= total;
      onProgress({ phase: complete ? 'parse' : 'download', percent: !complete && total > 0 ? Math.min(100, Math.round(received / total * 100)) : undefined });
    });
    app.assets.add(asset);
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timeout); scene.signal?.removeEventListener('abort', abort); asset.off('load', loaded); asset.off('error', failed); };
      const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      const loaded = () => { cleanup(); resolve(); };
      const failed = (error: unknown) => { cleanup(); reject(new Error(String(error))); };
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('模型下载超时，请检查网络后重试')); }, 120000);
      scene.signal?.addEventListener('abort', abort, { once: true });
      asset.once('load', loaded); asset.once('error', failed);
      app.assets.load(asset);
    });
    if (destroyed) throw new DOMException('Cancelled', 'AbortError');
    onProgress({ phase: 'parse' });
    const splat = new pc.Entity('Yujiatou campus splat');
    splat.setPosition(...scene.transform.position);
    splat.setEulerAngles(...scene.transform.rotation);
    splat.setLocalScale(...scene.transform.scale);
    splat.addComponent('gsplat', { asset, unified: true, ...(scene.streamed ? { lodRangeMin: 2, lodRangeMax: 2 } : {}) });
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        scene.signal?.removeEventListener('abort', abort);
        app.scene.off('gsplat:sorted', sorted);
        app.off('postrender', rendered);
      };
      const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      const rendered = () => {
        if (scene.streamed && app.stats.frame.gsplats <= 0) { app.once('postrender', rendered); return; }
        cleanup(); resolve();
      };
      const sorted = () => app.once('postrender', rendered);
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('模型场景准备超时，请重试')); }, 60000);
      scene.signal?.addEventListener('abort', abort, { once: true });
      app.scene.once('gsplat:sorted', sorted);
      app.root.addChild(splat);
    });
    if (destroyed) throw new DOMException('Cancelled', 'AbortError');
    readyAt = performance.now();
    // Make the overview interactive using the light tier, then refine nearby regions.
    if (scene.streamed && splat.gsplat) { splat.gsplat.lodRangeMin = 0; splat.gsplat.lodRangeMax = 2; }
    onProgress({ phase: 'ready', percent: 100 });
    return {
      goToView(position, nextTarget) { if(walk) walk.goToView(position,nextTarget); else {desired.set(...position); target.set(...nextTarget); syncOrbit();} },
      stopMotion(){walk?.stop();pointers.clear();},
      setMove(x,z){walk?.setMove(x,z);},
      setPaused(value){walk?.setPaused(value);},
      setQuality(scale) { app.graphicsDevice.maxPixelRatio = Math.max(0.5, Math.min(1.5, scale)); resize(); },
      destroy,
    };
  } catch (error) { destroy(); throw error; }
}
