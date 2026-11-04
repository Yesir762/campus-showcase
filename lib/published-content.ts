import {all,one,type SceneRow} from './admin/store';
import {resolveScene,sceneSchema} from './scene-schema';
import {siteConfig} from './campus-config';
export async function getPublishedCatalog(){
 const rows=await all<SceneRow>('SELECT * FROM scenes WHERE published IS NOT NULL AND hidden=0 AND archived=0 ORDER BY position,id');
 return rows.map(r=>resolveScene(sceneSchema.parse(JSON.parse(r.published!))));
}
export async function getScene(id:string){const rows=await getPublishedCatalog();return rows.find(s=>s.definition.id===id);}
export async function getSiteConfig(){const row=await one<{data:string}>('SELECT data FROM settings WHERE id=?','site');if(!row)throw Error('网站尚未初始化，请在后台导入现有内容');return {...siteConfig,...JSON.parse(row.data)};}
