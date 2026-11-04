'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main style={{padding:'15vh 8vw'}}><h1>展示内容暂时无法读取</h1><p>请稍后重试。管理员可检查数据库连接与内容初始化状态。</p><button onClick={reset}>重新加载</button><p><a href="/admin">进入管理后台</a></p></main>;}
