(() => {
  'use strict';

  if (window.OwlPowerWorkspace) return;

  var state = {
    catalog: null,
    password: '',
    current: null,
    files: new Map(),
    folders: new Set(),
    active: '',
    selected: '',
    history: [],
    future: [],
    saveTimer: null,
    db: null,
    unlocked: false
  };

  var TEXT_RE = /\.(html?|css|js|mjs|json|md|txt|svg|xml|yml|yaml|csv|ts|tsx|jsx|scss)$/i;

  function el(tag, attrs, children) {
    var x = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function(k) {
      if (k === 'text') x.textContent = attrs[k];
      else if (k === 'html') x.innerHTML = attrs[k];
      else x.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function(c){ x.appendChild(c); });
    return x;
  }

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '.owl-plus-backdrop{position:fixed;inset:0;z-index:999;background:rgba(3,7,14,.74);backdrop-filter:blur(14px);display:grid;place-items:center;padding:18px}' +
      '.owl-plus{width:min(1450px,98vw);height:min(900px,94vh);display:grid;grid-template-rows:auto 1fr;border:1px solid rgba(255,255,255,.12);border-radius:20px;overflow:hidden;background:#09111d;color:#eaf2ff;box-shadow:0 30px 100px #0009}' +
      '.owl-plus.light{background:#f7f9fc;color:#111827}' +
      '.owl-plus-head{display:flex;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.09);background:#0e1827}' +
      '.owl-plus.light .owl-plus-head{background:#fff;border-color:#dbe3ee}' +
      '.owl-plus-head strong{font-size:13px}.owl-plus-muted{color:#8090a8;font-size:10px}.owl-plus-actions{display:flex;gap:6px;align-items:center;margin-left:auto}.owl-plus-btn{border:1px solid rgba(255,255,255,.1);background:#121f31;color:#eaf2ff;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:700;cursor:pointer}.owl-plus-btn:hover{border-color:#6ea8ff}.owl-plus-btn.primary{background:linear-gradient(135deg,#477fe6,#6f55cf);border-color:transparent}.owl-plus-btn.danger{color:#ff9a9a}.owl-plus-btn:disabled{opacity:.45;cursor:not-allowed}.owl-plus-close{font-size:16px;width:32px;height:32px;padding:0}.owl-plus-body{display:grid;grid-template-columns:250px minmax(0,1fr) minmax(0,420px);min-height:0}.owl-plus-panel{min-width:0;min-height:0;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column}.owl-plus-panel:last-child{border-right:0}.owl-plus-toolbar{display:flex;gap:5px;padding:9px;border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap}.owl-plus-select,.owl-plus-input{height:32px;border:1px solid rgba(255,255,255,.1);background:#101b2a;color:#eaf2ff;border-radius:8px;padding:0 8px;font-size:10px}.owl-plus-select{min-width:180px}.owl-plus-filefilter{padding:8px}.owl-plus-files{overflow:auto;padding:4px 7px 12px;min-height:0}.owl-plus-file{display:flex;align-items:center;gap:7px;width:100%;border:0;background:transparent;color:#94a5bd;text-align:left;border-radius:7px;padding:7px 8px;cursor:pointer;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.owl-plus-file:hover,.owl-plus-file.active{background:#162640;color:#ddecff}.owl-plus-editor-wrap{display:flex;flex-direction:column;min-height:0;flex:1}.owl-plus-editor-top{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);font-size:10px}.owl-plus-code{flex:1;width:100%;min-height:0;resize:none;border:0;outline:0;background:#07101a;color:#e2eafa;padding:14px;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;tab-size:2}.owl-plus.preview{background:#fff}.owl-plus-preview-head{padding:10px 12px;border-bottom:1px solid #dbe3ee;color:#223047;font-size:10px;font-weight:800}.owl-plus-frame{width:100%;height:100%;min-height:0;border:0}.owl-plus-status{padding:6px 9px;border-top:1px solid rgba(255,255,255,.08);font:9px ui-monospace,SFMono-Regular,Consolas,monospace;color:#73839a}.owl-plus-login{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(3,7,14,.74);backdrop-filter:blur(14px);padding:20px}.owl-plus-login-card{width:min(560px,95vw);padding:25px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:#0d1827;color:#eaf2ff}.owl-plus-login-card h2{margin:4px 0 8px}.owl-plus-login-card p{color:#90a0b6;font-size:12px;line-height:1.7}.owl-plus-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.owl-plus-hidden{display:none!important}.owl-plus-trigger{position:fixed;right:18px;bottom:18px;z-index:60;border:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,#477fe6,#6f55cf);color:#fff;border-radius:12px;padding:10px 13px;font-weight:800;font-size:11px;box-shadow:0 16px 40px #0005;cursor:pointer}.owl-plus-card{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0f1b2a;color:#8fa0b8;font-size:10px;line-height:1.6}.owl-plus-tasks{padding:8px;overflow:auto;border-top:1px solid rgba(255,255,255,.08)}.owl-plus-task{display:flex;gap:7px;padding:6px 0;font-size:10px}.owl-plus-task input{accent-color:#56d6a1}.owl-plus-badge{font-size:9px;padding:3px 6px;border-radius:999px;border:1px solid rgba(255,255,255,.09);color:#9eb0c7}.owl-plus-file-actions{display:flex;gap:5px;flex-wrap:wrap;padding:8px;border-top:1px solid rgba(255,255,255,.08)}' +
      '@media(max-width:1050px){.owl-plus-body{grid-template-columns:220px minmax(0,1fr)}.owl-plus-panel.preview{grid-column:1/-1;min-height:34vh}.owl-plus{height:96vh}.owl-plus.preview .owl-plus-frame{min-height:300px}}' +
      '@media(max-width:700px){.owl-plus-body{grid-template-columns:1fr}.owl-plus-panel.explorer{min-height:180px}.owl-plus-panel.editor{min-height:360px}.owl-plus.preview{min-height:300px}.owl-plus{width:100%;height:100%;border-radius:14px}.owl-plus-trigger{right:10px;bottom:10px}}';
    document.head.appendChild(s);
  }

  function normalize(p) {
    return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '');
  }
  function ext(p) {
    var m = String(p).match(/\.([^.]+)$/); return m ? m[1].toLowerCase() : '';
  }
  function isText(p) { return TEXT_RE.test(p); }
  function safeName(s) { return String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function toast(msg) {
    var t = document.querySelector('.toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(function(){ t.classList.remove('show'); }, 1800);
      return;
    }
    alert(msg);
  }

  function openDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise(function(resolve){
      var req = indexedDB.open('owl-power-workspace', 1);
      req.onupgradeneeded = function(){
        var db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', {keyPath:'id'});
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', {keyPath:'id'});
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ resolve(null); };
    });
  }
  function dbGet(store, key) {
    if (!state.db) return Promise.resolve(null);
    return new Promise(function(resolve){
      var r = state.db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = function(){ resolve(r.result || null); };
      r.onerror = function(){ resolve(null); };
    });
  }
  function dbPut(store, value) {
    if (!state.db) return Promise.resolve(false);
    return new Promise(function(resolve){
      var tx = state.db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = function(){ resolve(true); };
      tx.onerror = function(){ resolve(false); };
    });
  }

  function b64ToBytes(s) {
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i=0;i<raw.length;i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function hexToBytes(s) {
    var out = new Uint8Array((s.match(/.{1,2}/g) || []).length);
    (s.match(/.{1,2}/g) || []).forEach(function(x,i){ out[i] = parseInt(x,16); });
    return out;
  }
  async function decrypt(env, password) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey(
      {name:'PBKDF2', salt:hexToBytes(env.salt), iterations:env.iterations, hash:'SHA-256'},
      base,
      {name:'AES-GCM', length:256},
      false,
      ['decrypt']
    );
    var data = b64ToBytes(env.data), tag = b64ToBytes(env.tag), full = new Uint8Array(data.length + tag.length);
    full.set(data,0); full.set(tag,data.length);
    return new Uint8Array(await crypto.subtle.decrypt(
      {name:'AES-GCM', iv:b64ToBytes(env.iv), additionalData:new TextEncoder().encode(env.aad || ''), tagLength:128},
      key, full
    ));
  }

  async function json(url) {
    var r = await fetch(url, {cache:'no-store'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function snap() {
    return {
      files: Array.from(state.files.entries()).map(function(x){ return {name:x[0], data:Array.from(x[1])}; }),
      folders: Array.from(state.folders)
    };
  }
  function restore(s) {
    state.files = new Map();
    state.folders = new Set((s && s.folders) || []);
    (s && s.files || []).forEach(function(f){ state.files.set(f.name, new Uint8Array(f.data)); });
  }
  function pushHistory() {
    state.history.push(snap());
    if (state.history.length > 30) state.history.shift();
    state.future = [];
  }
  function undo() {
    if (!state.history.length) return;
    state.future.push(snap());
    restore(state.history.pop());
    renderExplorer();
    selectFile(state.active);
    saveProject();
  }
  function redo() {
    if (!state.future.length) return;
    state.history.push(snap());
    restore(state.future.pop());
    renderExplorer();
    selectFile(state.active);
    saveProject();
  }

  function buildUi() {
    css();
    var trigger = el('button', {class:'owl-plus-trigger', type:'button', text:'⚙ Power Workspace'});
    document.body.appendChild(trigger);

    var login = el('div', {class:'owl-plus-login owl-plus-hidden'});
    login.innerHTML =
      '<div class="owl-plus-login-card">' +
      '<div class="owl-plus-badge">STUDENT IDE · LOCAL-FIRST</div>' +
      '<h2>Open Power Workspace</h2>' +
      '<p>Use the same class password used by the mentor library. The password remains in memory and is never stored.</p>' +
      '<form id="owl-plus-login-form"><div class="owl-plus-row"><input id="owl-plus-password" class="owl-plus-input" type="password" minlength="4" required placeholder="Class password" style="flex:1;height:40px"><button class="owl-plus-btn primary" type="submit">Unlock</button><button id="owl-plus-login-close" class="owl-plus-btn" type="button">Cancel</button></div><div id="owl-plus-error" class="owl-plus-muted" style="margin-top:8px"></div></form>' +
      '</div>';
    document.body.appendChild(login);

    var back = el('div', {class:'owl-plus-backdrop owl-plus-hidden'});
    back.innerHTML =
      '<div class="owl-plus">' +
      '<header class="owl-plus-head"><div><strong>Obaid Web Lab · Power Workspace</strong><div class="owl-plus-muted">Real project files · local autosave · live preview</div></div>' +
      '<div class="owl-plus-actions"><select id="owl-plus-class" class="owl-plus-select"></select><button id="owl-plus-save" class="owl-plus-btn">Save</button><button id="owl-plus-zip" class="owl-plus-btn primary">Download ZIP</button><button id="owl-plus-close" class="owl-plus-btn owl-plus-close">×</button></div></header>' +
      '<div class="owl-plus-body">' +
      '<aside class="owl-plus-panel explorer"><div class="owl-plus-toolbar"><button id="owl-plus-newfile" class="owl-plus-btn">＋ File</button><button id="owl-plus-newfolder" class="owl-plus-btn">＋ Folder</button><label class="owl-plus-btn">⇧ Upload<input id="owl-plus-upload" type="file" multiple hidden></label><button id="owl-plus-rename" class="owl-plus-btn">Rename</button><button id="owl-plus-delete" class="owl-plus-btn danger">Delete</button></div>' +
      '<div class="owl-plus-filefilter"><input id="owl-plus-filter" class="owl-plus-input" style="width:100%" placeholder="Filter files…"></div><div id="owl-plus-files" class="owl-plus-files"></div>' +
      '<div class="owl-plus-file-actions"><button id="owl-plus-undo" class="owl-plus-btn">Undo</button><button id="owl-plus-redo" class="owl-plus-btn">Redo</button><span id="owl-plus-count" class="owl-plus-muted"></span></div>' +
      '<div class="owl-plus-tasks" id="owl-plus-tasks"></div></aside>' +
      '<section class="owl-plus-panel editor"><div class="owl-plus-editor-wrap"><div class="owl-plus-editor-top"><span id="owl-plus-active">Select a text file</span><span id="owl-plus-save-state" class="owl-plus-muted">Ready</span></div><textarea id="owl-plus-code" class="owl-plus-code" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea><div class="owl-plus-status" id="owl-plus-status">0 files</div></div></section>' +
      '<section class="owl-plus-panel preview"><div class="owl-plus-preview-head">Live preview</div><iframe id="owl-plus-frame" class="owl-plus-frame" sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe></section>' +
      '</div></div>';
    document.body.appendChild(back);

    return {
      trigger: trigger, login: login, back: back,
      loginForm: login.querySelector('#owl-plus-login-form'),
      password: login.querySelector('#owl-plus-password'),
      loginError: login.querySelector('#owl-plus-error'),
      classSelect: back.querySelector('#owl-plus-class'),
      save: back.querySelector('#owl-plus-save'),
      zip: back.querySelector('#owl-plus-zip'),
      close: back.querySelector('#owl-plus-close'),
      newFile: back.querySelector('#owl-plus-newfile'),
      newFolder: back.querySelector('#owl-plus-newfolder'),
      upload: back.querySelector('#owl-plus-upload'),
      rename: back.querySelector('#owl-plus-rename'),
      del: back.querySelector('#owl-plus-delete'),
      filter: back.querySelector('#owl-plus-filter'),
      files: back.querySelector('#owl-plus-files'),
      undo: back.querySelector('#owl-plus-undo'),
      redo: back.querySelector('#owl-plus-redo'),
      count: back.querySelector('#owl-plus-count'),
      active: back.querySelector('#owl-plus-active'),
      saveState: back.querySelector('#owl-plus-save-state'),
      code: back.querySelector('#owl-plus-code'),
      status: back.querySelector('#owl-plus-status'),
      frame: back.querySelector('#owl-plus-frame'),
      tasks: back.querySelector('#owl-plus-tasks')
    };
  }

  var ui = buildUi();

  function showLogin() {
    ui.login.classList.remove('owl-plus-hidden');
    ui.password.focus();
  }
  function hideLogin() { ui.login.classList.add('owl-plus-hidden'); }
  function showWorkspace() { ui.back.classList.remove('owl-plus-hidden'); renderClasses(); }
  function hideWorkspace() { ui.back.classList.add('owl-plus-hidden'); }

  async function unlock(password) {
    var env = await json('./data/catalog.enc.json');
    var bytes = await decrypt(env, password);
    var cat = JSON.parse(new TextDecoder().decode(bytes));
    if (!cat || !Array.isArray(cat.classes)) throw new Error('Invalid catalog');
    state.catalog = cat;
    state.password = password;
    state.unlocked = true;
  }

  function renderClasses() {
    ui.classSelect.innerHTML = state.catalog.classes.map(function(c){
      return '<option value="' + esc(c.id) + '">' + esc(c.title) + '</option>';
    }).join('');
    if (state.catalog.classes.length) loadClass(state.catalog.classes[0].id);
  }

  async function loadClass(id) {
    var meta = state.catalog.classes.find(function(x){ return x.id === id; });
    if (!meta) return;
    state.current = meta;
    state.history=[]; state.future=[]; state.active=''; state.selected='';
    var env = await json(meta.resource);
    var bytes = await decrypt(env, state.password);
    var zip = await JSZip.loadAsync(bytes);
    state.files = new Map(); state.folders = new Set();
    for (var key in zip.files) {
      if (!Object.prototype.hasOwnProperty.call(zip.files,key)) continue;
      var f = zip.files[key], p = normalize(key);
      if (!p) continue;
      if (f.dir) state.folders.add(p);
      else state.files.set(p, await f.async('uint8array'));
    }
    var saved = await dbGet('projects', meta.id);
    if (saved && saved.files && saved.files.length) {
      restore(saved);
      ui.saveState.textContent = 'Restored local edits';
    }
    renderExplorer();
    renderTasks();
    var first = state.files.has('index.html') ? 'index.html' : Array.from(state.files.keys()).find(function(x){ return /\.html?$/i.test(x); }) || Array.from(state.files.keys())[0];
    if (first) selectFile(first);
  }

  ui.classSelect.addEventListener('change', function(){ loadClass(ui.classSelect.value); });

  function visibleNames() {
    var q = ui.filter.value.trim().toLowerCase();
    return Array.from(state.files.keys()).filter(function(n){ return !q || n.toLowerCase().includes(q); }).sort(function(a,b){
      var ai=/^index\.html?$/i.test(a)?-2:/\.html?$/i.test(a)?0:/\.css$/i.test(a)?1:2;
      var bi=/^index\.html?$/i.test(b)?-2:/\.html?$/i.test(b)?0:/\.css$/i.test(b)?1:2;
      return ai-bi || a.localeCompare(b);
    });
  }

  function renderExplorer() {
    var names = visibleNames();
    ui.files.innerHTML = names.map(function(n){
      return '<button class="owl-plus-file ' + (n === state.active ? 'active' : '') + '" data-file="' + esc(n) + '" type="button"><span>' + (/\.(html?|css)$/i.test(n) ? '◇' : '·') + '</span><span>' + esc(n) + '</span></button>';
    }).join('');
    ui.count.textContent = state.files.size + ' files';
    ui.status.textContent = state.files.size + ' files · ' + state.folders.size + ' folders';
    Array.prototype.forEach.call(ui.files.querySelectorAll('[data-file]'), function(b){
      b.addEventListener('click', function(){ selectFile(b.getAttribute('data-file')); });
    });
  }

  function selectedPath() { return state.selected || state.active; }
  function textFor(p) { var b=state.files.get(p); return b ? new TextDecoder().decode(b) : ''; }

  function selectFile(p) {
    if (!p || !state.files.has(p)) return;
    state.active = p; state.selected = p;
    renderExplorer();
    ui.active.textContent = p;
    if (!isText(p)) {
      ui.code.value = 'Binary/asset file. File operations and ZIP export remain available.';
      ui.code.readOnly = true;
      ui.saveState.textContent = 'Binary file';
      updatePreview();
      return;
    }
    ui.code.readOnly = false;
    ui.code.value = textFor(p);
    ui.saveState.textContent = 'Saved';
    updatePreview();
    ui.code.focus();
  }

  function saveProject() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(async function(){
      if (!state.current) return;
      var payload = {
        id: state.current.id,
        files: Array.from(state.files.entries()).map(function(x){return {name:x[0],data:Array.from(x[1])};}),
        folders: Array.from(state.folders)
      };
      var ok = await dbPut('projects', payload);
      ui.saveState.textContent = ok ? 'Autosaved locally' : 'Session saved';
    }, 700);
  }

  ui.code.addEventListener('input', function(){
    if (!state.active || !isText(state.active) || ui.code.readOnly) return;
    pushHistory();
    state.files.set(state.active, new TextEncoder().encode(ui.code.value));
    ui.saveState.textContent='Unsaved';
    saveProject();
    updatePreview();
  });

  function parentFolders(p) {
    var parts = p.split('/');
    for (var i=1;i<parts.length;i++) state.folders.add(parts.slice(0,i).join('/'));
  }

  function newFile() {
    var p = normalize(prompt('New file path', 'components/new.html'));
    if (!p) return;
    if (state.files.has(p)) return toast('A file with that name already exists.');
    pushHistory();
    state.files.set(p, new TextEncoder().encode(ext(p)==='html' ? '<!doctype html>\\n<html lang="en">\\n<head>\\n<meta charset="UTF-8">\\n<meta name="viewport" content="width=device-width,initial-scale=1">\\n<title>New page</title>\\n</head>\\n<body>\\n<h1>Start building</h1>\\n</body>\\n</html>\\n' : ext(p)==='css' ? 'body {\\n  margin: 0;\\n}\\n' : ''));
    parentFolders(p);
    renderExplorer(); selectFile(p); saveProject(); toast('File created.');
  }
  function newFolder() {
    var p=normalize(prompt('New folder path','components'));
    if(!p) return;
    if (state.folders.has(p)) return toast('That folder already exists.');
    pushHistory(); state.folders.add(p); renderExplorer(); saveProject(); toast('Folder created.');
  }
  async function upload(files) {
    var arr=Array.from(files||[]); if(!arr.length)return;
    pushHistory();
    for (var i=0;i<arr.length;i++) {
      var f=arr[i], p=normalize(f.webkitRelativePath || f.name);
      if(!p)continue;
      parentFolders(p);
      state.files.set(p,new Uint8Array(await f.arrayBuffer()));
    }
    renderExplorer(); saveProject(); toast(arr.length + ' file' + (arr.length===1?'':'s') + ' added.');
  }
  function renameItem() {
    var p=selectedPath(); if(!p)return toast('Select a file first.');
    var n=normalize(prompt('New file name', p.split('/').pop())); if(!n)return;
    var np=p.indexOf('/')>=0 ? p.slice(0,p.lastIndexOf('/')+1)+n : n;
    if(state.files.has(np))return toast('That name already exists.');
    pushHistory(); state.files.set(np,state.files.get(p)); state.files.delete(p); state.active=np; state.selected=np;
    renderExplorer(); selectFile(np); saveProject(); toast('Renamed.');
  }
  function deleteItem() {
    var p=selectedPath(); if(!p)return toast('Select a file first.');
    if(!confirm('Delete ' + p + '?'))return;
    pushHistory(); state.files.delete(p); state.active=''; state.selected='';
    renderExplorer(); ui.code.value=''; ui.active.textContent='Select a text file'; updatePreview(); saveProject(); toast('Deleted.');
  }

  ui.newFile.addEventListener('click', newFile);
  ui.newFolder.addEventListener('click', newFolder);
  ui.upload.addEventListener('change', function(){ upload(ui.upload.files); ui.upload.value=''; });
  ui.rename.addEventListener('click', renameItem);
  ui.del.addEventListener('click', deleteItem);
  ui.filter.addEventListener('input', renderExplorer);
  ui.undo.addEventListener('click', undo);
  ui.redo.addEventListener('click', redo);
  ui.save.addEventListener('click', function(){ saveProject(); toast('Save queued.'); });

  function resolve(base, target) {
    if (!target || /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) return null;
    var parts=(base.includes('/') ? base.slice(0,base.lastIndexOf('/')+1) : '').split('/').filter(Boolean);
    target.replace(/^\.?\//,'').split('/').forEach(function(p){
      if (!p || p==='.') return;
      if (p==='..') parts.pop(); else parts.push(p);
    });
    return normalize(parts.join('/'));
  }
  function dataUrl(p) {
    var b=state.files.get(normalize(p)); if(!b)return null;
    var m={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml'}[ext(p)]||'application/octet-stream';
    var bin=''; for(var i=0;i<b.length;i+=32768) bin+=String.fromCharCode.apply(null,b.subarray(i,i+32768));
    return 'data:'+m+';base64,'+btoa(bin);
  }
  function updatePreview() {
    var htmlName=state.files.has('index.html')?'index.html':Array.from(state.files.keys()).find(function(n){return /\.html?$/i.test(n);});
    if(!htmlName){ ui.frame.srcdoc=''; return; }
    var html=textFor(htmlName);
    try {
      var doc=new DOMParser().parseFromString(html,'text/html');
      Array.prototype.forEach.call(doc.querySelectorAll('link[rel~="stylesheet"][href]'),function(link){
        var p=resolve(htmlName,link.getAttribute('href')), b=state.files.get(p);
        if(b){var st=doc.createElement('style');st.textContent=new TextDecoder().decode(b);link.replaceWith(st);}
      });
      Array.prototype.forEach.call(doc.querySelectorAll('script[src]'),function(sc){
        var p=resolve(htmlName,sc.getAttribute('src')), b=state.files.get(p);
        if(b){var ns=doc.createElement('script');ns.textContent=new TextDecoder().decode(b);sc.replaceWith(ns);}
      });
      Array.prototype.forEach.call(doc.querySelectorAll('[src],[href]'),function(node){
        ['src','href'].forEach(function(a){
          var v=node.getAttribute(a); if(!v || /^(?:https?:|data:|#|mailto:|tel:|\/\/)/i.test(v)) return;
          var p=resolve(htmlName,v), d=p&&dataUrl(p); if(d && /^(?:IMG|SOURCE|VIDEO|AUDIO)$/i.test(node.tagName)) node.setAttribute(a,d);
        });
      });
      ui.frame.srcdoc='<!doctype html>\\n'+doc.documentElement.outerHTML;
    } catch(e) { ui.frame.srcdoc=html; }
  }

  async function downloadZip() {
    if (!window.JSZip) return toast('ZIP engine is unavailable.');
    var z=new JSZip();
    state.folders.forEach(function(f){z.folder(f);});
    state.files.forEach(function(b,n){z.file(n,isText(n)?textFor(n):b);});
    var blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    var a=document.createElement('a'), u=URL.createObjectURL(blob);
    a.href=u; a.download=safeName(state.current.title)+'-workspace.zip'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(u);},4000);
    toast('Workspace ZIP ready.');
  }
  ui.zip.addEventListener('click', downloadZip);

  function renderTasks() {
    var tasks=state.current && state.current.homework && Array.isArray(state.current.homework.tasks) ? state.current.homework.tasks : [];
    if (!tasks.length) { ui.tasks.innerHTML=''; return; }
    ui.tasks.innerHTML='<div class="owl-plus-muted" style="margin:3px 0 7px">Homework</div>'+tasks.map(function(t,i){
      var title=typeof t==='string'?t:(t.title||('Task '+(i+1)));
      return '<label class="owl-plus-task"><input type="checkbox" data-owl-task="'+i+'"><span>'+esc(title)+'</span></label>';
    }).join('');
    Array.prototype.forEach.call(ui.tasks.querySelectorAll('[data-owl-task]'),function(x){
      x.checked=localStorage.getItem('owlplus:task:'+state.current.id+':'+x.getAttribute('data-owl-task'))==='1';
      x.addEventListener('change',function(){localStorage.setItem('owlplus:task:'+state.current.id+':'+x.getAttribute('data-owl-task'),x.checked?'1':'0');});
    });
  }

  ui.loginForm.addEventListener('submit', async function(e){
    e.preventDefault();
    ui.loginError.textContent='Unlocking…';
    try {
      if (!window.JSZip) throw new Error('ZIP engine unavailable');
      await unlock(ui.password.value.trim());
      ui.password.value='';
      hideLogin();
      showWorkspace();
      ui.loginError.textContent='';
    } catch(err) {
      console.error(err);
      ui.loginError.textContent='Password or encrypted catalog is invalid.';
    }
  });
  ui.trigger.addEventListener('click', function(){ state.unlocked ? showWorkspace() : showLogin(); });
  ui.back.addEventListener('click', function(e){ if(e.target===ui.back) hideWorkspace(); });
  ui.close.addEventListener('click', hideWorkspace);
  ui.login.querySelector('#owl-plus-login-close').addEventListener('click', function(){ hideLogin(); });

  openDb().then(function(db){ state.db=db; });

  window.OwlPowerWorkspace = {
    open: function(){ state.unlocked ? showWorkspace() : showLogin(); },
    close: hideWorkspace
  };
})();