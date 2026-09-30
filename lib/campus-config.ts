import { z } from "zod";
import siteData from "@/config/site.json";
import sceneData from "@/config/scene.json";
import bindingData from "@/config/bindings.json";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const placeSchema = z.object({
  id: z.string().min(1),
  order: z.number().int(),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  image: z.string().min(1),
  imageAlt: z.string().min(1),
  coveredByScene: z.boolean(),
  viewId: z.string().nullable(),
});

const siteSchema = z.object({
  schoolName: z.string().min(1),
  shortName: z.string().min(1),
  eyebrow: z.string().min(1),
  heroTitle: z.string().min(1),
  heroDescription: z.string().min(1),
  aboutTitle: z.string().min(1),
  aboutDescription: z.string().min(1),
  footerNote: z.string().min(1),
  theme: z.object({ primary: z.string(), accent: z.string() }),
  places: z.array(placeSchema).min(1),
});

const sceneVersionSchema = z.object({
  label: z.string(),
  status: z.enum(["test", "production"]),
  format: z.enum(["placeholder", "ply", "sog", "streamed-sog"]),
  desktopUrl: z.string().nullable(),
  mobileUrl: z.string().nullable(),
  poster: z.string(),
  modelNotice: z.string(),
  updatedAt: z.string(),
});

const sceneSchema = z.object({
  activeVersion: z.string(),
  versions: z.record(z.string(), sceneVersionSchema),
});

const viewSchema = z.object({
  id: z.string(),
  name: z.string(),
  camera: vec3,
  target: vec3,
  preview: z.object({ x: z.number(), y: z.number(), scale: z.number() }),
});

const bindingSchema = z.object({
  sceneVersion: z.string(),
  transform: z.object({ position: vec3, rotation: vec3, scale: vec3 }),
  camera: z.object({ minDistance: z.number(), maxDistance: z.number(), initialViewId: z.string() }),
  views: z.array(viewSchema).min(1),
  markers: z.array(z.object({
    placeId: z.string(),
    position: vec3,
    preview: z.object({ x: z.number(), y: z.number() }),
  })),
});

export const siteConfig = siteSchema.parse(siteData);
export const sceneManifest = sceneSchema.parse(sceneData);
export const sceneBindings = bindingSchema.parse(bindingData);

if (sceneBindings.sceneVersion !== sceneManifest.activeVersion) {
  throw new Error("空间绑定版本与当前场景版本不一致");
}

export const activeScene = sceneManifest.versions[sceneManifest.activeVersion];
if (!activeScene) throw new Error("找不到当前场景版本");

export type SiteConfig = z.infer<typeof siteSchema>;
export type Place = z.infer<typeof placeSchema>;
export type SceneVersion = z.infer<typeof sceneVersionSchema>;
export type SceneBindings = z.infer<typeof bindingSchema>;
