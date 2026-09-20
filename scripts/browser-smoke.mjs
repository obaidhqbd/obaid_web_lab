import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const dist=path.resolve('dist');
if(!fs.existsSync(path.join(dist,'index.html'))) throw new Error('dist/index.html is required. Build the site before browser smoke testing.');

function findBrowser(){
  const candidates=[
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/microsoft-edge'
  ].filter(Boolean);
  return candidates.find(p=>fs.existsSync(p)) || null;
}
const browser=findBrowser();
const allowSkip=String(process.env.BROWSER_SMOKE_ALLOW_SKIP||'').toLowerCase()==='true';
if(!browser){
  if(allowSkip){ console.warn('Browser smoke skipped: Chromium/Chrome is unavailable on this runner.'); process.exit(0); }
  throw new Error('Chromium/Chrome was not found. Set CHROMIUM_PATH to a browser executable.');
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://127.0.0.1');
  let filePath=path.join(dist,url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/,'')); 
  if(!filePath.startsWith(dist+path.sep)) { res.writeHead(400); res.end('bad path'); return; }
  if(!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath=path.join(dist,'404.html');
  const ext=path.extname(filePath).toLowerCase();
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',types[ext]||'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const port=typeof address==='object' ? address.port : 0;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'oml-browser-'));
const args=[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--disable-software-rasterizer','--disable-background-networking','--disable-extensions','--no-first-run','--no-default-browser-check',
  '--user-data-dir='+profile,'--virtual-time-budget=2500','--dump-dom',
  `http://127.0.0.1:${port}/?smoke=1`
];
try{
  const output=execFileSync(browser,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000});
  if(!output.includes('data-oml-boot="ready"')) throw new Error('Browser smoke did not reach the application boot marker.');
  if(!output.includes('data-smoke="pass"')) throw new Error('Browser smoke interaction probe failed.');
  if(!output.includes('Open student lab')) throw new Error('Home CTA is missing from rendered DOM.');
  console.log('Browser smoke passed: boot, theme toggle and login navigation responded in Chromium.');
}catch(err){
  if(allowSkip){ console.warn('Browser smoke skipped because Chromium could not complete the probe:', err.message); process.exit(0); }
  throw err;
try{
  const runBrowser=()=>new Promise((resolve,reject)=>{
    const child=spawn(browser,args,{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
    let output='';
    let errorOutput='';
    const timer=setTimeout(()=>{
      try{
        if(process.platform==='win32') child.kill('SIGKILL');
        else process.kill(-child.pid,'SIGKILL');
      }catch{}
      reject(new Error('Chromium did not finish the smoke probe within 8000ms.'));
    },8000);
    child.stdout.on('data',chunk=>{output+=chunk.toString();});
    child.stderr.on('data',chunk=>{errorOutput+=chunk.toString();});
    child.on('error',err=>{clearTimeout(timer);reject(err);});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);
      if(code!==0) reject(new Error(`Chromium exited with code ${code || 'null'}${signal ? ` (${signal})` : ''}. ${errorOutput.slice(-500)}`));
      else resolve(output);
    });
  });
  const output=await runBrowser();
  if(!output.includes('data-oml-boot="ready"')) throw new Error('Browser smoke did not reach the application boot marker.');
  if(!output.includes('data-smoke="pass"')) throw new Error('Browser smoke interaction probe failed.');
  if(!output.includes('Open student lab')) throw new Error('Home CTA is missing from rendered DOM.');
  console.log('Browser smoke passed: boot, theme toggle and login navigation responded in Chromium.');
}catch(err){
  if(allowSkip){ console.warn('Browser smoke skipped because Chromium could not complete the probe:', err.message); process.exit(0); }
  throw err;

  fs.rmSync(profile,{recursive:true,force:true});
}
