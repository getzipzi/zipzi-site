import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(root,'dist/assets'),{recursive:true});
await mkdir(path.join(root,'qa'),{recursive:true});
let html=await readFile(path.join(root,'src/index.html'),'utf8');
const files=[];
for(const name of ['site.css','site.js','favicon.svg','editor-modeling.png']){
  const data=await readFile(path.join(root,'src/assets',name));
  const hash=createHash('sha256').update(data).digest('hex').slice(0,12);
  const extension=path.extname(name);
  const target=`${path.basename(name,extension)}.${hash}${extension}`;
  await writeFile(path.join(root,'dist/assets',target),data);
  html=html.replaceAll(`/assets/${name}`,`/assets/${target}`);
  files.push({path:`assets/${target}`,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
await writeFile(path.join(root,'dist/index.html'),html);
files.push({path:'index.html',bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')});
await writeFile(path.join(root,'qa/build-manifest.json'),JSON.stringify({files,totalBytes:files.reduce((sum,f)=>sum+f.bytes,0)},null,2)+'\n');
console.log(`Built ${files.length} files (${files.reduce((sum,f)=>sum+f.bytes,0)} bytes), no runtime dependencies.`);
