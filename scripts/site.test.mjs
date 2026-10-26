import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
test('Built HTML references existing content-addressed assets',async()=>{
 const html=await readFile(new URL('dist/index.html',root),'utf8');
 for(const [,asset]of html.matchAll(/(?:href|src)="\/(assets\/[^"]+)"/g)){
  const data=await readFile(new URL(`dist/${asset}`,root));
  const hash=createHash('sha256').update(data).digest('hex').slice(0,12);
  assert.ok(asset.includes(`.${hash}.`));
 }
});
test('Deployment manifest matches all release bytes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('qa/build-manifest.json',root),'utf8'));
 for(const file of manifest.files){const data=await readFile(new URL(`dist/${file.path}`,root));assert.equal(data.length,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);}
 assert.ok(manifest.totalBytes<500000,'Static page with authentic screenshot should remain under 500 KB');
 assert.ok(manifest.files.filter(f=>!f.path.endsWith('.png')).reduce((n,f)=>n+f.bytes,0)<50000,'HTML/CSS/JS should remain under 50 KB');
});
