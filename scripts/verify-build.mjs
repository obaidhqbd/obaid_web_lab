import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const dist=path.join(process.cwd(),'dist');
const required=['index.html','styles.css','app.js','sw.js','site.webmanifest','editor.html','data/catalog.json','data/site.json','data/build-info.json','sitemap.xml'];
for(const file of required){if(!fs.existsSync(path.join(dist,file)))throw new Error('Missing '+file)}
const catalog=JSON.parse(fs.readFileSync(path.join(dist,'data/catalog.json'),'utf8'));
if(!Array.isArray(catalog.classes)||!Array.isArray(catalog.blogs))throw new Error('Invalid catalog collections');
for(const list of [catalog.classes,catalog.blogs]){
  for(const item of list){
    const p=path.join(dist,item.resource.replace(/^\.\//,''));
    if(!fs.existsSync(p))throw new Error('Missing '+item.resource);
    const tmp=path.join(os.tmpdir(),crypto.randomUUID()+'.zip');
    fs.copyFileSync(p,tmp);
    execFileSync('unzip',['-tq',tmp]);
    fs.unlinkSync(tmp);
  }
}
const info=JSON.parse(fs.readFileSync(path.join(dist,'data/build-info.json'),'utf8'));
if(info.classes!==catalog.classes.length||info.blogs!==catalog.blogs.length)throw new Error('Build info mismatch');
console.log('Build verification passed: '+catalog.classes.length+' classes, '+catalog.blogs.length+' blogs.');