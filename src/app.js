const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  classes: [], siteConfig: {}, activeClass: null,
  files: new Map(), activeFile: null, editorView: null,
  saveTimer: null, previewTimer: null, searchTimer: null, previewFrameToken: 0,
  currentFilter: 'All', cmPromise: null, zipPromise: null,
  resize: { files: 250, editor: 520 }, loadToken: 0, editorResizeObserver: null
};

const MODULES = {
  state: 'https://esm.sh/@codemirror/state@6.5.2',
  view: 'https://esm.sh/@codemirror/view@6.36.5',
  commands: 'https://esm.sh/@codemirror/commands@6.8.1',
  language: 'https://esm.sh/@codemirror/language@6.11.1',
  html: 'https://esm.sh/@codemirror/lang-html@6.4.9',
  css: 'https://esm.sh/@codemirror/lang-css@6.3.1',
  javascript: 'https://esm.sh/@codemirror/lang-javascript@6.2.2',
  autocomplete: 'https://esm.sh/@codemirror/autocomplete@6.18.6',
  zip: 'https://esm.sh/jszip@3.10.1'
};

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
const escapeAttr = escapeHtml;

async function getJSON(url) {
  const response = await fetch(url, { cache: 'default' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function assetUrl(...parts) {
  const encoded = parts.map(part => String(part).split('/').map(encodeURIComponent).join('/')).join('/');
  return new URL(encoded, document.baseURI).href;
}

function initials(name = 'Web Lab') { return String(name).split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 3).toUpperCase(); }
function storageKey(id) { return `future-web-lab:${id}`; }
function loadStored(id) { try { return JSON.parse(localStorage.getItem(storageKey(id)) || 'null'); } catch { return null; } }
function hasLocalChanges(id) { try { return !!localStorage.getItem(storageKey(id)); } catch { return false; } }

function applyBrand() {
  const brand = state.siteConfig.brand || {};
  const name = brand.name || 'Obaid Web Lab';
  $('#brandName').textContent = name;
  $('#brandRole').textContent = brand.role || 'Web Development Learning Lab';
  $('#brandTagline').textContent = brand.tagline || 'Learn. Code. Experiment. Build.';
  $('#brandDescription').textContent = brand.description || 'A hands-on coding lab for learning through real projects.';
  $('#footerBrand').textContent = name;
  $('#brandMark').textContent = brand.shortName || initials(name);
  document.title = `${name} · ${brand.role || 'Learning Lab'}`;
}

function buildFilters() {
  const categories = ['All', ...new Set(state.classes.map(item => item.category).filter(Boolean))];
  const filters = $('#filters'); if (!filters) return;
  filters.innerHTML = categories.map(category => `<button type="button" class="filter ${category === state.currentFilter ? 'active' : ''}" data-filter="${escapeAttr(category)}">${escapeHtml(category)}</button>`).join('');
}
function classSearchText(item) { return [item.id,item.slug,item.title,item.name,item.description,item.category,item.level,...(Array.isArray(item.tags)?item.tags:[])].filter(Boolean).join(' ').toLowerCase(); }
function cardTemplate(item) {
  const id = item.id || item.slug, tags = Array.isArray(item.tags) ? item.tags.slice(0,4) : [], local = hasLocalChanges(id);
  return `<a class="class-card" href="#workspace/${encodeURIComponent(id)}" data-id="${escapeAttr(id)}" aria-label="Open ${escapeAttr(item.title || id)}">
    <div class="card-top"><span class="card-index">${escapeHtml(id)}</span><span class="card-level">${escapeHtml(item.level || 'Project')}</span></div>
    <div class="card-title-row"><div class="class-symbol" aria-hidden="true">&lt;/&gt;</div><div><h3>${escapeHtml(item.title || item.name || 'Untitled Project')}</h3><span class="card-category">${escapeHtml(item.category || 'Web Development')}</span></div></div>
    <p>${escapeHtml(item.description || 'Hands-on web development project.')}</p>
    <div class="tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="card-bottom"><span>${local ? '<i class="saved-dot"></i> local version available' : 'open project workspace'}</span><b aria-hidden="true">↗</b></div>
  </a>`;
}
function renderClasses() {
  const grid = $('#classGrid'); if (!grid) return;
  const query = ($('#search')?.value || '').trim().toLowerCase();
  const visible = state.classes.filter(item => (state.currentFilter === 'All' || item.category === state.currentFilter) && classSearchText(item).includes(query));
  $('#classCount').textContent = String(state.classes.length);
  $('#libraryCount').textContent = String(visible.length);
  $('#libraryHint').textContent = visible.length === state.classes.length ? 'LIVE INDEX • AUTO UPDATED' : `${state.classes.length - visible.length} HIDDEN BY SEARCH / FILTER`;
  $('#emptyState').hidden = visible.length !== 0;
  grid.innerHTML = visible.map(cardTemplate).join('');
}

function openClass(id, scroll = true) {
  clearTimeout(state.saveTimer); clearTimeout(state.previewTimer); state.loadToken++;
  const selected = state.classes.find(item => (item.id || item.slug) === id); if (!selected) return;
  cleanupEditor(); cleanupPreview(); state.activeClass = selected;
  const nextHash = `#workspace/${encodeURIComponent(selected.id || selected.slug)}`;
  if (location.hash !== nextHash) history.pushState({ classId: selected.id || selected.slug }, '', nextHash);
  $('#workspaceSubtitle').textContent = `${selected.title || selected.name || selected.slug} · edit, preview, experiment and export your version.`;
  $('#workspaceShell').innerHTML = workspaceTemplate(selected); setupWorkspace(); loadProject(selected);
  if (scroll) $('#workspace')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function workspaceTemplate(item) {
  const id = item.id || item.slug;
  return `<div class="editor-shell" id="editorShell">
    <aside class="files-panel"><div class="panel-head"><div><span class="panel-eyebrow">PROJECT</span><strong title="${escapeAttr(id)}">${escapeHtml(id)}</strong></div><button class="icon-btn" data-action="files-toggle" aria-label="Hide files" title="Hide files">≡</button></div>
      <div class="file-toolbar"><span id="fileCount">0 files</span><span class="file-dot"></span><span>LOCAL</span></div><div class="file-list" id="fileList"></div>
    </aside><div class="splitter" data-split="files" role="separator" aria-orientation="vertical" aria-valuemin="220" aria-valuemax="360" aria-valuenow="250" tabindex="0" aria-label="Resize project files panel"></div>
    <section class="editor-panel"><div class="toolbar workspace-toolbar"><div class="toolbar-group"><button class="tool-btn" data-action="files-toggle">Files</button><button class="tool-btn primary-tool" data-action="save">Save</button><button class="tool-btn" data-action="reset">Reset</button><button class="tool-btn" data-action="undo">Undo</button><button class="tool-btn" data-action="redo">Redo</button></div><div class="toolbar-file" id="activeFileLabel">Select a file</div><div class="toolbar-group"><button class="tool-btn" data-action="editor-full">Editor ⛶</button><button class="tool-btn mobile-preview-toggle" data-action="preview-mode">Preview</button></div></div>
      <div class="editor-wrap"><div class="code-host" id="codeHost"><div class="editor-loading">Choose a file to begin…</div></div></div><div class="statusbar"><div><span class="status-dot"></span><span id="saveStatus">Ready</span></div><div><span id="languageStatus">—</span><span class="status-divider"></span><span>CTRL/CMD K Search</span></div></div></section>
    <div class="splitter" data-split="editor" role="separator" aria-orientation="vertical" aria-valuemin="380" aria-valuemax="760" aria-valuenow="520" tabindex="0" aria-label="Resize code editor panel"></div>
    <section class="preview-panel"><div class="toolbar"><div class="toolbar-group"><span class="live-badge"><i></i> LIVE PREVIEW</span></div><div class="toolbar-group"><button class="tool-btn mobile-code-toggle" data-action="preview-mode">Code</button><button class="tool-btn" data-action="refresh">Refresh</button><button class="tool-btn" data-action="preview-full">Preview ⛶</button><button class="tool-btn" data-action="download-original">Original ZIP</button><button class="tool-btn primary-tool" data-action="download">My ZIP</button></div></div><div class="preview-wrap"><div class="preview-frame-head"><span>workspace / ${escapeHtml(id)}</span><span id="previewState">READY</span></div><iframe id="previewFrame" title="Live project preview" loading="eager" sandbox="allow-scripts allow-forms allow-modals"></iframe></div></section>
  </div>`;
}

function setupWorkspace() { setDefaultWorkspaceSize(); }
function setDefaultWorkspaceSize() {
  const shell = $('#editorShell'); if (!shell) return;
  const width = shell.getBoundingClientRect().width;
  state.resize.files = width < 1120 ? Math.max(210, Math.round(width * .22)) : 250;
  state.resize.editor = width < 1120 ? Math.max(380, Math.round((width - state.resize.files - 12) / 2)) : 520;
  shell.style.setProperty('--files-width', `${state.resize.files}px`); shell.style.setProperty('--editor-width', `${state.resize.editor}px`); const filesSplit=document.querySelector('.splitter[data-split=\"files\"]'); const editorSplit=document.querySelector('.splitter[data-split=\"editor\"]'); if(filesSplit) filesSplit.setAttribute('aria-valuenow', String(state.resize.files)); if(editorSplit) editorSplit.setAttribute('aria-valuenow', String(state.resize.editor));
}
function startSplitDrag(event) {
  const shell = $('#editorShell'), kind = event.currentTarget.dataset.split;
  if (!shell || matchMedia('(max-width:900px)').matches) return;
  event.preventDefault(); const rect = shell.getBoundingClientRect();
  const move = e => { const x = e.clientX - rect.left; if (kind === 'files') { state.resize.files = Math.round(Math.max(220, Math.min(360,x))); shell.style.setProperty('--files-width', `${state.resize.files}px`); const filesSplit=document.querySelector('.splitter[data-split=\"files\"]'); if(filesSplit) filesSplit.setAttribute('aria-valuenow', String(state.resize.files)); return; } const available = rect.width - state.resize.files - 12; state.resize.editor = Math.round(Math.max(380, Math.min(available - 380, x - state.resize.files - 8))); shell.style.setProperty('--editor-width', `${state.resize.editor}px`); const editorSplit=document.querySelector('.splitter[data-split=\"editor\"]'); if(editorSplit) editorSplit.setAttribute('aria-valuenow', String(state.resize.editor)); };
  const stop = () => { window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',stop); window.removeEventListener('pointercancel',stop); };
  window.addEventListener('pointermove',move,{passive:true}); window.addEventListener('pointerup',stop,{once:true}); window.addEventListener('pointercancel',stop,{once:true});
}

async function loadProject(item) {
  const token = state.loadToken; state.files.clear(); state.activeFile = null; cleanupEditor();
  const id = item.id || item.slug, stored = loadStored(id), list = Array.isArray(item.files) ? item.files : [];
  if (!list.length) { showWorkspaceNotice('No project files were indexed. Add source files to the class folder and rebuild.'); return; }
  await Promise.all(list.map(async relative => {
    const url = assetUrl('classes', item.slug || id, relative);
    try {
      const response = await fetch(url, { cache: 'default' });
      if (!response.ok) { state.files.set(relative,{binary:isBinary(relative),url,error:response.status}); return; }
      if (isBinary(relative)) state.files.set(relative,{binary:true,url});
      else { const original = await response.text(); state.files.set(relative,{binary:false,url,original,current:stored?.files?.[relative] ?? original}); }
    } catch (error) { state.files.set(relative,{binary:isBinary(relative),url,error:error.message}); }
  }));
  if (token !== state.loadToken || state.activeClass !== item) return;
  const editable = [...state.files.entries()].filter(([,e]) => !e.binary && !e.error && typeof e.original === 'string').map(([f]) => f);
  renderFileList(); $('#fileCount').textContent = `${state.files.size} file${state.files.size===1?'':'s'}`;
  if (!editable.length) { showWorkspaceNotice('This project has no editable source files.'); return; }
  const preferred = item.entry && state.files.has(item.entry) && !state.files.get(item.entry)?.binary ? item.entry : editable.find(file => /(^|\/)index\.html?$/i.test(file)) || editable[0];
  await selectFile(preferred, token); updatePreview();
}

function renderFileList() {
  const container=$('#fileList'); if(!container) return;
  const sorted=[...state.files.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  container.innerHTML=sorted.map(relative=>{ const item=state.files.get(relative), disabled=item?.binary||item?.error, active=relative===state.activeFile?' active':'', binary=item?.binary?' binary':'', unavailable=item?.error?' unavailable':''; return `<button type="button" class="file-btn${active}${binary}${unavailable}" data-file="${escapeAttr(relative)}" title="${escapeAttr(relative)}" aria-current="${active?'true':'false'}" ${disabled?'disabled':''}><span class="file-icon">${fileIcon(relative)}</span><span class="file-name">${escapeHtml(relative)}</span></button>`; }).join('');
}

async function selectFile(relative, token = state.loadToken) {
  if (token !== state.loadToken) return;
  const item=state.files.get(relative); if(!item||item.binary||item.error) return;
  syncEditorValue(); state.activeFile=relative; renderFileList(); $('#activeFileLabel').textContent=relative; $('#languageStatus').textContent=extensionLabel(relative);
  const host=$('#codeHost'); if(!host) return; cleanupEditor(); host.innerHTML='<div class="editor-loading"><span></span> Preparing smart editor…</div>';
  try { const cm=await loadCodeMirror(); if(token!==state.loadToken) return; createCodeMirrorEditor(cm,host,relative,item.current??item.original??''); $('#saveStatus').textContent=hasLocalChanges(state.activeClass.id||state.activeClass.slug)?'Local version available':'Original project'; }
  catch { if(token!==state.loadToken) return; createFallbackEditor(host,item.current??item.original??''); $('#saveStatus').textContent='Fallback editor mode'; }
}
function createCodeMirrorEditor(cm,host,relative,value){
  const language=/\.html?$/i.test(relative)?cm.html.html():/\.css$/i.test(relative)?cm.css.css():/\.(js|mjs|ts)$/i.test(relative)?cm.javascript.javascript({typescript:/\.ts$/i.test(relative)}):[];
  const wrapTheme=cm.view.EditorView.theme({
    '.cm-scroller': { overflowX: 'hidden !important', overflowY: 'auto' },
    '.cm-content': { minWidth: '0', maxWidth: '100%' },
    '.cm-line': { overflowWrap: 'anywhere', wordBreak: 'break-word' }
  });
  const extensions=[cm.view.lineNumbers(),cm.view.lineWrapping,wrapTheme,cm.view.highlightActiveLine(),cm.view.highlightActiveLineGutter(),cm.view.drawSelection(),cm.view.keymap.of([...cm.commands.defaultKeymap,...cm.commands.historyKeymap,cm.commands.indentWithTab,...cm.autocomplete.completionKeymap,...cm.language.closeBracketsKeymap]),cm.language.bracketMatching(),cm.language.closeBrackets(),cm.language.foldGutter(),cm.language.indentOnInput(),cm.language.syntaxHighlighting(cm.language.defaultHighlightStyle,{fallback:true}),cm.autocomplete.autocompletion({activateOnTyping:true}),language,cm.view.EditorView.updateListener.of(update=>{if(update.docChanged) onEdit();})];
  state.editorView=new cm.view.EditorView({state:cm.state.EditorState.create({doc:value,extensions}),parent:host});
  const refreshMeasure=()=>state.editorView?.requestMeasure?.();
  state.editorResizeObserver=new ResizeObserver(refreshMeasure);
  state.editorResizeObserver.observe(host);
  window.__cm={undo:cm.commands.undo,redo:cm.commands.redo};
}
function createFallbackEditor(host,value){const textarea=document.createElement('textarea'); textarea.className='fallback-editor'; textarea.value=value; textarea.spellcheck=false; textarea.wrap='soft'; textarea.setAttribute('aria-label', `Code editor for ${state.activeFile || 'current file'}`); textarea.setAttribute('aria-describedby','activeFileLabel'); textarea.addEventListener('input',onEdit); host.innerHTML=''; host.appendChild(textarea); state.editorView={fallback:true,getValue:()=>textarea.value,setValue:n=>textarea.value=n};}
function cleanupEditor(){state.editorResizeObserver?.disconnect?.();state.editorResizeObserver=null;state.editorView?.destroy?.();state.editorView=null;}
function syncEditorValue(){if(!state.editorView||!state.activeFile)return;const item=state.files.get(state.activeFile);if(!item)return;item.current=state.editorView.state?state.editorView.state.doc.toString():state.editorView.getValue?.()??item.current;}
function onEdit(){
  syncEditorValue();
  $('#saveStatus')&&($('#saveStatus').textContent='Unsaved local edit');
  clearTimeout(state.saveTimer);
  clearTimeout(state.previewTimer);
  const targetId=state.activeClass?.id||state.activeClass?.slug;
  state.saveTimer=setTimeout(()=>{
    if((state.activeClass?.id||state.activeClass?.slug)===targetId) saveCurrent(false);
  },500);
  $('#previewState')&&($('#previewState').textContent='UPDATING…');
  state.previewTimer=setTimeout(()=>{
    if((state.activeClass?.id||state.activeClass?.slug)===targetId) updatePreview();
  },180);
}
function saveCurrent(manual=false){if(!state.activeClass)return;syncEditorValue();const payload={version:4,updatedAt:new Date().toISOString(),files:{}};for(const [relative,item] of state.files){if(!item.binary&&!item.error&&isEditable(relative))payload.files[relative]=item.current??item.original??'';}try{localStorage.setItem(storageKey(state.activeClass.id||state.activeClass.slug),JSON.stringify(payload));$('#saveStatus')&&($('#saveStatus').textContent=manual?'Saved locally':'Autosaved');renderClasses();}catch{$('#saveStatus')&&($('#saveStatus').textContent='Local save unavailable');showToast('Local browser storage is full. Export your work as ZIP.');}}
async function resetProject(){if(!state.activeClass)return;if(!confirm('Reset this project to the original files? Your local edits will be removed.'))return;const id=state.activeClass.id||state.activeClass.slug;localStorage.removeItem(storageKey(id));await loadProject(state.activeClass);showToast('Project reset to the original version.');}

function updatePreview(){
  if(!state.activeClass) return;
  syncEditorValue();
  const htmlFile=state.activeClass.entry&&state.files.has(state.activeClass.entry)
    ? state.activeClass.entry
    : [...state.files.keys()].find(f=>(/(^|\/)index\.html?$/i).test(f));
  if(!htmlFile) return;
  const source=state.files.get(htmlFile)?.current??state.files.get(htmlFile)?.original??'';
  const html=injectProject(source,htmlFile);
  const frame=$('#previewFrame');
  if(!frame) return;
  const token=++state.previewFrameToken;
  $('#previewState').textContent='RUNNING…';
  frame.onload=()=>{
    if(token!==state.previewFrameToken) return;
    $('#previewState').textContent='LIVE';
  };
  frame.onerror=()=>{
    if(token!==state.previewFrameToken) return;
    $('#previewState').textContent='ERROR';
  };
  frame.srcdoc=html;
}
function projectRootUrl(){const id=state.activeClass.slug||state.activeClass.id;return assetUrl('classes',id)+'/';}
function resolveProjectUrl(entryFile,relative){const entryBase=new URL(pathDir(entryFile)?`${pathDir(entryFile)}/`:'./',projectRootUrl());return new URL(relative,entryBase).href;}
function injectProject(source,entryFile){const root=projectRootUrl();const base=new URL(pathDir(entryFile)?`${pathDir(entryFile)}/`:'./',root).href;let output=source.replace(/<head([^>]*)>/i,`<head$1><base href="${escapeAttr(base)}">`);output=output.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi,(match,before,src,after)=>{const key=normalizePath(pathDir(entryFile),src);const file=state.files.get(key);if(file&&!file.binary&&!file.error)return `<script${before}${after}>\n${file.current??file.original??''}\n<\/script>`;return match.replace(src,resolveProjectUrl(entryFile,src));});output=output.replace(/<link\b([^>]*?)href=["']([^"']+\.css(?:\?[^"']*)?)["']([^>]*)>/gi,(match,before,href,after)=>{const cleanHref=href.split('?')[0],key=normalizePath(pathDir(entryFile),cleanHref),file=state.files.get(key);if(file&&!file.binary&&!file.error)return `<style>\n${file.current??file.original??''}\n</style>`;return match.replace(href,resolveProjectUrl(entryFile,href));});output=output.replace(/\b(src|href)=["']([^"']+)["']/gi,(match,attr,value)=>{if(/^(https?:|data:|blob:|#|mailto:|javascript:|\/\/|\/)/i.test(value))return match;if(/^[a-z][a-z0-9+.-]*:/i.test(value))return match;return `${attr}="${escapeAttr(resolveProjectUrl(entryFile,value))}"`;});return output;}

async function loadCodeMirror(){if(!state.cmPromise){state.cmPromise=Promise.all(Object.entries(MODULES).filter(([k])=>k!=='zip').map(async([k,url])=>[k,await import(url)])).then(entries=>{const m=Object.fromEntries(entries);return{state:m.state,view:m.view,commands:m.commands,language:m.language,html:m.html,css:m.css,javascript:m.javascript,autocomplete:m.autocomplete};}).catch(error=>{state.cmPromise=null;throw error;});}return state.cmPromise;}
async function loadZip(){if(!state.zipPromise)state.zipPromise=import(MODULES.zip).then(m=>m.default||m).catch(error=>{state.zipPromise=null;throw error;});return state.zipPromise;}
async function downloadZip(edited){if(!state.activeClass)return;try{const JSZip=await loadZip(),zip=new JSZip(),id=state.activeClass.id||state.activeClass.slug;syncEditorValue();for(const [relative,item] of state.files){if(relative==='class.json'||item.error)continue;if(item.binary){const r=await fetch(item.url,{cache:'default'});if(r.ok)zip.file(relative,await r.arrayBuffer());}else zip.file(relative,edited?(item.current??item.original??''):(item.original??''));}zip.file('PROJECT-INFO.txt',`${state.activeClass.title||id}\n${state.siteConfig.brand?.name||'Obaid Web Lab'}\n\nGenerated by the Web Lab browser workspace.`);const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${slugify(id)}${edited?'-my-version':''}.zip`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showToast(edited?'Your edited project is ready.':'Original project ZIP is ready.');}catch(error){showToast(`ZIP export unavailable: ${error.message}`);}}
function showWorkspaceNotice(message){cleanupEditor();$('#workspaceShell').innerHTML=`<div class="workspace-empty error-state"><div class="empty-core"><span>!</span><i></i></div><p class="eyebrow">PROJECT CHECK</p><h3>Workspace needs attention</h3><p>${escapeHtml(message)}</p><a class="button primary small" href="#classes">Back to projects →</a></div>`;}
function toggleFullscreen(element){if(!element)return;if(!document.fullscreenElement)element.requestFullscreen?.();else document.exitFullscreen?.();}
function onGlobalShortcut(event){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#search')?.focus();$('#search')?.select();}}
function isEditable(relative){return /\.(html?|css|js|mjs|ts|json|md|svg)$/i.test(relative)}
function isBinary(relative){return /\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|mp3|wav|ogg|m4a|woff2?|ttf|otf|ico|pdf|zip)$/i.test(relative)}
function extensionLabel(relative){const e=relative.split('.').pop()?.toUpperCase()||'FILE';if(/^(HTM|HTML)$/.test(e))return'HTML';if(e==='CSS')return'CSS';if(/^(JS|MJS|TS)$/.test(e))return'JavaScript';return e}
function fileIcon(relative){if(/\.html?$/i.test(relative))return'◇';if(/\.css$/i.test(relative))return'◌';if(/\.(js|mjs|ts)$/i.test(relative))return'✦';if(/\.(png|jpe?g|webp|avif|svg|gif)$/i.test(relative))return'▧';if(/\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(relative))return'◉';return'·'}
function pathDir(relative){const i=relative.lastIndexOf('/');return i===-1?'':relative.slice(0,i)}
function normalizePath(base,value){const parts=(base?`${base}/`:'').split('/').concat(String(value).split('/')),out=[];for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part);}return out.join('/')}
function slugify(value){return String(value).trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'project'}
function cleanupPreview(){const frame=$('#previewFrame');if(frame)frame.srcdoc='';}
function showToast(message){const toast=$('#toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2200)}

// Delegated UI events keep the DOM light and eliminate per-card/per-file listener churn.
document.addEventListener('click', event => {
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action){
    const target=event.target.closest('[data-action]');
    const handlers={
      'files-toggle':()=>$('#editorShell')?.classList.toggle('files-hidden'),
      save:()=>saveCurrent(true), reset:()=>resetProject(), undo:()=>window.__cm?.undo?.(state.editorView), redo:()=>window.__cm?.redo?.(state.editorView),
      'editor-full':()=>toggleFullscreen($('#editorShell .editor-panel')), 'preview-mode':()=>$('#editorShell')?.classList.toggle('preview-mode'), refresh:()=>updatePreview(), 'preview-full':()=>toggleFullscreen($('#editorShell .preview-panel')), 'download-original':()=>downloadZip(false), download:()=>downloadZip(true)
    }; handlers[action]?.(); return;
  }
  const filter=event.target.closest('[data-filter]'); if(filter){state.currentFilter=filter.dataset.filter||'All';buildFilters();renderClasses();return;}
  const file=event.target.closest('[data-file]'); if(file&&!file.disabled){selectFile(file.dataset.file);return;}
  const card=event.target.closest('.class-card'); if(card && event.button === 0){ event.preventDefault(); openClass(card.dataset.id); }
});
let hoverFrame=0,hoverCard=null;document.addEventListener('pointermove',event=>{const card=event.target.closest('.class-card');if(!card||hoverFrame)return;hoverCard=card;const x=event.clientX,y=event.clientY;hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;if(!hoverCard)return;const r=hoverCard.getBoundingClientRect();hoverCard.style.setProperty('--mx',`${x-r.left}px`);hoverCard.style.setProperty('--my',`${y-r.top}px`);});},{passive:true});
document.addEventListener('pointerdown',event=>{const split=event.target.closest('.splitter');if(split)startSplitDrag({currentTarget:split,preventDefault:event.preventDefault.bind(event)});},{passive:false});
document.addEventListener('keydown', event => { const split=event.target.closest('.splitter'); if(!split || (event.key!=='ArrowLeft' && event.key!=='ArrowRight' && event.key!=='Home' && event.key!=='End')) return; event.preventDefault(); const shell=$('#editorShell'); if(!shell || matchMedia('(max-width:900px)').matches) return; const kind=split.dataset.split; const rect=shell.getBoundingClientRect(); if(kind==='files'){ if(event.key==='Home') state.resize.files=220; else if(event.key==='End') state.resize.files=360; else state.resize.files=Math.max(220,Math.min(360,state.resize.files+(event.key==='ArrowRight'?16:-16))); shell.style.setProperty('--files-width', `${state.resize.files}px`); split.setAttribute('aria-valuenow', String(state.resize.files)); split.setAttribute('aria-valuetext', `${state.resize.files}px wide`); } else { const available=rect.width-state.resize.files-12; const max=Math.max(380,available-380); if(event.key==='Home') state.resize.editor=380; else if(event.key==='End') state.resize.editor=max; else state.resize.editor=Math.max(380,Math.min(max,state.resize.editor+(event.key==='ArrowRight'?16:-16))); shell.style.setProperty('--editor-width', `${state.resize.editor}px`); split.setAttribute('aria-valuenow', String(state.resize.editor)); split.setAttribute('aria-valuetext', `${state.resize.editor}px wide`); }});
document.addEventListener('dblclick',event=>{if(event.target.closest('.splitter'))setDefaultWorkspaceSize();});
window.addEventListener('resize',()=>{if($('#editorShell')) setDefaultWorkspaceSize();},{passive:true});

// Lightweight pointer/scroll ambience: update CSS variables only, throttled to one paint.
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionFrame = 0;
let pointerX = innerWidth * 0.5;
let pointerY = innerHeight * 0.45;
let pendingScroll = scrollY;

function paintAmbientMotion(){
  motionFrame = 0;
  if(motionQuery.matches) return;
  const root = document.documentElement;
  root.style.setProperty('--pointer-x', `${pointerX}px`);
  root.style.setProperty('--pointer-y', `${pointerY}px`);
  root.style.setProperty('--scroll-progress', `${Math.min(1, pendingScroll / Math.max(1, document.documentElement.scrollHeight - innerHeight))}`);
  const visual = $('.hero-visual');
  if(visual && innerWidth > 820){
    const nx = (pointerX / innerWidth - .5) * 2;
    const ny = (pointerY / innerHeight - .5) * 2;
    visual.style.transform = `translate3d(${(nx*3).toFixed(2)}px, ${(ny*3).toFixed(2)}px, 0)`;
  }
}
function queueAmbientMotion(){ if(!motionFrame) motionFrame=requestAnimationFrame(paintAmbientMotion); }
document.addEventListener('pointermove', event=>{
  if(motionQuery.matches) return;
  pointerX=event.clientX; pointerY=event.clientY; queueAmbientMotion();
},{passive:true});
window.addEventListener('scroll',()=>{ pendingScroll=scrollY; queueAmbientMotion(); },{passive:true});
motionQuery.addEventListener?.('change', queueAmbientMotion);
queueAmbientMotion();
window.addEventListener('keydown',onGlobalShortcut);
window.addEventListener('popstate',()=>{const match=location.hash.match(/^#workspace\/(.+)$/);if(match)openClass(decodeURIComponent(match[1]),false);});

async function boot(){
  try{
    const initial=window.__WEB_LAB_DATA__;
    let classes=null, configClasses=null;
    if(initial && Array.isArray(initial.classes)){
      classes=initial.classes;
      configClasses=initial.siteConfig||{};
    }else{
      const result=await Promise.all([getJSON('classes.json'),getJSON('site.config.json').catch(()=>({}))]);
      classes=result[0]; configClasses=result[1]||{};
    }
    if(!Array.isArray(classes)) throw new Error('Class index is invalid.');
    state.classes=classes;
    state.siteConfig=configClasses||{};
    applyBrand(); buildFilters(); renderClasses();
    const search=$('#search');
    if(search) search.addEventListener('input',()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(renderClasses,70);});
    const match=location.hash.match(/^#workspace\/(.+)$/);
    if(match) openClass(decodeURIComponent(match[1]),false);
  }catch(error){
    $('#classGrid').innerHTML=`<div class="empty"><strong>Project library unavailable.</strong><br>${escapeHtml(error.message)}</div>`;
  }
}

boot();
