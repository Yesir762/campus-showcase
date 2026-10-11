import type {SiteConfig,ResolvedScene} from '@/lib/campus-config';
import {SiteShell} from './site-shell';
import {SceneCards} from './scene-cards';
import {HomeEntrance} from './home-entrance';
import {CampusTitle,Reveal,SectionTitle} from './campus-motion';
import styles from '@/app/page.module.css';
export function CampusHome({site,scenes}:{site:SiteConfig;scenes:ResolvedScene[]}) {
 return <HomeEntrance><SiteShell site={site}>
  <section id="top" data-hero className={styles.hero}><img src="/campus-scan-placeholder.jpg" alt="AI 生成校园占位视觉，非真实校园照片" data-hero-image className={styles.heroImage}/><div className={styles.heroShade}/><div className={styles.scanGrid}/><div className={styles.heroContent}><p className={styles.eyebrow}><span/>{site.eyebrow}</p><CampusTitle text={site.heroTitle}/><p data-hero-copy className={styles.heroText}>从主校区全景到航海楼，再走进航海博物馆。通过三个独立板块，探索余家头校区的空间与风景。</p><div data-hero-copy className={styles.heroActions}><a className={`${styles.primaryButton} ${styles.linkButton}`} href="#campus-3d">选择探索板块 →</a><a className={styles.textLink} href="/scenes/main-campus">进入主校区</a></div></div><span className={styles.placeholderLabel}>AI 生成占位视觉 · 待替换正式校园照片</span></section>
  <section data-motion-section id="about" className={styles.aboutSection}><SectionTitle english="ABOUT"/><div data-motion-copy className={styles.aboutLead}><p className={styles.kicker}>校园概览</p><h2>{site.aboutTitle}</h2></div><div data-motion-copy className={styles.aboutCopy}><p>{site.aboutDescription}</p><div className={styles.aboutStats}><div><strong>03</strong><span>独立展示板块</span></div><div><strong>02</strong><span>室外展示板块</span></div><div><strong>01</strong><span>室内展示板块</span></div></div></div></section>
  <section data-motion-section id="campus-3d" className={styles.catalogSection}><SectionTitle english="EXPLORE"/><div data-motion-copy className={styles.sectionHeading}><div><p className={styles.kicker}>探索余家头</p><h2>选择一处风景，开始探索</h2></div><p>主校区模型已接入 · 另外两处模型准备中</p></div><Reveal><SceneCards scenes={scenes} showcase/></Reveal></section>
 </SiteShell></HomeEntrance>;
}
