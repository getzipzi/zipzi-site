import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML ids');
for(const [,target]of html.matchAll(/href="#([^"]+)"/g))if(!ids.includes(target))throw Error(`Broken anchor: ${target}`);
if(!html.includes('lang="zh-CN"')||!html.includes('name="viewport"'))throw Error('Missing locale or viewport');
for(const [,url]of html.matchAll(/(?:href|src)="((?:https?:)?\/\/[^\"]+)"/g))if(url!=='https://beian.miit.gov.cn/')throw Error('Unexpected remote dependency/link; verify before adding');
if(!html.includes('尚未正式发布')||!html.includes('开发版本 / 内置测试场景'))throw Error('Missing release/screenshot disclosure');
console.log(`HTML checks passed: ${ids.length} unique ids; all internal links resolve; no external runtime dependencies.`);
