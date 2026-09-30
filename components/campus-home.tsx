"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowDown, Building2, Camera, ChevronRight, Compass, Expand, Focus, GraduationCap, Info, Layers3, LocateFixed, Menu, MousePointer2, RefreshCw, Rotate3D, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Place, SceneBindings, SceneVersion, SiteConfig } from "@/lib/campus-config";
import type { SplatViewer, ViewerProgress } from "@/lib/playcanvas-viewer";
import styles from "@/app/page.module.css";

type Props = { site: SiteConfig; scene: SceneVersion; bindings: SceneBindings };
type LoadState = "idle" | "loading" | "ready" | "error" | "unsupported" | "mobile-fallback";

function useWebGL2Support() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    setSupported(Boolean(canvas.getContext("webgl2")));
  }, []);
  return supported;
}

export function CampusHome({ site, scene, bindings }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadProgress, setLoadProgress] = useState<ViewerProgress>({ phase: "download", percent: 0 });
  const [selectedViewId, setSelectedViewId] = useState(bindings.camera.initialViewId);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isFullscreen, setFullscreen] = useState(false);
  const [demoOffset, setDemoOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const viewerRef = useRef<SplatViewer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const webgl2Supported = useWebGL2Support();

  const selectedPlace = site.places.find((place) => place.id === selectedPlaceId) ?? null;
  const currentView = bindings.views.find((view) => view.id === selectedViewId) ?? bindings.views[0];
  const sortedPlaces = useMemo(() => [...site.places].sort((a, b) => a.order - b.order), [site.places]);

  const handleProgress = useCallback((progress: ViewerProgress) => setLoadProgress(progress), []);

  const startExperience = useCallback(async () => {
    if (!webgl2Supported) {
      setLoadState("unsupported");
      return;
    }
    setLoadState("loading");
    setLoadProgress({ phase: "download", percent: 8 });
    try {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      if (isMobile && scene.format !== "placeholder" && !scene.mobileUrl) {
        setLoadState("mobile-fallback");
        return;
      }
      const modelUrl = isMobile ? scene.mobileUrl : scene.desktopUrl;
      if (!modelUrl || scene.format === "placeholder") {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        setLoadProgress({ phase: "parse", percent: 76 });
        await new Promise((resolve) => window.setTimeout(resolve, 460));
        setLoadProgress({ phase: "ready", percent: 100 });
        setLoadState("ready");
        return;
      }
      if (!canvasRef.current) throw new Error("画布尚未准备完成");
      const { createSplatViewer } = await import("@/lib/playcanvas-viewer");
      viewerRef.current = await createSplatViewer(canvasRef.current, {
        url: modelUrl,
        transform: bindings.transform,
        initial: currentView,
      }, handleProgress);
      setLoadState("ready");
    } catch (error) {
      console.error(error);
      setLoadState("error");
    }
  }, [bindings.transform, currentView, handleProgress, scene.desktopUrl, scene.format, scene.mobileUrl, webgl2Supported]);

  const goToView = useCallback((viewId: string) => {
    const view = bindings.views.find((item) => item.id === viewId);
    if (!view) return;
    setSelectedViewId(viewId);
    setDemoOffset({ x: 0, y: 0 });
    viewerRef.current?.goToView(view.camera, view.target);
  }, [bindings.views]);

  const selectPlace = (place: Place) => {
    setSelectedPlaceId(place.id);
    if (place.coveredByScene && place.viewId) goToView(place.viewId);
    document.querySelector("#campus-3d")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const toggleFullscreen = async () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) await stageRef.current.requestFullscreen();
    else await document.exitFullscreen();
  };

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => () => viewerRef.current?.destroy(), []);

  return (
    <main className={styles.page} style={{ "--brand": site.theme.primary, "--gold": site.theme.accent } as CSSProperties}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label={`${site.schoolName}首页`}>
          <span className={styles.brandMark}><GraduationCap aria-hidden="true" /></span>
          <span><b>{site.schoolName}</b><small>{site.shortName}</small></span>
        </a>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} aria-label="主导航">
          <a href="#about" onClick={() => setMenuOpen(false)}>校园概览</a>
          <a href="#campus-3d" onClick={() => setMenuOpen(false)}>三维校园</a>
          <a href="#places" onClick={() => setMenuOpen(false)}>校园景点</a>
          <span className={styles.previewTag}>测试预览</span>
        </nav>
        <button className={styles.menuButton} onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "关闭菜单" : "打开菜单"} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <section id="top" className={styles.hero}>
        <img src={scene.poster} alt="抽象高斯点云校园测试画面，非真实校园照片" className={styles.heroImage} />
        <div className={styles.heroShade} /><div className={styles.scanGrid} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}><span />{site.eyebrow}</p>
          <h1>{site.heroTitle.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
          <p className={styles.heroText}>{site.heroDescription}</p>
          <div className={styles.heroActions}>
            <Button className={styles.primaryButton} onClick={() => document.querySelector("#campus-3d")?.scrollIntoView({ behavior: "smooth" })}>探索三维校园 <Compass aria-hidden="true" /></Button>
            <a className={styles.textLink} href="#about">了解校园 <ArrowDown aria-hidden="true" /></a>
          </div>
        </div>
        <div className={styles.heroMeta}><div><Layers3 /><span>3D Gaussian Splatting</span></div><div><Camera /><span>测试模型预览</span></div></div>
        <span className={styles.placeholderLabel}>AI 生成占位视觉 · 待替换正式校园照片</span>
      </section>

      <section id="about" className={styles.aboutSection}>
        <div className={styles.sectionNumber}>01</div>
        <div className={styles.aboutLead}><p className={styles.kicker}>校园概览</p><h2>{site.aboutTitle}</h2></div>
        <div className={styles.aboutCopy}><p>{site.aboutDescription}</p><div className={styles.aboutStats}><div><strong>01</strong><span>单校区首版</span></div><div><strong>03</strong><span>测试景点</span></div><div><strong>3D</strong><span>沉浸式浏览</span></div></div></div>
      </section>

      <section id="campus-3d" className={styles.experienceSection}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.kicker}>数字校园实验室</p><h2>在浏览器里，漫游校园光影</h2></div>
          <div className={styles.sceneStatus}><span className={styles.statusDot} /><div><b>{scene.label}</b><small>更新于 {scene.updatedAt}</small></div></div>
        </div>
        <div ref={stageRef} className={`${styles.experience} ${isFullscreen ? styles.fullscreen : ""}`}>
          <div className={styles.viewer}>
            <canvas ref={canvasRef} className={styles.canvas} aria-label="校园三维模型画布" />
            <div className={styles.demoScene} style={{ opacity: scene.format === "placeholder" ? 1 : 0, "--focus-x": `${currentView.preview.x}%`, "--focus-y": `${currentView.preview.y}%`, "--zoom": currentView.preview.scale, "--drag-x": `${demoOffset.x}px`, "--drag-y": `${demoOffset.y}px` } as CSSProperties}
              onPointerDown={(event) => { if (loadState !== "ready") return; event.currentTarget.setPointerCapture(event.pointerId); setDragStart({ x: event.clientX - demoOffset.x, y: event.clientY - demoOffset.y }); }}
              onPointerMove={(event) => { if (dragStart) setDemoOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }); }}
              onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)}>
              <img src={scene.poster} alt="" draggable={false} /><div className={styles.pointCloud} aria-hidden="true" />
            </div>

            {loadState === "ready" && bindings.markers.map((marker, index) => {
              const place = site.places.find((item) => item.id === marker.placeId);
              if (!place?.coveredByScene) return null;
              return <button key={marker.placeId} className={`${styles.marker} ${selectedPlaceId === marker.placeId ? styles.markerActive : ""}`} style={{ left: `${marker.preview.x}%`, top: `${marker.preview.y}%` }} onClick={() => selectPlace(place)} aria-label={`查看${place.name}`}><span>{String(index + 1).padStart(2, "0")}</span><b>{place.name}</b></button>;
            })}

            {loadState === "idle" && <div className={styles.viewerGate}><span className={styles.gateIcon}><Rotate3D /></span><p className={styles.kicker}>交互式三维预览</p><h3>进入测试场景</h3><p>{scene.modelNotice}</p><Button className={styles.primaryButton} onClick={startExperience}>载入测试场景 <MousePointer2 /></Button><small>仅在点击后加载三维资源</small></div>}
            {loadState === "loading" && <div className={styles.viewerGate} aria-live="polite"><span className={`${styles.gateIcon} ${styles.pulse}`}><Layers3 /></span><p className={styles.kicker}>正在准备场景</p><h3>{loadProgress.phase === "download" ? "下载模型资源" : loadProgress.phase === "parse" ? "解析与建立场景" : "即将完成"}</h3><Progress value={loadProgress.percent ?? 58} className={styles.progress} /><small>{loadProgress.percent ? `${loadProgress.percent}%` : "请稍候"}</small></div>}
            {(loadState === "error" || loadState === "unsupported" || loadState === "mobile-fallback") && <div className={styles.viewerGate} role="alert"><span className={styles.gateIcon}><Info /></span><p className={styles.kicker}>图文模式可继续浏览</p><h3>{loadState === "unsupported" ? "当前浏览器不支持 WebGL2" : loadState === "mobile-fallback" ? "手机轻量模型尚未配置" : "三维场景加载失败"}</h3><p>你仍然可以查看下方校园景点，也可以稍后重试。</p>{loadState === "error" && <Button className={styles.primaryButton} onClick={startExperience}><RefreshCw />重新载入</Button>}<a href="#places" className={styles.fallbackLink}>浏览校园景点</a></div>}
            {loadState === "ready" && <><div className={styles.viewerHint}><MousePointer2 />拖动观察 · 选择视角</div><div className={styles.viewerTools}><button onClick={() => goToView(bindings.camera.initialViewId)} aria-label="回到初始视角" title="回到初始视角"><Focus /></button>{typeof document !== "undefined" && document.fullscreenEnabled && <button onClick={toggleFullscreen} aria-label="切换全屏" title="切换全屏"><Expand /></button>}</div><div className={styles.viewTabs} aria-label="预设视角">{bindings.views.map((view) => <button key={view.id} className={view.id === selectedViewId ? styles.viewActive : ""} onClick={() => goToView(view.id)}>{view.name}</button>)}</div></>}
          </div>
          <aside className={`${styles.placePanel} ${selectedPlace ? styles.placePanelOpen : ""}`} aria-live="polite">
            {selectedPlace ? <><button className={styles.closePanel} onClick={() => setSelectedPlaceId(null)} aria-label="关闭景点介绍"><X /></button><span className={styles.panelIndex}>{String(selectedPlace.order).padStart(2, "0")}</span><p className={styles.kicker}>{selectedPlace.category}</p><h3>{selectedPlace.name}</h3><p>{selectedPlace.description}</p><div className={styles.panelMeta}><LocateFixed />已定位到测试场景</div></> : <div className={styles.panelEmpty}><Compass /><h3>发现校园景点</h3><p>点击场景中的编号标记，查看对应地点的图文介绍。</p></div>}
          </aside>
        </div>
        <div className={styles.mobileNote}><Smartphone /><div><b>移动端按需进入</b><span>正式轻量模型未配置时，手机将优先保留完整图文体验。</span></div></div>
      </section>

      <section id="places" className={styles.placesSection}>
        <div className={styles.placesIntro}><p className={styles.kicker}>校园景点</p><h2>每一处风景，<br />都有自己的故事</h2><p>以下内容用于验证景点信息结构。替换正式资料后，卡片、三维标记与推荐视角会继续使用同一组稳定编号。</p></div>
        <div className={styles.placeList}>{sortedPlaces.map((place, index) => <article className={styles.placeCard} key={place.id}><button className={styles.cardImage} onClick={() => selectPlace(place)} aria-label={`在三维场景中查看${place.name}`}><img src={place.image} alt={place.imageAlt} /><span>{String(index + 1).padStart(2, "0")}</span>{place.coveredByScene && <i><LocateFixed />场景已覆盖</i>}</button><div className={styles.cardCopy}><p>{place.category}</p><h3>{place.name}</h3><span>{place.description}</span>{place.coveredByScene && <button onClick={() => selectPlace(place)}>在三维中定位 <ChevronRight /></button>}</div></article>)}</div>
      </section>

      <footer className={styles.footer}><div className={styles.footerBrand}><span className={styles.brandMark}><Building2 /></span><div><b>{site.schoolName}</b><small>{site.shortName}</small></div></div><p>{site.footerNote}</p><div className={styles.footerLinks}><a href="#about">校园概览</a><a href="#campus-3d">三维校园</a><a href="#places">校园景点</a></div></footer>
    </main>
  );
}
