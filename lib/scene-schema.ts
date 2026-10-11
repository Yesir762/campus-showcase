import { z } from 'zod';
import { isWalkable } from './walk-geometry.ts';
const number = z.number().finite();
const vec3 = z.tuple([number, number, number]);
const point2 = z.tuple([number, number]);
const polygon = z.array(point2).min(3);
export const navigationSchema = z.object({
  calibrated: z.boolean(), floorY: number,
  eyeHeight: number.positive().default(1.6), radius: number.positive().default(0.25), speed: number.positive().default(1.2),
  walkable: z.array(polygon).min(1), obstacles: z.array(polygon).default([]),
});
export const versionSchema = z.object({
  label: z.string(), status: z.enum(['test', 'production']), format: z.enum(['ply', 'sog', 'streamed-sog']),
  desktopUrl: z.string().min(1), mobileUrl: z.string().nullable(),
  mobileFormat: z.enum(['ply', 'sog', 'streamed-sog']).default('sog'),
  mobileLabel: z.string().default('手机轻量模型'), mobileBytes: number.positive().optional(),
  poster: z.string(), modelNotice: z.string(), updatedAt: z.string(), defaultVariant: z.string().optional(),
  variants: z.array(z.object({ id: z.string(), label: z.string(), url: z.string(), format: z.enum(['sog', 'streamed-sog']), diagnostic: z.boolean().default(false), bytes: number.nonnegative().optional(), points: number.int().positive().optional() })).default([]),
});
export const bindingSchema = z.object({
  sceneVersion: z.string(),
  transform: z.object({ position: vec3, rotation: vec3, scale: vec3 }),
  camera: z.object({ minDistance: number.positive(), maxDistance: number.positive(), initialViewId: z.string(), fov: number.min(20).max(100).default(55), panMin: vec3.default([-8,-3,-8]), panMax: vec3.default([8,5,8]), splatBudget: number.int().positive().default(3000000) }),
  views: z.array(z.object({ id: z.string(), name: z.string(), camera: vec3, target: vec3, preview: z.object({x:number,y:number,scale:number}).optional() })).min(1),
  markers: z.array(z.object({placeId:z.string(), position:vec3})).default([]),
  locations: z.array(z.object({placeId:z.string(),viewId:z.string()})).default([]),
  navigation: navigationSchema.optional(),
});
export const sceneSchema = z.object({
  id: z.string(), title:z.string(), summary:z.string(), kind:z.enum(['outdoor','indoor']), mode:z.enum(['orbit','walk']),
  availability:z.enum(['ready','pending']), poster:z.string(), posterAlt:z.string(), activeVersion:z.string().nullable(),
  versions:z.record(z.unknown()), bindings:z.record(z.unknown()),
  content:z.array(z.object({id:z.string(),name:z.string(),category:z.string(),description:z.string(),image:z.string(),imageAlt:z.string(),order:number.int()})),
});
export type SceneDefinition = z.infer<typeof sceneSchema>;
export type SceneVersion = z.infer<typeof versionSchema>;
export type SceneBindings = z.infer<typeof bindingSchema>;
export type ResolvedScene = { definition:SceneDefinition; version:SceneVersion|null; bindings:SceneBindings|null; issue:string|null };
export function resolveScene(definition:SceneDefinition):ResolvedScene {
  const unavailable = (issue:string):ResolvedScene => ({definition,version:null,bindings:null,issue});
  if (definition.availability === 'pending') return unavailable('模型与空间资料准备中');
  try {
    if (!definition.activeVersion) throw Error('未配置当前模型版本');
    const version=versionSchema.parse(definition.versions[definition.activeVersion]);
    const bindings=bindingSchema.parse(definition.bindings[definition.activeVersion]);
    if(bindings.sceneVersion!==definition.activeVersion) throw Error('模型与空间绑定版本不一致');
    const ids=bindings.views.map(v=>v.id), variants=version.variants.map(v=>v.id), content=definition.content.map(c=>c.id);
    if(new Set(ids).size!==ids.length || new Set(variants).size!==variants.length || new Set(content).size!==content.length) throw Error('配置编号重复');
    if(!ids.includes(bindings.camera.initialViewId)) throw Error('入口视角不存在');
    if(version.defaultVariant&&!variants.includes(version.defaultVariant)) throw Error('默认精度不存在');
    if(bindings.camera.minDistance>=bindings.camera.maxDistance || bindings.camera.panMin.some((n,i)=>n>=bindings.camera.panMax[i])) throw Error('相机边界无效');
    if(bindings.locations.some(l=>!content.includes(l.placeId)||!ids.includes(l.viewId)) || bindings.markers.some(m=>!bindings.locations.some(l=>l.placeId===m.placeId))) throw Error('内容与空间定位不匹配');
    if(definition.kind==='indoor' && definition.mode!=='walk') throw Error('室内控制方式无效');
    if(definition.mode==='walk') {
      const nav=bindings.navigation;
      if(!nav?.calibrated) throw Error('室内行走区域尚未校准');
      if(bindings.views.some(v=>!isWalkable([v.camera[0],v.camera[2]],nav)||Math.abs(v.camera[1]-nav.floorY-nav.eyeHeight)>0.01||Math.hypot(v.target[0]-v.camera[0],v.target[2]-v.camera[2])<0.001)) throw Error('室内视点超出有效行走区域或高度不匹配');
    }
    return {definition,version,bindings,issue:null};
  } catch(error) { return unavailable(error instanceof z.ZodError?'场景资源或空间配置校验失败':(error as Error).message); }
}
