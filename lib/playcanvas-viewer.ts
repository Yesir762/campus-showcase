export type ViewerProgress = {
  phase: "download" | "parse" | "ready";
  percent?: number;
};

export type ViewerScene = {
  url: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  initial: { camera: [number, number, number]; target: [number, number, number] };
};

export type SplatViewer = {
  goToView(camera: [number, number, number], target: [number, number, number]): void;
  setQuality(scale: number): void;
  destroy(): void;
};

export async function createSplatViewer(
  canvas: HTMLCanvasElement,
  scene: ViewerScene,
  onProgress: (progress: ViewerProgress) => void,
): Promise<SplatViewer> {
  const pc = await import("playcanvas");
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false } });
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  const camera = new pc.Entity("Campus camera");
  camera.addComponent("camera", { clearColor: new pc.Color(0.035, 0.08, 0.075) });
  camera.setPosition(...scene.initial.camera);
  camera.lookAt(...scene.initial.target);
  app.root.addChild(camera);

  const target = new pc.Vec3(...scene.initial.target);
  let desiredPosition = new pc.Vec3(...scene.initial.camera);
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let yaw = 0;
  let pitch = 18;
  let distance = desiredPosition.distance(target);

  const applyOrbit = () => {
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    desiredPosition.set(
      target.x + distance * Math.sin(yawRad) * Math.cos(pitchRad),
      target.y + distance * Math.sin(pitchRad),
      target.z + distance * Math.cos(yawRad) * Math.cos(pitchRad),
    );
  };
  const pointerDown = (event: PointerEvent) => {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    yaw -= (event.clientX - previousX) * 0.18;
    pitch = Math.max(-70, Math.min(80, pitch + (event.clientY - previousY) * 0.14));
    previousX = event.clientX;
    previousY = event.clientY;
    applyOrbit();
  };
  const pointerUp = () => { dragging = false; };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    distance = Math.max(1.2, Math.min(18, distance * Math.exp(event.deltaY * 0.001)));
    applyOrbit();
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });

  app.on("update", (dt: number) => {
    const blend = 1 - Math.pow(0.002, dt);
    const position = camera.getPosition();
    position.lerp(position, desiredPosition, blend);
    camera.setPosition(position);
    camera.lookAt(target);
  });

  const asset = new pc.Asset("Campus splat", "gsplat", { url: scene.url });
  asset.on("progress", (received: number, total: number) => {
    onProgress({ phase: "download", percent: total > 0 ? Math.round((received / total) * 100) : undefined });
  });
  app.assets.add(asset);

  await new Promise<void>((resolve, reject) => {
    asset.once("load", () => resolve());
    asset.once("error", (error) => reject(new Error(String(error))));
    app.assets.load(asset);
  });
  onProgress({ phase: "parse" });

  const splat = new pc.Entity("Campus splat");
  splat.setPosition(...scene.transform.position);
  splat.setEulerAngles(...scene.transform.rotation);
  splat.setLocalScale(...scene.transform.scale);
  splat.addComponent("gsplat", { asset });
  app.root.addChild(splat);
  onProgress({ phase: "ready", percent: 100 });

  const resize = () => app.resizeCanvas();
  window.addEventListener("resize", resize);

  return {
    goToView(position, nextTarget) {
      desiredPosition = new pc.Vec3(...position);
      target.set(...nextTarget);
      distance = desiredPosition.distance(target);
    },
    setQuality(scale) {
      app.graphicsDevice.maxPixelRatio = Math.max(0.5, Math.min(1, scale)) * window.devicePixelRatio;
      app.resizeCanvas();
    },
    destroy() {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      app.destroy();
    },
  };
}
