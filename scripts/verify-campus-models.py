"""Verify produced model counts, integrity and all streamed texture references."""
import hashlib
import json
from pathlib import Path
import zipfile

def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

root = Path('public/models/yujiatou-test-v2')
report = json.loads((root / 'resource-report.json').read_text())
scene = json.loads(Path('config/scene.json').read_text())
bindings = json.loads(Path('config/bindings.json').read_text())
assert scene['activeVersion'] == bindings['sceneVersion'] == report['version']
for resource in report['resources']:
    path = Path('public' + resource['url'])
    assert path.stat().st_size == resource['bytes'], path
    assert sha256(path) == resource['sha256'], path
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None, path
        meta = json.loads(z.read('meta.json'))
        assert meta['count'] == resource['vertices'], path
        for key in ['means', 'scales', 'quats', 'sh0']:
            assert meta[key]['files'], (path, key)
            for name in meta[key]['files']:
                assert name in z.namelist(), (path, name)

stream = root / 'streamed'
meta = json.loads((stream / 'lod-meta.json').read_text())
expected = [next(r['vertices'] for r in report['resources'] if r['scope'] == 'campus' and r['lod'] == lod) for lod in range(3)]
assert meta['counts'] == expected, (meta['counts'], expected)
assert meta['count'] == sum(expected)
actual = [0, 0, 0]
for name in meta['filenames']:
    path = stream / name
    assert path.is_file(), path
    lod = int(name.split('_')[0])
    chunk = json.loads(path.read_text())
    actual[lod] += chunk['count']
    for key in ['means', 'scales', 'quats', 'sh0']:
        for filename in chunk[key]['files']:
            texture = path.parent / filename
            assert texture.is_file() and texture.stat().st_size > 0, texture
assert actual == expected, (actual, expected)

# Deployment inventory: upload the whole version directory, preserving relative paths.
inventory = []
for path in sorted(stream.rglob('*')):
    if path.is_file():
        digest = sha256(path)
        inventory.append({'path': str(path.relative_to(root)), 'bytes': path.stat().st_size, 'sha256': digest})
(root / 'streamed-integrity.json').write_text(json.dumps(inventory, indent=2) + '\n')
print(f'PASS: 6 SOG resources; {len(meta["filenames"])} chunks; LOD counts {actual}; {len(inventory)} streamed files.')
