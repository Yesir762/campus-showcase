'use client';
import {useState} from 'react';
import type {CSSProperties,ReactNode} from 'react';
import {Menu, X} from 'lucide-react';
import {BrandIcon} from './brand-icon';
import type {SiteConfig} from '@/lib/campus-config';
import {CreativeMotion} from './campus-motion';
import styles from '@/app/page.module.css';
export function SiteShell({site,children}:{site:SiteConfig;children:ReactNode}) {
 const [open,setOpen]=useState(false);
 return <CreativeMotion><main className={styles.page} style={{'--brand':site.theme.primary,'--accent':site.theme.accent} as CSSProperties}>
  <header data-motion-header className={styles.header}><a className={styles.brand} href="/" aria-label={`${site.shortName}首页`}><span className={styles.brandMark}><BrandIcon/></span><span><b>{site.shortName}</b><small>{site.schoolName} · 余家头校区</small></span></a>
   <nav className={`${styles.nav} ${open?styles.navOpen:''}`} aria-label="主导航"><a href="/#about" onClick={()=>setOpen(false)}>校园概览</a><a href="/#campus-3d" onClick={()=>setOpen(false)}>三大板块</a><a href="/scenes/main-campus" onClick={()=>setOpen(false)}>三维校园</a><span className={styles.previewTag}>测试预览</span></nav>
   <button className={styles.menuButton} aria-label={open?'关闭菜单':'打开菜单'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  </header>{children}
  <footer className={styles.footer}><div className={styles.footerBrand}><span className={styles.brandMark}><BrandIcon/></span><div><b>{site.shortName}</b><small>{site.schoolName} · 余家头校区</small></div></div><p>{site.footerNote}</p><div className={styles.footerLinks}><a href="/">校园总览</a><a href="/#campus-3d">选择板块</a></div></footer>
 </main></CreativeMotion>;
}
