import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  lod: { type: 'string', default: '2' },
  blocks: { type: 'string', default: 'Block000,Block001' },
  output: { type: 'string' },
} });
if (!['0', '1', '2'].includes(values.lod)) throw new Error('LOD must be 0, 1 or 2');
const names = values.blocks.split(',');
if (names.some(name => !['Block000', 'Block001'].includes(name)) || new Set(names).size !== names.length) throw new Error('Invalid blocks');

const root = 'work/model-import/3dgs/results/3dgs_ply';
const blocks = [];
for (const name of names) {
  const source = `${root}/${name}/LOD${values.lod}/point_cloud.ply`;
  const bytes = await readFile(source);
  const end = bytes.indexOf('end_header\n') + 11;
  if (end < 11) throw new Error('Missing PLY header');
  const header = bytes.subarray(0, end).toString();
  if (!header.includes('format binary_little_endian 1.0')) throw new Error('Unsupported PLY format');
  const count = Number(header.match(/element vertex (\d+)/)?.[1]);
  const properties = [...header.matchAll(/property float (\S+)/g)].map(x => x[1]);
  const stride = properties.length * 4;
  if (!count || properties.slice(0, 3).join(',') !== 'x,y,z' || bytes.length - end !== count * stride) throw new Error(`Invalid payload: ${name}`);
  const body = bytes.subarray(end);
  blocks.push({ source, header, count, properties, stride, body, sha256: createHash('sha256').update(body).digest('hex') });
}
if (blocks.some(block => JSON.stringify(block.properties) !== JSON.stringify(blocks[0].properties))) throw new Error('Incompatible blocks');
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const block of blocks) {
  for (let i = 0; i < block.count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = block.body.readFloatLE(i * block.stride + axis * 4);
      if (!Number.isFinite(value)) throw new Error(`Invalid position: ${block.source}, ${i}`);
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
}
const count = blocks.reduce((sum, block) => sum + block.count, 0);
// Keep Gaussian payload bytes unchanged, but correct block-specific bounds.
const header = blocks[0].header.replace(/element vertex \d+/, `element vertex ${count}`)
  .replace(/^comment (min|max)[xyz] .*\n/gm, '')
  .replace('end_header\n', `${['x', 'y', 'z'].map((axis, i) => `comment min${axis} ${min[i]}\ncomment max${axis} ${max[i]}`).join('\n')}\nend_header\n`);
const output = values.output ?? `public/models/yujiatou-test-v1/campus-lod${values.lod}.ply`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, header);
for (const block of blocks) await appendFile(output, block.body);
const report = {
  output, lod: Number(values.lod), vertices: count, bounds: { min, max },
  center: min.map((x, i) => (x + max[i]) / 2), properties: blocks[0].properties,
  bytes: Buffer.byteLength(header) + blocks.reduce((sum, block) => sum + block.body.length, 0),
  sources: blocks.map(({ source, count, sha256 }) => ({ source, vertices: count, payloadSha256: sha256 })),
};
await writeFile(output.replace(/\.ply$/, '-import.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
