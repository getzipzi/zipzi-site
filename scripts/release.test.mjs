import test from 'node:test';
import assert from 'node:assert/strict';
import {readRelease,renderRelease,validateRelease} from './release.mjs';
const release=await readRelease();
test('Private release links retain an explicit access disclosure',()=>{
  const html=renderRelease({...release,private:true});
  assert.match(html,/普通访客目前暂无公共下载/);
  for(const asset of release.assets)assert.ok(html.includes(asset.url));
  assert.ok(html.includes(release.url));
  assert.ok(!html.includes('/latest/download/'));
});
test('Release rendering rejects substituted repositories, URLs and unreviewed platforms',()=>{
  assert.throws(()=>validateRelease({...release,repository:'someone/other'}));
  assert.throws(()=>validateRelease({...release,url:'https://example.com/download'}));
  const changed=structuredClone(release);changed.assets[0].url='javascript:alert(1)';
  assert.throws(()=>validateRelease(changed));
  assert.throws(()=>renderRelease({...release,review:null}));
  assert.throws(()=>renderRelease({...release,review:{platform:'windows'}}));
});
test('Invalid digest, duplicate assets and path traversal are rejected',()=>{
  const bad=structuredClone(release);bad.assets[0].digest='sha256:missing';
  assert.throws(()=>validateRelease(bad));
  assert.throws(()=>validateRelease({...release,assets:[release.assets[0],release.assets[0]]}));
  assert.throws(()=>validateRelease({...release,tag:'../../main'}));
});
