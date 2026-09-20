import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'obaidul-lab-'));
const ITERATIONS = 600_000;
const PASSWORD = process.env.CLASS_ACCESS_PASSWORD || 'demo-only-change-me';
const IS_ACTIONS = Boolean(process.env.GITHUB_ACTIONS);
const REQUIRE_PRODUCTION_SECRET = String(process.env.REQUIRE_PRODUCTION_SECRET || '').toLowerCase() === 'true';

if (REQUIRE_PRODUCTION_SECRET && PASSWORD === 'demo-only-change-me') {
  throw new Error('CLASS_ACCESS_PASSWORD is required for a production Pages build.');
}

function cleanDir(dir){ if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true}); }
function safeId(value){return String(value||'item').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'item';}
function titleFromName(name){return String(name).replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim();}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function readSiteConfig(){const file=path.join(ROOT,'site-config.json');if(!fs.existsSync(file))return {brand:{name:'Obaidul Mentor Lab',mentor:'Mohammed Obaidul Hoque',role:'web development mentor',portfolioUrl:'',portfolioLabel:'Portfolio'},site:{description:'A focused premium support lab for students learning web design with HTML and CSS.'}};try{return readJson(file)}catch(err){throw new Error(`Invalid site-config.json: ${err.message}`)}}
function copy(src,dst){fs.cpSync(src,dst,{recursive:true});}
function listFiles(dir,base=dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','.DS_Store'].includes(ent.name))continue;const abs=path.join(dir,ent.name);if(ent.isDirectory())listFiles(abs,base,out);else out.push(path.relative(base,abs).replaceAll(path.sep,'/'));}return out;}
function firstMarkdownParagraph(file){if(!fs.existsSync(file))return '';const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);for(const line of lines){const s=line.trim();if(!s||s.startsWith('#')||s.startsWith('```')||s.startsWith('- ')||s.startsWith('* '))continue;return s.replace(/[*_`]/g,'').slice(0,280);}return '';}
function normalizeRel(p){return String(p||'').replaceAll(path.sep,'/').replace(/^\.\//,'').replace(/^\/+/,'').replace(/\/+/g,'/');}
function numericOrder(value,fallback=999){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function inferOrder(value,name,fallback=999){if(value!=null&&value!=='')return numericOrder(value,fallback);const m=String(name||'').match(/^(\d{1,4})(?:[-_. ]|$)/);return m?Number(m[1]):fallback;}
function firstExistingMeta(dir){return ['metadata.json','meta.json','class.json'].map(n=>path.join(dir,n)).find(fs.existsSync)||null;}
function childConfigList(meta){for(const key of ['subclasses','subtopics','modules','children']) if(Array.isArray(meta?.[key])) return meta[key]; return [];}
function isTopicDirectory(dir){if(!fs.statSync(dir).isDirectory()) return false; const base=path.basename(dir).toLowerCase(); if(['assets','asset','images','image','img','media','public','static','src','dist','node_modules','.git'].includes(base)) return false; const entries=fs.readdirSync(dir,{withFileTypes:true}); return entries.some(e=>e.isFile() && /^(metadata|meta)\.json|README\.md|readme\.md|index\.html?$/i.test(e.name)) || entries.some(e=>e.isFile() && /\.(html?|css|md)$/i.test(e.name));}
function scopePackagePath(basePath,target){
  const raw=normalizeRel(target);
  const base=normalizeRel(basePath);
  if(!raw) return raw;
  if(!base || raw===base || raw.startsWith(base+'/')) return raw;
  const joined=normalizeRel(path.posix.join(base,raw));
  if(joined==='..' || joined.startsWith('../') || joined.includes('/../')) throw new Error(`Unsafe homework file path: ${target}`);
  return joined;
}
function normalizeCheckTree(check,basePath){
  if(!check||typeof check!=='object') return check;
  const out={...check};
  if(out.file && typeof out.file==='string' && !out.file.startsWith('/') && !/^[a-z]+:/i.test(out.file)) out.file=scopePackagePath(basePath,out.file);
  if(Array.isArray(out.files)) out.files=out.files.map(f=>typeof f==='string' && !f.startsWith('/') && !/^[a-z]+:/i.test(f) ? scopePackagePath(basePath,f) : f);
  if(Array.isArray(out.checks)) out.checks=out.checks.map(c=>normalizeCheckTree(c,basePath));
  return out;
}
function normalizeHomework(homework,defaults,basePath=''){const rawTasks=Array.isArray(homework?.tasks)?homework.tasks:(Array.isArray(homework?.checks)?homework.checks:[]); return {...(defaults||{}),...(homework||{}),tasks:rawTasks.map((t,i)=>{const task=typeof t==='string'?{title:t,description:'Complete this learning task.',checks:[]}:{title:t?.title||('Task '+(i+1)),description:t?.description||'',checks:Array.isArray(t?.checks)?t.checks:[]}; return {...task,checks:task.checks.map(c=>normalizeCheckTree(c,basePath))};})};}
function parseMeta(dir,type,name){
  const metaFile=firstExistingMeta(dir); let meta={};
  if(metaFile){try{meta=readJson(metaFile)}catch(err){console.warn('Invalid metadata.json in '+name+': '+err.message)}}
  const readme=path.join(dir,'README.md');
  const blogMd=['article.md','index.md','README.md','readme.md'].map(n=>path.join(dir,n)).find(fs.existsSync);
  const title=meta.title || (()=>{if(fs.existsSync(readme)){const h=fs.readFileSync(readme,'utf8').match(/^#\s+(.+)$/m);if(h)return h[1].trim();}if(blogMd){const h=fs.readFileSync(blogMd,'utf8').match(/^#\s+(.+)$/m);if(h)return h[1].trim();}if(fs.existsSync(path.join(dir,'index.html'))){const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');const t=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);if(t)return t[1].replace(/\s+/g,' ').trim();const h=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);if(h)return h[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}return titleFromName(name)})();
  const description=meta.description || meta.summary || firstMarkdownParagraph(blogMd || readme);
  const defaults=type==='class'||type==='subclass'?{level:'Beginner',duration:'Self-paced',tags:['HTML','CSS'],order:999,featured:false,homework:{tasks:[],hints:['Read the task carefully before coding.','Change one thing at a time and use the live preview.']}}:{level:'General',duration:'5 min read',tags:['Web design'],order:999,featured:false};
  const merged={...defaults,...meta};
  if(type==='class'||type==='subclass') merged.homework=normalizeHomework(merged.homework,defaults.homework,'');
  return {...merged,id:safeId(meta.id || name),rank:inferOrder(meta.rank ?? meta.order,name,999),title,description,summary:meta.summary||description,type};
}
function decorateTopicTree(meta,dir,parentPath='',packageRoot=dir){
  const explicit=childConfigList(meta);
  const entries=explicit.length ? explicit.map((cfg,i)=>({cfg:cfg||{},name:String(cfg?.path||cfg?.folder||cfg?.directory||cfg?.id||('topic-'+(i+1))),explicit:true,index:i})) : fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory() && !e.name.startsWith('.') && isTopicDirectory(path.join(dir,e.name))).map((e,i)=>({cfg:{},name:e.name,explicit:false,index:i}));
  const seen=new Set(); const children=[];
  for(const entry of entries){
    const childDir=path.resolve(dir,entry.name);
    if(!childDir.startsWith(path.resolve(dir)+path.sep)||!fs.existsSync(childDir)||!fs.statSync(childDir).isDirectory()) continue;
    const parsed=parseMeta(childDir,'subclass',path.basename(childDir)); const cfg=entry.cfg||{}; const merged={...parsed,...cfg};
    const pathInPackage=normalizeRel(path.relative(packageRoot,childDir)); const childId=safeId(merged.id || ((parentPath?parentPath+'-':'')+path.basename(childDir)));
    if(seen.has(childId)) continue; seen.add(childId); merged.id=childId; merged.path=pathInPackage; merged.rank=inferOrder(merged.rank ?? merged.order,path.basename(childDir),entry.index+1); merged.order=merged.rank;
    merged.homework=normalizeHomework(merged.homework,{tasks:[],hints:[]},pathInPackage); delete merged.internal;
    const hasNested=childConfigList(merged).length || fs.readdirSync(childDir,{withFileTypes:true}).some(e=>e.isDirectory() && !e.name.startsWith('.') && isTopicDirectory(path.join(childDir,e.name)));
    if(hasNested) decorateTopicTree(merged,childDir,childId,packageRoot); else delete merged.subclasses; children.push(merged);
  }
  children.sort((a,b)=>numericOrder(a.rank)-numericOrder(b.rank)||String(a.title).localeCompare(String(b.title))); if(children.length) meta.subclasses=children; else delete meta.subclasses; return meta;
}
function findSourceDir(input,extractTo){
  if(fs.statSync(input).isDirectory()) return input;
  fs.mkdirSync(extractTo,{recursive:true}); execFileSync('unzip',['-q',input,'-d',extractTo]);
  const entries=fs.readdirSync(extractTo,{withFileTypes:true});
  if(entries.length===1 && entries[0].isDirectory()) return path.join(extractTo,entries[0].name);
  const candidates=[extractTo,...entries.filter(e=>e.isDirectory()).map(e=>path.join(extractTo,e.name))];
  return candidates.find(d=>fs.existsSync(path.join(d,'metadata.json'))||fs.existsSync(path.join(d,'README.md'))||fs.existsSync(path.join(d,'index.html'))) || extractTo;
}
function aesEncrypt(input, password, aad){
  const salt=crypto.randomBytes(16); const iv=crypto.randomBytes(12); const key=crypto.pbkdf2Sync(Buffer.from(password),salt,ITERATIONS,32,'sha256');
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv); cipher.setAAD(Buffer.from(aad)); const data=Buffer.concat([cipher.update(input),cipher.final()]); const tag=cipher.getAuthTag();
  return {version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:salt.toString('hex'),iv:iv.toString('base64'),tag:tag.toString('base64'),aad,data:data.toString('base64')};
}
function makeZip(sourceDir,outZip){
  const prev=process.cwd(); process.chdir(sourceDir); try {execFileSync('zip',['-qr',outZip,'.','-x','*.DS_Store','.git/*','node_modules/*']);} finally {process.chdir(prev);} return fs.readFileSync(outZip);
}
function copySiteShell(){
  cleanDir(DIST);
  for(const file of ['index.html','styles.css','app.js','sw.js','site.webmanifest','robots.txt','404.html']) fs.copyFileSync(path.join(ROOT,file),path.join(DIST,file));
  copy(path.join(ROOT,'assets'),path.join(DIST,'assets'));
}
function ensureDir(p){fs.mkdirSync(p,{recursive:true});}
function processCollection(folderName,type,catalog,manifestEntries){
  const sourceRoot=path.join(ROOT,folderName); if(!fs.existsSync(sourceRoot))return;
  const workRoot=path.join(WORK,folderName); ensureDir(workRoot); const inputs=fs.readdirSync(sourceRoot,{withFileTypes:true}).filter(e=>!e.name.startsWith('.'));
  const seen=new Set();
  for(const inputEnt of inputs){
    const input=path.join(sourceRoot,inputEnt.name); let tempExtract=path.join(WORK,'extract',safeId(inputEnt.name)); ensureDir(tempExtract);
    let src=findSourceDir(input,tempExtract); if(!fs.existsSync(src))continue;
    const meta=decorateTopicTree(parseMeta(src,type,inputEnt.name),src); let id=meta.id; let n=2; while(seen.has(id)||catalog.some(x=>x.id===id)){id=`${id}-${n++}`;} seen.add(id); meta.id=id;
    const zipPath=path.join(workRoot,`${id}.zip`); const zipBuf=makeZip(src,zipPath); const envelope=aesEncrypt(zipBuf,PASSWORD,`${type}:${id}:package:v1`);
    const targetDir=path.join(DIST,'data',type==='class'?'classes':'blogs');ensureDir(targetDir); const resourceFolder=type==='class'?'classes':'blogs'; const resRel=`./data/${resourceFolder}/${id}.enc.json`; fs.writeFileSync(path.join(targetDir,`${id}.enc.json`),JSON.stringify(envelope));
    const packageMeta={...meta,resource:resRel,updatedAt:new Date().toISOString()}; delete packageMeta.internal;
    manifestEntries.push(packageMeta);
  }
}

copySiteShell();
ensureDir(path.join(DIST,'data/classes')); ensureDir(path.join(DIST,'data/blogs'));
const siteConfig=readSiteConfig();
const catalog={site:{...siteConfig.brand,...siteConfig.site},classes:[],blogs:[],generatedAt:new Date().toISOString()};
processCollection('Classes','class',catalog.classes,catalog.classes);
processCollection('Blogs','blog',catalog.blogs,catalog.blogs);
catalog.classes.sort((a,b)=>(Number(a.order??a.rank)||999)-(Number(b.order??b.rank)||999)||a.title.localeCompare(b.title));
function sortTopicTree(nodes){(nodes||[]).sort((a,b)=>(Number(a.rank??a.order)||999)-(Number(b.rank??b.order)||999)||String(a.title).localeCompare(String(b.title)));for(const n of nodes||[])sortTopicTree(n.subclasses||[]);}
for(const item of catalog.classes) sortTopicTree(item.subclasses||[]);
catalog.blogs.sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)||a.title.localeCompare(b.title));
const catalogEnvelope=aesEncrypt(Buffer.from(JSON.stringify(catalog)),PASSWORD,'catalog:v1');
fs.writeFileSync(path.join(DIST,'data/catalog.enc.json'),JSON.stringify(catalogEnvelope));
fs.writeFileSync(path.join(DIST,'data/site.json'),JSON.stringify(catalog.site,null,2));
function countTopics(nodes){return (nodes||[]).reduce((sum,node)=>sum+1+countTopics(node.subclasses||[]),0);}
const topicCount=catalog.classes.reduce((sum,item)=>sum+countTopics(item.subclasses||[]),0);
const buildInfo={version:2,generatedAt:catalog.generatedAt,node:process.version,classes:catalog.classes.length,blogs:catalog.blogs.length,topics:topicCount,repository:process.env.GITHUB_REPOSITORY||null,commit:process.env.GITHUB_SHA||null,production:REQUIRE_PRODUCTION_SECRET};
fs.writeFileSync(path.join(DIST,'data/build-info.json'),JSON.stringify(buildInfo,null,2));

const contentReport={
  version:1,
  generatedAt:catalog.generatedAt,
  classes:catalog.classes.map(item=>({id:item.id,title:item.title,topics:countTopics(item.subclasses||[])})),
  blogs:catalog.blogs.map(item=>({id:item.id,title:item.title})),
  topicCount,
  encryptedResources:true
};
const releaseReport={
  version:1,
  status:'ready-for-pages',
  generatedAt:catalog.generatedAt,
  production:REQUIRE_PRODUCTION_SECRET,
  counts:{classes:catalog.classes.length,blogs:catalog.blogs.length,topics:topicCount},
  repository:process.env.GITHUB_REPOSITORY||null,
  commit:process.env.GITHUB_SHA||null
};
fs.writeFileSync(path.join(DIST,'data/content-report.json'),JSON.stringify(contentReport,null,2));
fs.writeFileSync(path.join(DIST,'data/release-report.json'),JSON.stringify(releaseReport,null,2));

const defaultSiteOrigin=process.env.GITHUB_REPOSITORY
  ? `https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
  : 'https://example.github.io/mentor-lab';
const siteOrigin=(process.env.SITE_URL||defaultSiteOrigin).replace(/\/$/,'');
const urls=[`${siteOrigin}/`,'']
  .concat(catalog.classes.map(x=>`${siteOrigin}/?class=${encodeURIComponent(x.id)}`))
  .concat(catalog.blogs.map(x=>`${siteOrigin}/?blog=${encodeURIComponent(x.id)}`));
const sitemap=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...urls.filter(Boolean).map(u=>`  <url><loc>${u}</loc></url>`),'</urlset>'].join('\n');
fs.writeFileSync(path.join(DIST,'sitemap.xml'),sitemap);
fs.writeFileSync(path.join(DIST,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST,'.nojekyll'),'');

console.log(`Built ${catalog.classes.length} classes and ${catalog.blogs.length} blogs.`);
if(!REQUIRE_PRODUCTION_SECRET)console.log(IS_ACTIONS ? 'Validation build used demo password; production deployments require CLASS_ACCESS_PASSWORD.' : 'Development build used demo password. Set CLASS_ACCESS_PASSWORD for a real build.');
