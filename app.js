/* Obaidul Mentor Lab - resilient browser learning workspace */
(() => {
  'use strict';

  const state = {
    catalog: null,
    site: null,
    password: null,
    current: null,
    monaco: null,
    editor: null,
    models: new Map(),
    files: new Map(),
    originalZip: null,
    saveTimer: null,
    previewTimer: null,
    autoCheckTimer: null,
    selectionToken: 0,
    hintIndex: 0,
    pending: null,
    dark: true,
    smartSuggestions: [],
    smartSuggestionIndex: 0,
    smartSuggestionVisible: false,
    monacoProvidersInstalled: false,
    memoryStore: new Map(),
    previewFile: null,
    activeTopicId: null,
    monacoPromise: null
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const els = {
    year: $('#year'), toast: $('#toast'), heroAccess: $('#hero-access'), lock: $('#lock-button'),
    classGrid: $('#class-grid'), blogGrid: $('#blog-grid'), classSearch: $('#class-search'), blogSearch: $('#blog-search'),
    workspaceTitle: $('#workspace-title'), workspaceSubtitle: $('#workspace-subtitle'), fileList: $('#file-list'), fileCount: $('#file-count'), topicNav: $('#topic-nav'), topicCount: $('#topic-count'),
    editor: $('#editor'), fallback: $('#fallback-editor'), fallbackSuggest: $('#fallback-suggest'), activeFile: $('#active-file'), saveState: $('#save-state'),
    preview: $('#preview-frame'), refreshPreview: $('#refresh-preview'), openPreview: $('#open-preview'), format: $('#format-code'),
    originalZip: $('#download-original'), editedZip: $('#download-edited'), taskList: $('#task-list'), taskProgress: $('#task-progress-label'),
    taskProgressHint: $('#task-progress-hint'), checkAll: $('#check-all'), progressRing: $('#class-progress-ring'), progressPercent: $('#class-progress-percent'), progressStatus: $('#progress-status'),
    hintBox: $('#hint-box'), nextHint: $('#next-hint'), unlockForm: $('#unlock-form'), password: $('#access-password'), unlockError: $('#unlock-error'),
    article: $('#article-content'), articleBack: $('#article-back'), theme: $('#theme-toggle'), portfolioHeader: $('#portfolio-link-header'), portfolioFooter: $('#portfolio-link-footer')
  };

  els.year.textContent = new Date().getFullYear();

  const HTML_SUGGESTIONS = [
    {label:'! + Tab', detail:'HTML document skeleton', insertText:'<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  $0\n</body>\n</html>'},
    {label:'div', detail:'Block container', insertText:'<div>$0</div>'},
    {label:'section', detail:'Semantic section', insertText:'<section>$0</section>'},
    {label:'header', detail:'Semantic header', insertText:'<header>$0</header>'},
    {label:'main', detail:'Main content', insertText:'<main>$0</main>'},
    {label:'article', detail:'Standalone content', insertText:'<article>$0</article>'},
    {label:'nav', detail:'Navigation region', insertText:'<nav>$0</nav>'},
    {label:'form', detail:'HTML form', insertText:'<form action="#" method="post">\n  $0\n</form>'},
    {label:'label', detail:'Form label', insertText:'<label for="$1">$0</label>'},
    {label:'input', detail:'Form input', insertText:'<input id="$1" name="$2" type="$3" $0>'},
    {label:'button', detail:'Button control', insertText:'<button type="button">$0</button>'},
    {label:'a', detail:'Link', insertText:'<a href="$1">$0</a>'},
    {label:'img', detail:'Image', insertText:'<img src="$1" alt="$0">'}
  ];
  const CSS_SUGGESTIONS = [
    {label:'display', detail:'Layout display mode', insertText:'display: $0;'},
    {label:'position', detail:'Positioning', insertText:'position: $0;'},
    {label:'margin', detail:'Outer spacing', insertText:'margin: $0;'},
    {label:'padding', detail:'Inner spacing', insertText:'padding: $0;'},
    {label:'width', detail:'Element width', insertText:'width: $0;'},
    {label:'max-width', detail:'Maximum width', insertText:'max-width: $0;'},
    {label:'height', detail:'Element height', insertText:'height: $0;'},
    {label:'color', detail:'Text color', insertText:'color: $0;'},
    {label:'background', detail:'Background shorthand', insertText:'background: $0;'},
    {label:'background-color', detail:'Background color', insertText:'background-color: $0;'},
    {label:'border', detail:'Border shorthand', insertText:'border: $0;'},
    {label:'border-radius', detail:'Rounded corners', insertText:'border-radius: $0;'},
    {label:'box-shadow', detail:'Shadow', insertText:'box-shadow: $0;'},
    {label:'font-size', detail:'Text size', insertText:'font-size: $0;'},
    {label:'font-weight', detail:'Text weight', insertText:'font-weight: $0;'},
    {label:'line-height', detail:'Text line height', insertText:'line-height: $0;'},
    {label:'gap', detail:'Flex/grid gap', insertText:'gap: $0;'},
    {label:'grid-template-columns', detail:'Grid columns', insertText:'grid-template-columns: $0;'},
    {label:'justify-content', detail:'Main-axis alignment', insertText:'justify-content: $0;'},
    {label:'align-items', detail:'Cross-axis alignment', insertText:'align-items: $0;'},
    {label:'transition', detail:'Smooth interaction', insertText:'transition: $0;'},
    {label:'transform', detail:'Visual transform', insertText:'transform: $0;'},
    {label:'opacity', detail:'Element opacity', insertText:'opacity: $0;'}
  ];

  function toast(msg, duration = 2200) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => els.toast.classList.remove('show'), duration);
  }

  function safeGet(key) { try { const v=localStorage.getItem(key); if(v!==null) return v; } catch {} return state.memoryStore.has(key) ? state.memoryStore.get(key) : null; }
  function safeSet(key, value) { state.memoryStore.set(key, String(value)); try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function safeRemove(key) { state.memoryStore.delete(key); try { localStorage.removeItem(key); } catch {} }

  state.dark = safeGet('oml:theme') !== 'light';

  function setTheme() {
    document.body.classList.toggle('light', !state.dark);
    els.theme.textContent = state.dark ? '☼' : '☾';
    els.theme.setAttribute('aria-label', state.dark ? 'Switch to light theme' : 'Switch to dark theme');
    els.theme.setAttribute('title', state.dark ? 'Switch to light theme' : 'Switch to dark theme');
    safeSet('oml:theme', state.dark ? 'dark' : 'light');
    if (state.monaco) state.monaco.editor.setTheme(state.dark ? 'vs-dark' : 'vs');
  }
  setTheme();
  els.theme.addEventListener('click', () => { state.dark = !state.dark; setTheme(); });

  function showView(name, shouldScroll = true) {
    $$('.view').forEach(v => v.classList.toggle('active-view', v.dataset.view === name));
    $$('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
    if (shouldScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function rememberPending(target, id = null) { state.pending = { target, id }; }

  function route() {
    const rawHash = location.hash.replace(/^#/, '');
    const [name, id] = rawHash.split('/');
    const query = new URLSearchParams(location.search);
    const classId = query.get('class');
    const blogId = query.get('blog');

    if (!state.catalog) {
      if (name === 'classes' || name === 'blogs' || name === 'workspace' || name === 'article') rememberPending(name === 'article' ? 'blogs' : name, id || classId || blogId);
      else if (classId) rememberPending('classes', classId);
      else if (blogId) rememberPending('blogs', blogId);
      else { showView('home'); return; }
      showView('login');
      return;
    }

    if (classId && !state.current) { openClass(classId); return; }
    if (blogId) { openArticle(blogId); return; }
    if (name === 'classes') { showView('classes'); return; }
    if (name === 'blogs') { showView('blogs'); return; }
    if (name === 'workspace') { state.current ? showView('workspace') : (rememberPending('workspace'), showView('login')); return; }
    if (name === 'article' && id) { openArticle(decodeURIComponent(id)); return; }
    showView('home');
  }

  window.addEventListener('hashchange', route);
  $$('[data-route]').forEach(a => a.addEventListener('click', e => {
    const r = a.dataset.route;
    if (r === 'home') return;
    e.preventDefault();
    requireUnlock(r);
  }));

  function requireUnlock(target) {
    if (state.catalog) { location.hash = target; return; }
    rememberPending(target);
    showView('login');
    requestAnimationFrame(() => els.password.focus());
  }

  els.heroAccess.addEventListener('click', () => requireUnlock('classes'));
  els.lock.addEventListener('click', () => {
    state.catalog = null;
    state.password = null;
    state.current = null;
    state.files.clear();
    state.originalZip = null;
    destroyEditor();
    els.preview.srcdoc = '';
    els.lock.hidden = true;
    location.hash = 'home';
    showView('home');
    safeRemove('oml:last-unlock');
    toast('Library locked on this browser.');
  });

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function ensureZipLibrary() {
    if (window.JSZip) return true;
    const cdns = [
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
      'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
    ];
    for (const src of cdns) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });
        if (window.JSZip) return true;
      } catch {}
    }
    return false;
  }

  function hexToBytes(hex) { return new Uint8Array((hex.match(/.{1,2}/g) || []).map(b => parseInt(b, 16))); }
  function base64ToBytes(b64) { const s = atob(b64); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  async function deriveKey(password, envelope) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt:hexToBytes(envelope.salt), iterations:envelope.iterations, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['decrypt']);
  }
  async function decryptEnvelope(envelope, password) {
    const key = await deriveKey(password, envelope);
    const iv = base64ToBytes(envelope.iv), tag = base64ToBytes(envelope.tag), data = base64ToBytes(envelope.data);
    const full = new Uint8Array(data.length + tag.length); full.set(data); full.set(tag, data.length);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv, tagLength:128, additionalData:new TextEncoder().encode(envelope.aad || '') }, key, full);
    return new Uint8Array(plain);
  }
  const bytesToText = (bytes) => new TextDecoder().decode(bytes);

  els.unlockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.unlockError.textContent = 'Checking…';
    try {
      if (!(await ensureZipLibrary())) throw new Error('ZIP library unavailable');
      const envelope = await loadJson('./data/catalog.enc.json');
      const plain = await decryptEnvelope(envelope, els.password.value);
      const catalog = JSON.parse(bytesToText(plain));
      if (!catalog || !Array.isArray(catalog.classes) || !Array.isArray(catalog.blogs)) throw new Error('Invalid catalog');
      state.password = els.password.value;
      state.catalog = catalog;
      els.password.value = '';
      els.unlockError.textContent = '';
      els.lock.hidden = false;
      safeSet('oml:last-unlock', '1');
      renderCatalog();
      toast('Student library unlocked.');
      const pending = state.pending;
      state.pending = null;
      if (pending?.id && pending.target === 'classes') await openClass(pending.id);
      else if (pending?.id && pending.target === 'blogs') await openArticle(pending.id);
      else showView(pending?.target || 'classes');
    } catch (err) {
      console.error(err);
      els.unlockError.textContent = 'That password did not unlock the student library.';
      els.password.select();
    }
  });

  async function loadSiteInfo() {
    try {
      state.site = await loadJson('./data/site.json');
      const brand = state.site.brand || {};
      document.title = brand.name || document.title;
      if (els.portfolioHeader) {
        if (brand.portfolioUrl) { els.portfolioHeader.href = brand.portfolioUrl; els.portfolioHeader.textContent = `${brand.portfolioLabel || 'Portfolio'} ↗`; els.portfolioHeader.hidden = false; }
        else els.portfolioHeader.hidden = true;
      }
      if (els.portfolioFooter) {
        if (brand.portfolioUrl) { els.portfolioFooter.href = brand.portfolioUrl; els.portfolioFooter.textContent = `${brand.portfolioLabel || 'Portfolio'} ↗`; els.portfolioFooter.hidden = false; }
        else els.portfolioFooter.hidden = true;
      }
    } catch (err) { console.warn('Site branding could not be loaded', err); }
  }

  function renderCatalog() { renderClasses(); renderBlogs(); }
  function card(item, type) {
    const tags = (item.tags || []).slice(0, 4).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('');
    const action = type === 'class' ? `open-class="${escapeAttr(item.id)}"` : `open-blog="${escapeAttr(item.id)}"`;
    const download = type === 'class' ? `<button class="tiny-btn card-download-btn" download-class="${escapeAttr(item.id)}" type="button" aria-label="Download ${escapeAttr(item.title)} as ZIP">Download ZIP ↓</button>` : '';
    const parts = type === 'class' && Array.isArray(item.subclasses) && item.subclasses.length ? `<span class="badge badge-accent">${item.subclasses.length} learning parts</span>` : '';
    return `<article class="content-card"><div><div class="badge-row">${parts}${tags || `<span class="badge">${type}</span>`}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.summary || '')}</p></div><div class="card-meta"><span>${escapeHtml(item.level || 'All levels')}</span><div class="card-actions">${download}<button class="tiny-btn" ${action} type="button">${type === 'class' ? 'Open class' : 'Read article'} →</button></div></div></article>`;
  }
  function renderClasses() {
    const q = els.classSearch.value.trim().toLowerCase();
    const list = (state.catalog?.classes || []).filter(x => `${x.title} ${x.description} ${(x.tags || []).join(' ')}`.toLowerCase().includes(q));
    els.classGrid.innerHTML = list.map(x => card(x, 'class')).join('');
    $('#classes-empty').hidden = list.length > 0;
    $$('[open-class]').forEach(b => b.addEventListener('click', () => openClass(b.getAttribute('open-class'))));
    $$('[download-class]').forEach(b => b.addEventListener('click', () => downloadClassFromCard(b.getAttribute('download-class'), b)));
  }

  async function downloadClassFromCard(id, button) {
    if (!state.catalog || !state.password) { rememberPending('classes', id); showView('login'); return; }
    const meta = state.catalog.classes.find(x => x.id === id);
    if (!meta) { toast('Class not found.'); return; }
    const originalLabel = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Preparing…'; }
    try {
      const env = await loadJson(meta.resource);
      const zipBytes = await decryptEnvelope(env, state.password);
      const blob = new Blob([zipBytes], { type: 'application/zip' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${safeFileName(meta.title)}-provided.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2500);
      toast('Class ZIP ready.');
    } catch (err) {
      console.error(err);
      toast('This class ZIP could not be downloaded.');
    } finally {
      if (button) { button.disabled = false; button.textContent = originalLabel || 'Download ZIP ↓'; }
    }
  }
  function renderBlogs() {
    const q = els.blogSearch.value.trim().toLowerCase();
    const list = (state.catalog?.blogs || []).filter(x => `${x.title} ${x.description} ${(x.tags || []).join(' ')}`.toLowerCase().includes(q));
    els.blogGrid.innerHTML = list.map(x => card(x, 'blog')).join('');
    $('#blogs-empty').hidden = list.length > 0;
    $$('[open-blog]').forEach(b => b.addEventListener('click', () => openArticle(b.getAttribute('open-blog'))));
  }
  els.classSearch.addEventListener('input', renderClasses);
  els.blogSearch.addEventListener('input', renderBlogs);

  function normalizePath(p) {
    return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  }
  function textFile(n) { return /\.(html?|css|md|txt|json)$/i.test(n); }
  function safeZipFileName(n) { return normalizePath(n).split('/').some(part => part === '..') ? null : normalizePath(n); }
  function resolveVirtualPath(baseFile, target) {
    const raw = String(target || '').trim();
    if (!raw || /^(?:[a-z][a-z0-9+.-]*:|#|data:|blob:|\/\/)/i.test(raw)) return null;
    let clean = raw.split('#')[0].split('?')[0].trim();
    if (!clean) return null;
    try { clean = decodeURIComponent(clean); } catch {}
    const rootRelative = clean.startsWith('/');
    const baseParts = rootRelative ? [] : normalizePath(baseFile).split('/').slice(0, -1);
    for (const part of clean.replace(/^\/+/, '').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!baseParts.length) return null;
        baseParts.pop();
      } else {
        baseParts.push(part);
      }
    }
    const out = normalizePath(baseParts.join('/'));
    return out && !out.startsWith('../') ? out : null;
  }
  function findVirtualFile(path) {
    const normalized = normalizePath(path);
    if (state.files.has(normalized)) return normalized;
    const lower = normalized.toLowerCase();
    for (const name of state.files.keys()) if (name.toLowerCase() === lower) return name;
    return null;
  }

  function topicNodes(meta = state.current?.meta) { return Array.isArray(meta?.subclasses) ? meta.subclasses : []; }
  function topicList(nodes = topicNodes()) { const out=[]; const walk=(items,depth=0)=>{ for(const n of items||[]){out.push({node:n,depth}); walk(n.subclasses||[],depth+1);} }; walk(nodes); return out; }
  function findTopic(id,nodes=topicNodes()){for(const n of nodes){if(n.id===id)return n;const found=findTopic(id,n.subclasses||[]);if(found)return found;}return null;}
  function activeTopic(){return findTopic(state.activeTopicId);}
  function topicPath(node){return normalizePath(node?.path||'');}
  function visibleFiles(){const topic=activeTopic();if(!topic)return [...state.files.keys()];const prefix=topicPath(topic);if(!prefix)return [...state.files.keys()];const full=`${prefix}/`;return [...state.files.keys()].filter(name=>name===prefix||name.startsWith(full));}
  function topicTaskScope(){return state.activeTopicId?`${state.current?.meta?.id}:topic:${state.activeTopicId}`:`${state.current?.meta?.id}:overview`;}
  function renderCurriculum(){if(!els.topicNav)return;const topics=topicList();if(!topics.length){els.topicNav.innerHTML='';els.topicNav.hidden=true;if(els.topicCount)els.topicCount.textContent='';return;}els.topicNav.hidden=false;if(els.topicCount)els.topicCount.textContent=`${topics.length} parts`;const all=`<button class="topic-item ${state.activeTopicId?'':'active'}" type="button" data-topic="__all"><span class="topic-index">•</span><span><strong>Class overview</strong><small>All materials & core tasks</small></span></button>`;const buttons=topics.map(({node,depth})=>`<button class="topic-item ${state.activeTopicId===node.id?'active':''}" style="--topic-depth:${depth}" type="button" data-topic="${escapeAttr(node.id)}"><span class="topic-index">${escapeHtml(String(node.rank??node.order??'•'))}</span><span><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.description||'Open this learning part')}</small></span></button>`).join('');els.topicNav.innerHTML=all+buttons;$$('[data-topic]').forEach(b=>b.addEventListener('click',()=>selectTopic(b.getAttribute('data-topic'))));}
  async function selectTopic(id){state.activeTopicId=id==='__all'?null:id;renderCurriculum();renderFileExplorer();renderTasks();renderHints();const names=visibleFiles().sort((a,b)=>fileSort(a)-fileSort(b));const first=names.find(n=>/^index\.html?$/i.test(n))||names.find(n=>/\.html?$/i.test(n))||names[0];if(first)await selectFile(first);els.fileCount.textContent=`${names.length} / ${state.files.size} files`;toast(state.activeTopicId?`Opened: ${activeTopic()?.title||'Learning part'}`:'Class overview opened.');}
  function renderFileExplorer(){if(!els.fileList)return;const names=visibleFiles().sort((a,b)=>fileSort(a)-fileSort(b));els.fileList.innerHTML='';names.forEach(name=>{const b=document.createElement('button');b.className='file-item';b.dataset.file=name;b.type='button';b.innerHTML=`<span>${fileIcon(name)}</span><span>${escapeHtml(name)}</span>`;b.addEventListener('click',()=>selectFile(name));els.fileList.appendChild(b);});els.fileCount.textContent=`${names.length}${names.length!==state.files.size?` / ${state.files.size}`:''} files`;}
  async function openClass(id) {
    if (!state.catalog) { rememberPending('classes', id); showView('login'); return; }
    const meta = state.catalog.classes.find(x => x.id === id);
    if (!meta) { toast('Class not found in the current catalog.'); return; }
    if (!(await ensureZipLibrary())) { toast('The ZIP engine could not load.'); return; }
    const token = ++state.selectionToken;
    toast('Opening class…');
    try {
      const env = await loadJson(meta.resource);
      const zipBytes = await decryptEnvelope(env, state.password);
      const zip = await JSZip.loadAsync(zipBytes);
      const files = new Map();
      for (const [rawName, f] of Object.entries(zip.files)) {
        if (f.dir) continue;
        const name = safeZipFileName(rawName);
        if (!name || name.startsWith('.git/') || name.includes('/node_modules/')) continue;
        files.set(name, await f.async('uint8array'));
      }
      if (token !== state.selectionToken) return;
      state.current = { meta, type:'class' };
      state.files = files;
      state.originalZip = zipBytes;
      state.previewFile = null;
      await openWorkspace();
      history.replaceState(null, '', `${location.pathname}#workspace`);
    } catch (err) {
      console.error(err);
      toast('This class could not be opened. Check the resource build and try again.');
    }
  }

  async function openWorkspace() {
    showView('workspace', false);
    els.workspaceTitle.textContent = state.current.meta.title;
    els.workspaceSubtitle.textContent = state.current.meta.description || '';
    state.activeTopicId = null;
    destroyEditor();
    renderCurriculum();
    renderFileExplorer();
    const names = visibleFiles().sort((a, b) => fileSort(a) - fileSort(b));
    const first = names.find(n => /\.html?$/i.test(n) && /^index\.html$/i.test(n)) || names.find(n => /\.(html?|css)$/i.test(n)) || names[0];
    if (first) { state.previewFile = /\.html?$/i.test(first) ? first : (names.find(n => /^index\.html?$/i.test(n)) || first); await selectFile(first); }
    renderTasks();
    renderHints();
    els.originalZip.disabled = false;
    els.editedZip.disabled = false;
    updatePreview();
  }

  function fileSort(a) { if (/^index\.html$/i.test(a)) return -10; if (/\.html?$/i.test(a)) return 0; if (/\.css$/i.test(a)) return 1; return 2; }
  function fileIcon(n) { if (/\.html?$/i.test(n)) return '◇'; if (/\.css$/i.test(n)) return '#'; if (/\.(png|jpg|jpeg|gif|svg|webp|avif)$/i.test(n)) return '▧'; return '·'; }
  function langFor(name) { if (/\.css$/i.test(name)) return 'css'; if (/\.json$/i.test(name)) return 'json'; if (/\.html?$/i.test(name)) return 'html'; return 'plaintext'; }

  function savedKey(classId, file) { return `oml:code:${classId}:${file}`; }
  function readSaved(classId, file) { return safeGet(savedKey(classId, file)); }
  function saveFile(classId, file, text) { return safeSet(savedKey(classId, file), text); }
  function getFileText(name) { const b = state.files.get(name); if (!b) return ''; const saved = readSaved(state.current.meta.id, name); return saved !== null ? saved : bytesToText(b); }
  function currentText() { if (!state.current) return ''; if (state.editor && !els.fallback.hidden && state.editor.getModel()) return state.editor.getValue(); return els.fallback.value; }

  async function selectFile(name) {
    const token = ++state.selectionToken;
    if (/\.html?$/i.test(name)) state.previewFile = name;
    $$('.file-item').forEach(b => b.classList.toggle('active', b.dataset.file === name));
    els.activeFile.textContent = name;
    if (!textFile(name)) {
      toggleFallback(true);
      els.fallback.value = 'Binary/asset file. Use the live preview or download it.';
      hideSmartSuggestions();
      updatePreviewDebounced();
      return;
    }
    const original = state.files.get(name);
    let text = bytesToText(original || new Uint8Array());
    const saved = readSaved(state.current.meta.id, name);
    if (saved !== null) text = saved;
    await setupEditor(name, text);
    if (token !== state.selectionToken) return;
    hideSmartSuggestions();
    schedulePreview(50);
  }

  function toggleFallback(on) {
    els.editor.style.display = on ? 'none' : '';
    els.fallback.hidden = !on;
    if (!on) hideSmartSuggestions();
  }

  function ensureMonaco() {
    if (state.monaco) return Promise.resolve(state.monaco);
    if (state.monacoPromise) return state.monacoPromise;
    const cdns = [
      'https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/min/vs',
      'https://unpkg.com/monaco-editor@0.56.0/min/vs'
    ];
    let activeBase = cdns[0];
    state.monacoPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value || null);
      };
      const timeout = setTimeout(() => finish(null), 6500);
      window.MonacoEnvironment = {
        getWorkerUrl() {
          const proxy = `self.MonacoEnvironment={baseUrl:'https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/min/'};importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/min/vs/base/worker/workerMain.js');`;
          return `data:text/javascript;charset=utf-8,${encodeURIComponent(proxy)}`;
        }
      };
      const tryLoader = (i) => {
        if (i >= cdns.length) { finish(null); return; }
        const loader = document.createElement('script');
        loader.src = `${cdns[i]}/loader.js`;
        loader.async = true;
        loader.onload = () => {
          try {
            window.require.config({ paths: { vs: cdns[i] } });
            window.require(['vs/editor/editor.main'], () => finish(window.monaco), () => tryLoader(i + 1));
          } catch {
            tryLoader(i + 1);
          }
        };
        loader.onerror = () => tryLoader(i + 1);
        document.head.appendChild(loader);
      };
      tryLoader(0);
    }).then((monaco) => {
      state.monaco = monaco;
      return monaco;
    });
    return state.monacoPromise;
  }

  async function setupEditor(name, text) {
    if (!state.monaco) {
      try { state.monaco = await ensureMonaco(); } catch { state.monaco = null; }
    }
    if (state.monaco) {
      installMonacoEnhancements(state.monaco);
      toggleFallback(false);
      const lang = langFor(name);
      let model = state.models.get(name);
      if (!model || model.isDisposed()) {
        model = state.monaco.editor.createModel(text, lang, state.monaco.Uri.parse(`inmemory://model/${encodeURIComponent(state.current.meta.id)}/${encodeURIComponent(name)}`));
        state.models.set(name, model);
      } else if (model.getValue() !== text) model.setValue(text);
      if (!state.editor) {
        state.editor = state.monaco.editor.create(els.editor, {
          model, fontSize:13, lineHeight:20, theme:state.dark?'vs-dark':'vs', automaticLayout:true, minimap:{enabled:false},
          wordWrap:'on', padding:{top:10}, scrollBeyondLastLine:false, tabSize:2, insertSpaces:true,
          formatOnPaste:true, formatOnType:false, quickSuggestions:{other:true,comments:true,strings:true},
          suggestOnTriggerCharacters:true, acceptSuggestionOnEnter:'on', acceptSuggestionOnCommitCharacter:true,
          snippetSuggestions:'top', tabCompletion:'on', parameterHints:{enabled:true}, inlineSuggest:{enabled:true},
          suggest:{showMethods:true,showFunctions:true,showConstructors:true,showFields:true,showVariables:true,showProperties:true,showKeywords:true,preview:true},
          folding:true, bracketPairColorization:{enabled:true}, guides:{bracketPairs:true},
          renderWhitespace:'selection', smoothScrolling:true
        });
        state.editor.onDidChangeModelContent(onEditorChange);
      } else state.editor.setModel(model);
      state.monaco.editor.setModelMarkers(model, `oml-${state.current.meta.id}`, []);
      state.monaco.editor.setTheme(state.dark?'vs-dark':'vs');
      els.saveState.textContent = readSaved(state.current.meta.id, name) !== null ? 'Restored' : 'Original';
      state.editor.focus();
    } else {
      toggleFallback(true);
      els.fallback.value = text;
      els.fallback.oninput = onEditorChange;
      els.fallback.onkeydown = onFallbackKeydown;
      els.fallback.focus();
      els.saveState.textContent = 'Smart fallback';
      maybeShowFallbackSuggestions();
    }
  }

  function destroyEditor() {
    state.models.forEach(m => { try { m.dispose(); } catch {} });
    state.models.clear();
    if (state.editor) { try { state.editor.dispose(); } catch {} state.editor = null; }
    els.fallback.oninput = null;
    els.fallback.onkeydown = null;
    toggleFallback(false);
  }

  function onEditorChange() {
    if (!state.current) return;
    const file = els.activeFile.textContent;
    if (!file || !textFile(file)) return;
    const text = state.monaco && state.editor ? state.editor.getValue() : els.fallback.value;
    const saved = saveFile(state.current.meta.id, file, text);
    els.saveState.textContent = saved ? 'Saved locally' : 'Session saved';
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => { els.saveState.textContent = 'Autosaved'; }, 380);
    schedulePreview(90);
    scheduleAutoChecks();
    if (!state.monaco) maybeShowFallbackSuggestions();
  }

  function schedulePreview(ms = 120) {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(updatePreview, ms);
  }
  function updatePreviewDebounced() { schedulePreview(90); }

  function updatePreview() {
    if (!state.current) return;
    const fallback = [...state.files.keys()].find(n => /^index\.html?$/i.test(n)) || [...state.files.keys()].find(n => /\.html?$/i.test(n));
    const htmlName = findVirtualFile(state.previewFile || '') || fallback;
    if (!htmlName) return;
    state.previewFile = htmlName;
    let html = getFileText(htmlName);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      [...doc.querySelectorAll('link[rel~="stylesheet"][href]')].forEach(link => {
        const href = link.getAttribute('href');
        const resolved = findVirtualFile(resolveVirtualPath(htmlName, href) || '');
        if (!resolved) return;
        const style = doc.createElement('style');
        style.setAttribute('data-oml-source', resolved);
        style.textContent = rewriteCssUrls(getFileText(resolved), resolved);
        link.replaceWith(style);
      });
      for (const el of doc.querySelectorAll('[src], [poster], link[href]')) {
        const attr = el.hasAttribute('src') ? 'src' : el.hasAttribute('poster') ? 'poster' : 'href';
        if (el.tagName === 'LINK' && /stylesheet/i.test(el.getAttribute('rel') || '')) continue;
        const value = el.getAttribute(attr);
        const resolved = findVirtualFile(resolveVirtualPath(htmlName, value) || '');
        const data = resolved ? assetData(resolved) : null;
        if (data) el.setAttribute(attr, data);
        else if (resolved) el.setAttribute(attr, '#');
      }
      for (const a of doc.querySelectorAll('a[href]')) {
        const value = a.getAttribute('href') || '';
        if (/^(?:https?:|mailto:|tel:|javascript:|#|data:|blob:|\/\/)/i.test(value)) continue;
        const resolved = findVirtualFile(resolveVirtualPath(htmlName, value) || '');
        if (!resolved) {
          a.setAttribute('href', '#');
          a.dataset.omlBroken = 'true';
          a.title = 'This local link is not available in the current project';
        } else if (/\.html?$/i.test(resolved)) {
          a.setAttribute('href', '#');
          a.dataset.omlLink = resolved;
          a.title = `Open ${resolved} in live preview`;
        } else {
          a.setAttribute('href', '#');
          a.dataset.omlFile = resolved;
          a.title = `Open ${resolved} in the editor`;
        }
      }
      const existing = doc.body || doc.documentElement;
      if (existing) {
        const bridge = doc.createElement('script');
        bridge.textContent = `(function(){document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-oml-link],a[data-oml-file],a[data-oml-broken]');if(!a)return;e.preventDefault();var target=window.parent!==window?window.parent:window.opener;if(!target)return;if(a.dataset.omlLink)target.postMessage({type:'oml-preview-link',path:a.dataset.omlLink},'*');else if(a.dataset.omlFile)target.postMessage({type:'oml-preview-file',path:a.dataset.omlFile},'*');});document.addEventListener('error',function(e){var el=e.target;if(el&&el.matches&&el.matches('img')){el.style.opacity='.35';el.title='Local preview asset not found';}},true);})();`;
        existing.appendChild(bridge);
      }
      html = '<!doctype html>\n' + doc.documentElement.outerHTML;
    } catch (err) {
      console.warn('Preview parse fallback', err);
    }
    els.preview.srcdoc = html;
  }

  function rewriteCssUrls(css, cssFile) {
    return String(css).replace(/url\((\s*["']?)([^)"']+)["']?\s*\)/gi, (m, q, target) => {
      const resolved = resolveVirtualPath(cssFile, target.trim());
      const data = resolved ? assetData(resolved) : null;
      return data ? `url(${q}${data}${q})` : m;
    });
  }
  function assetData(key) {
    const clean = normalizePath(key);
    const b = state.files.get(clean);
    if (!b) return null;
    const ext = clean.split('.').pop().toLowerCase();
    const mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', svg:'image/svg+xml', webp:'image/webp', avif:'image/avif', ico:'image/x-icon', woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf' }[ext] || 'application/octet-stream';
    let binary = ''; const chunk = 0x8000;
    for (let i = 0; i < b.length; i += chunk) binary += String.fromCharCode(...b.subarray(i, i + chunk));
    return `data:${mime};base64,${btoa(binary)}`;
  }

  els.refreshPreview.addEventListener('click', () => { updatePreview(); toast('Preview refreshed.'); });
  window.addEventListener('message', (event) => {
    const fromPreviewFrame = event.source === els.preview.contentWindow;
    let fromPreviewPopup = false;
    try { fromPreviewPopup = !!(event.source && event.source.opener === window); } catch {}
    if (event.source && !fromPreviewFrame && !fromPreviewPopup) return;
    const data = event.data || {};
    if (data.type === 'oml-preview-link') { const target = findVirtualFile(data.path || ''); if (target) { state.previewFile = target; updatePreview(); } }
    if (data.type === 'oml-preview-file') { const target = findVirtualFile(data.path || ''); if (target) selectFile(target); }
  });
  els.openPreview.addEventListener('click', () => {
    if (!els.preview.srcdoc) return;
    const w = window.open('', '_blank');
    if (!w) { toast('Pop-out was blocked by the browser.'); return; }
    w.document.open();
    w.document.write(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Obaidul Mentor Lab — Preview</title>
<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;width:100%;height:100%;border:0}</style>
</head>
<body><iframe title="Student project live preview" sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe></body>
</html>`);
    w.document.close();
    const frame = w.document.querySelector('iframe');
    if (frame) frame.srcdoc = els.preview.srcdoc;
  });
  els.format.addEventListener('click', async () => {
    if (!state.editor) { toast('Use the smart fallback editor or install a Monaco connection.'); return; }
    try {
      await state.editor.getAction('editor.action.formatDocument')?.run();
      toast('Formatter applied.');
    } catch { toast('Formatter is not available for this file.'); }
  });

  function normalizeTask(task, i) {
    if (typeof task === 'string') return { title:task, description:'Complete this learning task.', checks:[] };
    return { title:task?.title || `Task ${i + 1}`, description:task?.description || '', checks:Array.isArray(task?.checks) ? task.checks : [] };
  }
  function tasksForCurrent() {
    const hw = activeTopic()?.homework || state.current?.meta?.homework || {};
    const raw = Array.isArray(hw.tasks) ? hw.tasks : Array.isArray(hw.checks) ? hw.checks : [];
    return raw.map(normalizeTask);
  }
  function readDone(tasks) {
    try { const raw = JSON.parse(safeGet(`oml:tasks:${topicTaskScope()}`) || '[]'); return Array.from({length:tasks.length}, (_, i) => Boolean(raw[i])); } catch { return tasks.map(() => false); }
  }
  function writeDone(done) { safeSet(`oml:tasks:${topicTaskScope()}`, JSON.stringify(done)); }
  function updateProgress(done, tasks) {
    const total = tasks.length; const count = done.filter(Boolean).length; const pct = total ? Math.round((count / total) * 100) : 0;
    els.taskProgress.textContent = `${count} / ${total} tasks`;
    els.progressPercent.textContent = `${pct}%`;
    els.progressRing.style.setProperty('--progress', `${pct * 3.6}deg`);
    const label = activeTopic()?.title || 'Class';
    els.progressStatus.textContent = total === 0 ? 'No homework yet' : pct === 100 ? `${label} complete 🎉` : `${total - count} task${total - count === 1 ? '' : 's'} remaining`;
    if (pct === 100) els.progressRing.classList.add('complete'); else els.progressRing.classList.remove('complete');
  }
  function renderTasks() {
    const tasks = tasksForCurrent(); const done = readDone(tasks);
    els.taskList.innerHTML = tasks.length ? tasks.map((t,i) => `
      <div class="task-item ${done[i] ? 'is-done' : ''}">
        <label class="task-main"><input class="task-check" type="checkbox" data-task="${i}" ${done[i] ? 'checked' : ''} aria-label="Mark ${escapeAttr(t.title)} complete"><span class="task-copy"><strong>${escapeHtml(t.title)}</strong><p>${escapeHtml(t.description)}</p></span></label>
        <button class="check-btn" data-check="${i}" type="button">${t.checks.length ? 'Auto-check' : 'Mark done'}</button>
      </div>`).join('') : `<div class="hint-box"><p>No homework metadata yet. Add <code>homework.tasks</code> to the class metadata JSON.</p></div>`;
    updateProgress(done, tasks);
    $$('.task-check').forEach(c => c.addEventListener('change', () => {
      const d = readDone(tasks); d[+c.dataset.task] = c.checked; writeDone(d); renderTasks(); toast(c.checked ? 'Task marked complete.' : 'Task reopened.');
    }));
    $$('[data-check]').forEach(b => b.addEventListener('click', () => checkTask(+b.dataset.check)));
    els.checkAll.disabled = !tasks.some(t => t.checks.length);
    els.taskProgressHint.textContent = tasks.some(t => t.checks.length) ? 'Code changes re-check verified tasks automatically' : 'Use the task rows to track your work';
  }

  async function checkTask(i, silent = false) {
    const tasks = tasksForCurrent(); const task = tasks[i]; if (!task) return false;
    const ok = task.checks.length ? await evaluateChecks(task.checks) : true;
    const done = readDone(tasks); done[i] = ok; writeDone(done); renderTasks();
    if (!silent) toast(ok ? 'Task passed ✓' : 'Not quite yet. Read the requirement and try again.');
    if (ok && !silent) confetti();
    return ok;
  }
  async function checkAllTasks() {
    const tasks = tasksForCurrent(); if (!tasks.length) return;
    const done = readDone(tasks);
    for (let i = 0; i < tasks.length; i++) if (tasks[i].checks.length) done[i] = await evaluateChecks(tasks[i].checks);
    writeDone(done); renderTasks(); toast('Homework checks updated.');
    if (done.length && done.every(Boolean)) confetti();
  }
  async function evaluateChecks(checks) {
    if (!Array.isArray(checks) || !checks.length) return false;
    for (const c of checks) {
      const ok = await evalCheck(c);
      if (c?.mode === 'any' && ok) return true;
      if (c?.mode !== 'any' && !ok) return false;
    }
    return true;
  }
  async function evalCheck(c) {
    if (!c || typeof c !== 'object') return false;
    if (c.mode === 'any') { for (const child of c.checks || []) if (await evalCheck(child)) return true; return false; }
    if (c.mode === 'all') { for (const child of c.checks || []) if (!(await evalCheck(child))) return false; return true; }
    if (c.type === 'files_exist') return (c.files || []).every(f => state.files.has(normalizePath(f)));
    const file = normalizePath(c.file); if (!file || !state.files.has(file)) return false;
    const text = getFileText(file);
    if (c.type === 'contains') return c.value == null ? false : (c.flags === 'i' ? text.toLowerCase().includes(String(c.value).toLowerCase()) : text.includes(String(c.value)));
    if (c.type === 'not_contains') return !text.includes(String(c.value));
    if (c.type === 'regex') { try { return new RegExp(c.pattern, c.flags || '').test(text); } catch { return false; } }
    if (c.type === 'min_length') return text.length >= Number(c.value || 0);
    if (c.type === 'html_elements') { const re = new RegExp(`<${escapeRegExp(c.tag)}(?:\\s|>)`, 'ig'); return (text.match(re) || []).length >= Number(c.min || 1); }
    if (c.type === 'css_property') return new RegExp(`${escapeRegExp(c.property)}\\s*:\\s*${escapeRegExp(String(c.value || ''))}`, 'i').test(text);
    return false;
  }
  function scheduleAutoChecks() {
    clearTimeout(state.autoCheckTimer);
    state.autoCheckTimer = setTimeout(async () => {
      const tasks = tasksForCurrent(); if (!tasks.some(t => t.checks.length)) return;
      const done = readDone(tasks); let changed = false;
      for (let i = 0; i < tasks.length; i++) {
        if (!tasks[i].checks.length) continue;
        const ok = await evaluateChecks(tasks[i].checks);
        if (done[i] !== ok) { done[i] = ok; changed = true; }
      }
      if (changed) { writeDone(done); renderTasks(); }
    }, 650);
  }
  els.checkAll.addEventListener('click', checkAllTasks);

  function renderHints() {
    const hints = activeTopic()?.homework?.hints || state.current?.meta?.homework?.hints || [];
    state.hintIndex = 0;
    els.hintBox.innerHTML = hints.length ? `<div class="hint">${escapeHtml(hints[0])}</div>` : '<p>Small hint: read the requirement first, then inspect the starter files before writing code.</p>';
  }
  els.nextHint.addEventListener('click', () => {
    const hints = activeTopic()?.homework?.hints || state.current?.meta?.homework?.hints || [];
    if (!hints.length) return toast('No more hints have been added for this section.');
    state.hintIndex = (state.hintIndex + 1) % hints.length;
    els.hintBox.innerHTML = `<div class="hint hint-pop">${escapeHtml(hints[state.hintIndex])}</div>`;
  });

  async function downloadZip(edited) {
    if (!state.current) return;
    if (!(await ensureZipLibrary())) { toast('The ZIP engine could not load.'); return; }
    const zip = new JSZip();
    for (const [name, bytes] of state.files.entries()) {
      let data = bytes;
      if (edited && textFile(name)) data = new TextEncoder().encode(getFileText(name));
      zip.file(name, data);
    }
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
    const a = document.createElement('a'); const href = URL.createObjectURL(blob);
    a.href = href; a.download = `${safeFileName(state.current.meta.title)}-${edited ? 'edited' : 'provided'}.zip`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 2500);
    toast(`${edited ? 'Edited' : 'Provided'} ZIP ready.`);
  }
  els.originalZip.addEventListener('click', () => downloadZip(false));
  els.editedZip.addEventListener('click', () => downloadZip(true));

  async function openArticle(id) {
    if (!state.catalog) { rememberPending('blogs', id); showView('login'); return; }
    const meta = state.catalog.blogs.find(x => x.id === id); if (!meta) { toast('Article not found.'); return; }
    if (!(await ensureZipLibrary())) { toast('The ZIP engine could not load.'); return; }
    toast('Opening article…');
    try {
      const env = await loadJson(meta.resource); const bytes = await decryptEnvelope(env, state.password); const zip = await JSZip.loadAsync(bytes);
      let md = '';
      for (const n of ['article.md','index.md','README.md','readme.md']) if (zip.files[n]) { md = await zip.files[n].async('text'); break; }
      if (!md) for (const n of Object.keys(zip.files)) if (/\.md$/i.test(n)) { md = await zip.files[n].async('text'); break; }
      els.article.innerHTML = markdown(md, meta); showView('article'); history.replaceState(null, '', `${location.pathname}#article/${encodeURIComponent(id)}`);
    } catch (err) { console.error(err); toast('This article could not be opened.'); }
  }
  els.articleBack.addEventListener('click', () => { location.hash = 'blogs'; showView('blogs'); });

  function markdown(src, meta) {
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let out = `<div class="article-content"><div class="eyebrow">${escapeHtml((meta.tags || []).join(' · ') || 'Mentor note')}</div><h1>${escapeHtml(meta.title || 'Article')}</h1><p>${escapeHtml(meta.description || '')}</p>`;
    let inCode = false, code = [], inList = false;
    for (const line of lines) {
      if (line.trim().startsWith('```')) { if (!inCode) { if (inList) { out += '</ul>'; inList=false; } inCode=true; code=[]; } else { out += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`; inCode=false; } continue; }
      if (inCode) { code.push(line); continue; }
      if (/^###\s+/.test(line)) { if(inList){out+='</ul>';inList=false;} out += `<h3>${inlineMd(line.replace(/^###\s+/,''))}</h3>`; }
      else if (/^##\s+/.test(line)) { if(inList){out+='</ul>';inList=false;} out += `<h2>${inlineMd(line.replace(/^##\s+/,''))}</h2>`; }
      else if (/^#\s+/.test(line)) { if(inList){out+='</ul>';inList=false;} out += `<h2>${inlineMd(line.replace(/^#\s+/,''))}</h2>`; }
      else if (/^[-*]\s+/.test(line)) { if(!inList){out+='<ul>';inList=true;} out += `<li>${inlineMd(line.replace(/^[-*]\s+/,''))}</li>`; }
      else if (line.trim()) { if(inList){out+='</ul>';inList=false;} out += `<p>${inlineMd(line)}</p>`; }
      else if(inList){out+='</ul>';inList=false;}
    }
    if (inList) out += '</ul>';
    return out + '</div>';
  }
  function inlineMd(s) { return escapeHtml(s).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\((https?:[^\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>'); }

  function installMonacoEnhancements(monaco) {
    if (state.monacoProvidersInstalled) return;
    state.monacoProvidersInstalled = true;
    monaco.languages.registerCompletionItemProvider('html', {
      triggerCharacters:['<',' ','/','"','='],
      provideCompletionItems(model, position) {
        const line = model.getValueInRange({startLineNumber:position.lineNumber,startColumn:1,endLineNumber:position.lineNumber,endColumn:position.column});
        const before = line.slice(0,-1 + 1);
        const word = model.getWordUntilPosition(position); const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, position.column);
        let items = HTML_SUGGESTIONS;
        if (/!$/.test(line.trim())) items = [HTML_SUGGESTIONS[0]];
        else if (!/<[^>]*$/.test(line) && !/<\w+\s+[^>]*$/.test(line)) items = HTML_SUGGESTIONS.slice(1);
        return { suggestions: items.map((s) => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Keyword, detail:s.detail, insertText:s.insertText.replace(/\$0/g,''), insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
      }
    });
    monaco.languages.registerCompletionItemProvider('css', {
      triggerCharacters:['-',';',':'],
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, position.column);
        return { suggestions: CSS_SUGGESTIONS.map(s => ({ label:s.label, kind:monaco.languages.CompletionItemKind.Property, detail:s.detail, insertText:s.insertText, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
      }
    });
  }

  function getFallbackContext() {
    const text = els.fallback.value; const pos = els.fallback.selectionStart; const lineStart = text.lastIndexOf('\n', pos - 1) + 1; const line = text.slice(lineStart, pos);
    const lang = langFor(els.activeFile.textContent); return { text, pos, lineStart, line, lang };
  }
  function smartSuggestionsFor(context) {
    if (context.lang === 'css') {
      const m = context.line.match(/(?:^|[;{]\s*)([\w-]*)$/); if (!m) return [];
      const q = m[1].toLowerCase(); return CSS_SUGGESTIONS.filter(s => s.label.startsWith(q)).slice(0,8);
    }
    const trimmed = context.line.trim();
    if (trimmed === '!') return [HTML_SUGGESTIONS[0]];
    const m = context.line.match(/<\/?([\w-]*)$/); if (m) { const q = m[1].toLowerCase(); return HTML_SUGGESTIONS.filter(s => s.label !== '! + Tab' && s.label.startsWith(q)).slice(0,8); }
    return [];
  }
  function maybeShowFallbackSuggestions() {
    if (state.monaco || els.fallback.hidden) return hideSmartSuggestions();
    const suggestions = smartSuggestionsFor(getFallbackContext());
    state.smartSuggestions = suggestions; state.smartSuggestionIndex = 0;
    if (!suggestions.length) return hideSmartSuggestions();
    els.fallbackSuggest.innerHTML = suggestions.map((s,i) => `<button type="button" class="smart-suggestion ${i===0?'active':''}" data-suggest="${i}" role="option"><strong>${escapeHtml(s.label)}</strong><span>${escapeHtml(s.detail)}</span></button>`).join('');
    els.fallbackSuggest.hidden = false; state.smartSuggestionVisible = true;
    $$('.smart-suggestion').forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); acceptFallbackSuggestion(+b.dataset.suggest); }));
  }
  function hideSmartSuggestions() { els.fallbackSuggest.hidden = true; state.smartSuggestionVisible = false; }
  function renderSuggestionSelection() { $$('.smart-suggestion').forEach((b,i) => b.classList.toggle('active', i === state.smartSuggestionIndex)); }
  function onFallbackKeydown(e) {
    if (!state.smartSuggestionVisible) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); state.smartSuggestionIndex=(state.smartSuggestionIndex+1)%state.smartSuggestions.length; renderSuggestionSelection(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); state.smartSuggestionIndex=(state.smartSuggestionIndex-1+state.smartSuggestions.length)%state.smartSuggestions.length; renderSuggestionSelection(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptFallbackSuggestion(state.smartSuggestionIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); hideSmartSuggestions(); }
  }
  function acceptFallbackSuggestion(index) {
    const s = state.smartSuggestions[index]; if (!s) return;
    const ctx = getFallbackContext(); const before = ctx.text.slice(0, ctx.pos); const after = ctx.text.slice(ctx.pos);
    let start = ctx.pos;
    if (ctx.lang === 'css') { const m=ctx.line.match(/[\w-]*$/); start = ctx.pos - (m?.[0]?.length || 0); }
    else if (ctx.line.trim()==='!') start = ctx.lineStart + ctx.line.search(/\S/);
    else { const m=ctx.line.match(/([\w-]*)$/); start = ctx.pos - (m?.[1]?.length || 0); }
    let insert=s.insertText.replace(/\$\d+/g,'').replace(/\$0/g,'');
    const next = ctx.text.slice(0,start) + insert + after;
    els.fallback.value=next; const caret=start+insert.length; els.fallback.setSelectionRange(caret,caret); onEditorChange(); maybeShowFallbackSuggestions();
  }

  function confetti() {
    const pieces=[]; for(let i=0;i<22;i++){const x=document.createElement('span');x.textContent=i%2?'✦':'·';x.className='confetti-piece';x.style.left=`${45+Math.random()*10}%`;x.style.top=`${42+Math.random()*8}%`;x.style.setProperty('--dx',`${Math.random()*240-120}px`);x.style.setProperty('--dy',`${Math.random()*260-130}px`);pieces.push(x);document.body.appendChild(x);setTimeout(()=>x.remove(),900);}
  }

  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g,'&#96;'); }
  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function safeFileName(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'student-project'; }

  function registerServiceWorker() {
    if (new URLSearchParams(location.search).get('smoke') === '1') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  }

  function runSmokeProbe() {
    if (new URLSearchParams(location.search).get('smoke') !== '1') return;
    window.setTimeout(() => {
      const themeBefore = state.dark;
      els.theme.click();
      const themeChanged = state.dark !== themeBefore;
      els.theme.click();

      els.heroAccess.click();
      const loginReady = document.querySelector('[data-view="login"]')?.classList.contains('active-view');
      document.documentElement.dataset.smoke = themeChanged && loginReady ? 'pass' : 'fail';
      location.hash = 'home';
      showView('home', false);
    }, 80);
  }

  // Expose a small diagnostics hook for manual browser testing.
  window.ObaidulMentorLab = {
    getState: () => ({
      unlocked:!!state.catalog,
      current:state.current?.meta?.id || null,
      files:state.files.size,
      monaco:!!state.monaco,
      topic:state.activeTopicId || null
    })
  };

  loadSiteInfo().finally(() => {
    route();
    document.documentElement.dataset.omlBoot = 'ready';
    registerServiceWorker();
    runSmokeProbe();
  });
})();
