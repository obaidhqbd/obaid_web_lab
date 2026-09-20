import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

for(const file of ['app.js','scripts/build.mjs','scripts/verify-build.mjs','scripts/validate-content.mjs','scripts/browser-smoke.mjs']){
  execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
}
for(const file of ['index.html','styles.css','sw.js','site.webmanifest']){
  if(!fs.existsSync(file)) throw new Error(`Missing required source file: ${file}`);
}
const index=fs.readFileSync('index.html','utf8');
if(index.includes('window.monacoReady') || index.includes("monaco-editor@0.56.0/min/vs/loader.js")){
  throw new Error('Monaco must stay lazy-loaded; the homepage should not bootstrap Monaco immediately.');
}
console.log('Source smoke checks passed.');
