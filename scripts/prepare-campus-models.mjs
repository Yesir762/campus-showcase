import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const version = 'yujiatou-test-v2';
const destination = `public/models/${version}`;
await mkdir(destination, { recursive: true });
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Model command failed: ${code}`)));
});
const report = { version, converter: '@playcanvas/splat-transform@3.8.0', resources: [] };
for (const scope of ['block0', 'campus']) {
  for (const lod of [2, 1, 0]) {
    const ply = `work/model-import/merged/${scope}-lod${lod}.ply`;
    await run(['scripts/import-campus-ply.mjs', '--lod', String(lod), '--blocks', scope === 'block0' ? 'Block000' : 'Block000,Block001', '--output', ply]);
    const output = `${destination}/${scope}-lod${lod}.sog`;
    await run(['node_modules/@playcanvas/splat-transform/bin/cli.mjs', '--gpu', 'cpu', '--max-workers', '2', '--overwrite', ply, output]);
    const imported = JSON.parse(await readFile(ply.replace('.ply', '-import.json'), 'utf8'));
    const bytes = await readFile(output);
    report.resources.push({ scope, lod, url: `/models/${version}/${scope}-lod${lod}.sog`, bytes: (await stat(output)).size,
      sha256: createHash('sha256').update(bytes).digest('hex'), vertices: imported.vertices,
      bounds: imported.bounds, sources: imported.sources,
      note: 'SOG quantization; no point decimation or coordinate transformation applied.' });
    await writeFile(`${destination}/resource-report.json`, JSON.stringify(report, null, 2));
  }
}
await mkdir(`${destination}/streamed`, { recursive: true });
await run(['node_modules/@playcanvas/splat-transform/bin/cli.mjs', '--gpu', 'cpu', '--max-workers', '2', '--overwrite',
  '--lod-chunk-count', '256', '--lod-chunk-extent', '128',
  'work/model-import/merged/campus-lod0.ply', '-l', '0',
  'work/model-import/merged/campus-lod1.ply', '-l', '1',
  'work/model-import/merged/campus-lod2.ply', '-l', '2', `${destination}/streamed/lod-meta.json`]);
