import {notFound} from 'next/navigation';
import {getScene,sceneCatalog,siteConfig} from '@/lib/campus-config';
import {SiteShell} from '@/components/site-shell';
import {SceneCards} from '@/components/scene-cards';
import {SceneExperience} from '@/components/scene-experience';
import {SectionTitle} from '@/components/campus-motion';
import styles from '@/app/page.module.css';
export async function generateMetadata({params}:{params:Promise<{sceneId:string}>}){const scene=getScene((await params).sceneId);return {title:scene?`${scene.definition.title.replace('武汉理工大学（余家头校区）','')}｜云漫武理`:'板块不存在｜云漫武理'};}
export default async function ScenePage({params}:{params:Promise<{sceneId:string}>}) {
 const {sceneId}=await params;const scene=getScene(sceneId);if(!scene)notFound();
 const d=scene.definition;
 return <SiteShell site={siteConfig}><section data-motion-section className={styles.detailIntro}><SectionTitle english={sceneId==='main-campus'?'MAIN CAMPUS':sceneId==='navigation-building'?'NAVIGATION\nBUILDING':'MARITIME\nMUSEUM'}/><nav aria-label="面包屑" className={styles.breadcrumb}><a href="/">校园总览</a><span>/</span><span>{d.title.replace('武汉理工大学（余家头校区）','')}</span></nav><p className={styles.kicker}>{d.kind==='indoor'?'室内 · 航海文化':'室外 · 校园风光'}</p><h1>{d.title}</h1><p>{d.summary}</p></section>
 {scene.version&&scene.bindings?<SceneExperience key={`${d.id}:${d.activeVersion}`} scene={scene.version} bindings={scene.bindings} definition={d}/>:<><section data-motion-section className={styles.pendingSection}><div data-motion-card className={styles.pendingArt}><span>{d.kind==='indoor'?'室内漫游':'建筑展示'}</span><h2>{d.availability==='pending'?'模型准备中':'三维暂不可用'}</h2><p>{d.availability==='pending'?'模型与空间校准完成后将在此开放三维浏览。当前可以先了解本板块。':scene.issue}</p></div><div data-motion-copy className={styles.pendingCopy}><h2>后续浏览方式</h2><p>{d.kind==='indoor'?'电脑使用 WASD 行走、拖动观察，手机使用移动摇杆与滑动转向。只开放已校准的单层区域，并提供回到入口与展区跳转。':'支持旋转、平移、缩放和建筑预设视角；手机接入独立轻量资源。'}</p><h3>接入准备</h3><p>{d.kind==='indoor'?'待提供室内模型、平面图或实测边界、真实尺寸、入口及展区位置、展品介绍和照片。':'待提供航海楼模型、经确认的建筑介绍、照片及推荐观察位置。'}</p><p>当前没有可加载模型，不使用其他场景冒充本板块。</p></div></section><section data-motion-section id="places" className={styles.pendingContent}><SectionTitle english="STORIES"/>{d.content.map(c=><article data-motion-card key={c.id}><p className={styles.kicker}>{c.category}</p><h2>{c.name}</h2><p>{c.description}</p></article>)}</section></>}
 <section data-motion-section className={styles.catalogSection}><SectionTitle english="DISCOVER MORE"/><div data-motion-copy className={styles.sectionHeading}><h2>继续探索其他板块</h2><a href="/">返回校园总览 →</a></div><SceneCards scenes={sceneCatalog.filter(s=>s.definition.id!==sceneId)}/></section></SiteShell>;
}
