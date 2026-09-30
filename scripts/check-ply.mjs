import { open, stat } from "node:fs/promises";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("用法：npm run check:ply -- /绝对路径/模型.ply");
  process.exit(1);
}

const filePath = resolve(input);
const file = await open(filePath, "r");
const buffer = Buffer.alloc(256 * 1024);
const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
await file.close();
const text = buffer.subarray(0, bytesRead).toString("latin1");
const end = text.indexOf("end_header");
if (end < 0) throw new Error("未找到完整 PLY 头部，文件可能无效或头部过大");

const header = text.slice(0, end + "end_header".length);
const properties = [...header.matchAll(/^property\s+(?:list\s+\S+\s+\S+|\S+)\s+(\S+)/gm)].map((match) => match[1]);
const vertices = Number(header.match(/^element\s+vertex\s+(\d+)/m)?.[1] ?? 0);
const gaussianGroups = {
  position: ["x", "y", "z"],
  scale: ["scale_0", "scale_1", "scale_2"],
  rotation: ["rot_0", "rot_1", "rot_2", "rot_3"],
  opacity: ["opacity"],
};
const missing = Object.entries(gaussianGroups).filter(([, names]) => names.some((name) => !properties.includes(name))).map(([name]) => name);
const info = await stat(filePath);

console.log(JSON.stringify({
  file: filePath,
  sizeBytes: info.size,
  format: header.match(/^format\s+(\S+)/m)?.[1] ?? "unknown",
  vertices,
  propertyCount: properties.length,
  likelyGaussianSplat: missing.length === 0,
  missingAttributeGroups: missing,
}, null, 2));

if (missing.length) process.exitCode = 2;
