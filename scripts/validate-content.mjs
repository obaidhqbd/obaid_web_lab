import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const COLLECTIONS=[['Classes','class'],['Blogs','blog']];
const META_NAMES=new Set(['metadata.json','meta.json','class.json']);
const errors=[];
const warnings=[];

function normalize(p){return String(p||'').replaceAll(path.sep,'/').replace(/^\.\//,'').replace(/^\/+/,'');}
function fail(msg){errors.push(msg);}
function warn(msg){warnings.push(msg);}

function validateRelative(value,label){
  if(typeof value!=='string' || !value.trim()) { fail(`${label} must be a non-empty relative path.`); return; }
  const p=normalize(value.trim());
  if(p.startsWith('/') || /^[a-z]+:/i.test(p) || p.split('/').includes('..')) fail(`${label} is unsafe: ${value}`);
}

function validateChecks(checks,label){
  if(!Array.isArray(checks)) return;
  for(let i=0;i<checks.length;i++){
    const c=checks[i];
    if(typeof c==='string') continue;
    if(!c || typeof c!=='object'){fail(`${label}[${i}] must be an object or string.`);continue;}
    if(c.file) validateRelative(c.file,`${label}[${i}].file`);
    if(Array.isArray(c.files)) c.files.forEach((f,j)=>validateRelative(f,`${label}[${i}].files[${j}]`));
    if(c.checks) validateChecks(c.checks,`${label}[${i}].checks`);
  }
}

function validateMeta(file){
  let meta;
  try{meta=JSON.parse(fs.readFileSync(file,'utf8'));}catch(err){fail(`Invalid JSON in ${path.relative(ROOT,file)}: ${err.message}`);return null;}
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(meta && typeof meta.id!=='undefined' && (typeof meta.id!=='string' || !meta.id.trim())) fail(`${rel}: id must be a non-empty string when provided.`);
  const children=[...(Array.isArray(meta?.subclasses)?[['subclasses',meta.subclasses]]:[]),...(Array.isArray(meta?.subtopics)?[['subtopics',meta.subtopics]]:[]),...(Array.isArray(meta?.modules)?[['modules',meta.modules]]:[]),...(Array.isArray(meta?.children)?[['children',meta.children]]:[])];
  const siblingIds=new Set();
  for(const [key,list] of children){
    for(let i=0;i<list.length;i++){
      const node=list[i];
      if(!node || typeof node!=='object'){fail(`${rel}: ${key}[${i}] must be an object.`);continue;}
      if(node.id){
        const id=String(node.id).trim();
        if(siblingIds.has(id)) fail(`${rel}: duplicate nested topic id '${id}'.`);
        siblingIds.add(id);
      }
      if(node.path) validateRelative(node.path,`${rel}: ${key}[${i}].path`);
      const rank=node.rank ?? node.order;
      if(rank!=null && !Number.isFinite(Number(rank))) fail(`${rel}: ${key}[${i}] rank/order must be numeric.`);
      const homework=node.homework;
      if(homework?.checks) validateChecks(homework.checks,`${rel}: ${key}[${i}].homework.checks`);
      if(Array.isArray(homework?.tasks)) homework.tasks.forEach((task,j)=>{
        if(task && typeof task==='object') validateChecks(task.checks,`${rel}: ${key}[${i}].homework.tasks[${j}].checks`);
      });
    }
  }
  if(meta?.homework?.checks) validateChecks(meta.homework.checks,`${rel}: homework.checks`);
  if(Array.isArray(meta?.homework?.tasks)) meta.homework.tasks.forEach((task,j)=>{
    if(task && typeof task==='object') validateChecks(task.checks,`${rel}: homework.tasks[${j}].checks`);
  });
  return meta;
}

function walk(dir,kind,collectionRoot,seenIds){
  if(!fs.existsSync(dir)) return;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name);
    if(ent.isDirectory()){
      walk(abs,kind,collectionRoot,seenIds);
    }else if(META_NAMES.has(ent.name.toLowerCase())){
      const meta=validateMeta(abs);
      if(meta?.id && path.dirname(abs)===collectionRoot){
        const id=String(meta.id).trim().toLowerCase();
        if(seenIds.has(id)) fail(`Duplicate top-level ${kind} id '${meta.id}' in ${path.relative(ROOT,abs)}; already used by ${seenIds.get(id)}.`);
        else seenIds.set(id,path.relative(ROOT,abs).replaceAll(path.sep,'/'));
      }
    }
    if(ent.isFile()){
      const size=fs.statSync(abs).size;
      if(size>5*1024*1024) warn(`Large content file (>5 MB): ${path.relative(ROOT,abs).replaceAll(path.sep,'/')}`);
    }
  }
}
for(const [folder,kind] of COLLECTIONS){
  const collectionRoot=path.join(ROOT,folder);
  walk(collectionRoot,kind,collectionRoot,new Map());
}

if(errors.length){
  console.error('Content validation failed.');
  for(const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Content validation passed (${warnings.length} warning${warnings.length===1?'':'s'}).`);
for(const w of warnings) console.warn(`WARN: ${w}`);
