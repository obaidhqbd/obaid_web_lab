const $ = (s) => document.querySelector(s);
const classGrid = $('#classGrid');
const filtersEl = $('#filters');
const workspaceShell = $('#workspaceShell');
const workspaceEmpty = $('#workspaceEmpty');
const searchInput = $('#search');

let classes = [];
let siteConfig = {};
let activeClass = null;
let files = new Map();
let editorView = null;
let activeFile = null;
let previewObjectUrl = null;
let saveTimer = null;
let previewDebounce = null;
let currentFilter = 'All';
let cmModulesPromise = null;
let zipModulePromise = null;

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

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

function assetUrl(...parts) {
  return new URL(parts.map(String).map(s => s.split('/').map(encodeURIComponent).join('/')).join('/'), document.baseURI).href;
}

async function boot() {
  try {
    const siteConfigPromise = getJSON('site.config.json').catch(() => ({}));
    const classPromise = getJSON('classes.json');
    [classes, siteConfig] = await Promise.all([classPromise, siteConfigPromise]);
    if (!Array.isArray(classes)) throw new Error('classes.json must contain an array.');

    applyBrand();
    buildFilters();
    renderClasses();

    searchInput?.addEventListener('input', renderClasses);
    window.addEventListener('keydown', onGlobalShortcut);
    window.addEventListener('beforeunload', cleanupPreview);

    if (location.hash.startsWith('#workspace/')) {
      const id = decodeURIComponent(location.hash.slice('#workspace/'.length));
      openClass(id);
    }
  } catch (err) {
    if (classGrid) classGrid.innerHTML = `<div class="empty">Could not load the project library: ${escapeHtml(err.message)}</div>`;
  }
}

function applyBrand() {
  const b = siteConfig.brand ?? {};
  if ($('#brandName')) $('#brandName').textContent = b.name || 'Web Lab';
  if ($('#brandRole')) $('#brandRole').textContent = b.role || 'Learning Lab';
  if ($('#brandTagline')) $('#brandTagline').textContent = b.tagline || 'Learn. Code. Experiment. Build.';
  if ($('#brandDescription')) $('#brandDescription').textContent = b.description || 'A hands-on coding lab.';
  if ($('#footerBrand')) $('#footerBrand').textContent = b.name || 'Web Lab';
  if ($('#brandMark')) $('#brandMark').textContent = b.shortName || initials(b.name || 'Web Lab');
  document.title = `${b.name || 'Web Lab'} · ${b.role || 'Learning Lab'}`;
}
function initials(name) { return String(name).split(/\s+/).map(x => x[0]).join('').slice(0, 3).toUpperCase(); }

function buildFilters() {
  if (!filtersEl) return;
  const cats = ['All', ...new Set(classes.map(c => c.category).filter(Boolean))];
  filtersEl.innerHTML = cats.map(cat => `<button type="button" class="filter ${cat === currentFilter ? 'active' : ''}" data-filter="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`).join('');
  filtersEl.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter || 'All'; buildFilters(); renderClasses();
  }));
}

function renderClasses() {
  if (!classGrid) return;
  const q = searchInput?.value.trim().toLowerCase() || '';
  const visible = classes.filter(c => {
    const hay = [c.title, c.name, c.description, c.category, c.level, ...(Array.isArray(c.tags) ? c.tags : [])].join(' ').toLowerCase();
    return (currentFilter === 'All' || c.category === currentFilter) && hay.includes(q);
  });
  if ($('#classCount')) $('#classCount').textContent = String(classes.length);
  if ($('#libraryCount')) $('#libraryCount').textContent = String(visible.length);
  if ($('#emptyState')) $('#emptyState').hidden = visible.length > 0;
  classGrid.innerHTML = visible.map(cardTemplate).join('');
  classGrid.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    card.addEventListener('click', () => openClass(card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClass(card.dataset.id); }
    });
  });
}

function cardTemplate(c) {
  const id = c.id || c.slug;
  const title = c.title || c.name || 'Untitled Class';
  return `<article class="class-card" tabindex="0" role="button" data-id="${escapeAttr(id)}" aria-label="Open ${escapeAttr(title)}">
    <div class="card-top"><span class="card-id">${escapeHtml(id)}</span><span class="card-level">${escapeHtml(c.level || 'Project')}</span></div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(c.description || '')}</p>
    <div class="tags">${(Array.isArray(c.tags) ? c.tags : []).slice(0, 5).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
    <div class="card-bottom"><span>${escapeHtml(c.category || 'Web Development')} · ${escapeHtml(c.duration || 'Self-paced')}</span><b aria-hidden="true">→</b></div>
  </article>`;
}

async function openClass(id) {
  activeClass = classes.find(c => c.id === id || c.slug === id);
  if (!activeClass) return;
  location.hash = `workspace/${encodeURIComponent(activeClass.id || activeClass.slug)}`;
  if ($('#workspaceSubtitle')) $('#workspaceSubtitle').textContent = `${activeClass.title || activeClass.name} · edit, preview and export your version.`;
  workspaceEmpty?.remove();
  if (workspaceShell) workspaceShell.innerHTML = workspaceTemplate(activeClass);
  setupWorkspace();
  await loadProject(activeClass);
  $('#workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function workspaceTemplate(c) {
  const classId = c.id || c.slug;
  return `<div class="editor-shell" id="editorShell">
    <aside class="files-panel"><div class="panel-head"><span>PROJECT</span><span class="project-title">${escapeHtml(classId)}</span></div><div class="file-list" id="fileList"></div></aside>
    <div class="splitter" data-split="files" aria-label="Resize project files panel"></div>
    <section class="editor-panel">
      <div class="toolbar">
        <button class="tool-btn" data-action="save">Save</button><button class="tool-btn" data-action="reset">Reset</button><button class="tool-btn" data-action="undo">Undo</button><button class="tool-btn" data-action="redo">Redo</button><span class="toolbar-spacer"></span><button class="tool-btn" data-action="editor-full">Editor ⛶</button><button class="tool-btn" data-action="preview-mode">Preview</button>
      </div>
      <div class="editor-wrap"><div class="code-host" id="codeHost"></div></div>
      <div class="statusbar"><span class="status-dot"></span><span id="saveStatus">Ready</span><span id="languageStatus">—</span></div>
    </section>
    <div class="splitter" data-split="editor" aria-label="Resize editor panel"></div>
    <section class="preview-panel">
      <div class="toolbar"><span class="project-title">LIVE PREVIEW</span><span class="toolbar-spacer"></span><button class="tool-btn" data-action="refresh">Refresh</button><button class="tool-btn" data-action="preview-full">Preview ⛶</button><button class="tool-btn" data-action="download-original">Original ZIP</button><button class="tool-btn" data-action="download">My ZIP</button></div>
      <div class="preview-wrap"><iframe id="previewFrame" title="Live project preview" sandbox="allow-scripts allow-forms allow-modals"></iframe></div>
    </section>
  </div>`;
}

function setupWorkspace() {
  const root = $('#workspaceShell'); if (!root) return;
  root.querySelector('[data-action="save"]').onclick = () => saveCurrent(true);
  root.querySelector('[data-action="reset"]').onclick = () => resetProject();
  root.querySelector('[data-action="undo"]').onclick = () => editorView && window.__cm?.undo?.(editorView);
  root.querySelector('[data-action="redo"]').onclick = () => editorView && window.__cm?.redo?.(editorView);
  root.querySelector('[data-action="refresh"]').onclick = () => updatePreview();
  root.querySelector('[data-action="download"]').onclick = () => downloadZip(true);
  root.querySelector('[data-action="download-original"]').onclick = () => downloadZip(false);
  root.querySelector('[data-action="editor-full"]').onclick = () => toggleFullscreen($('.editor-panel'));
  root.querySelector('[data-action="preview-full"]').onclick = () => toggleFullscreen($('.preview-panel'));
  root.querySelector('[data-action="preview-mode"]').onclick = () => $('#editorShell')?.classList.toggle('preview-mode');
  setupSplitters();
}


function setupSplitters() {
  const shell = $('#editorShell');
  if (!shell) return;
  shell.querySelectorAll('.splitter').forEach(splitter => {
    splitter.addEventListener('pointerdown', startSplitDrag);
    splitter.addEventListener('dblclick', () => {
      shell.style.removeProperty('--files-width');
      shell.style.removeProperty('--editor-width');
    });
  });
}

function startSplitDrag(e) {
  const shell = $('#editorShell');
  const kind = e.currentTarget.dataset.split;
  if (!shell || window.matchMedia('(max-width: 760px)').matches) return;
  e.preventDefault();
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const rect = shell.getBoundingClientRect();

  const move = ev => {
    const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
    const currentFiles = parseFloat(getComputedStyle(shell).getPropertyValue('--files-width')) || 280;
    if (kind === 'files') {
      const width = Math.max(210, Math.min(360, x));
      shell.style.setProperty('--files-width', `${width}px`);
      return;
    }
    const filesWidth = currentFiles;
    const available = rect.width - filesWidth - 16;
    const relative = x - filesWidth - 8;
    const editorWidth = Math.max(300, Math.min(available - 300, relative));
    shell.style.setProperty('--editor-width', `${editorWidth}px`);
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

async function loadProject(c) {
  files.clear(); activeFile = null; editorView?.destroy?.(); editorView = null;
  const classId = c.id || c.slug;
  const stored = loadStored(classId);
  const fileList = Array.isArray(c.files) ? c.files : [];
  if (!fileList.length) { showWorkspaceNotice('This class has no indexed files. Rebuild the site.'); return; }

  for (const rel of fileList) {
    const url = assetUrl('classes', c.slug || classId, rel);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) { files.set(rel, { binary: isBinary(rel), url, original: null, error: res.status }); continue; }
      if (isBinary(rel)) files.set(rel, { binary: true, url, original: null });
      else files.set(rel, { binary: false, url, original: await res.text() });
    } catch (error) {
      files.set(rel, { binary: isBinary(rel), url, original: null, error: error.message });
    }
  }

  const editable = [...files.keys()].filter(isEditable).filter(rel => !files.get(rel)?.binary && files.get(rel)?.original != null);
  if (!editable.length) { showWorkspaceNotice('No editable source files were found in this class.'); return; }
  editable.forEach(rel => {
    const saved = stored?.files?.[rel];
    files.get(rel).current = saved != null ? saved : files.get(rel).original;
  });
  renderFileList(editable);
  await selectFile(c.entry && files.has(c.entry) ? c.entry : editable.find(r => /(^|\/)index\.html?$/i.test(r)) || editable[0]);
  updatePreview();
}

function renderFileList(editable) {
  const el = $('#fileList'); if (!el) return;
  const sorted = [...editable].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const all = [...files.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  el.innerHTML = all.map(rel => {
    const item = files.get(rel);
    const unavailable = item?.error ? ' unavailable' : '';
    const binary = item?.binary ? ' binary' : '';
    return `<button type="button" class="file-btn${binary}${unavailable}" data-file="${escapeAttr(rel)}" ${item?.binary || item?.error ? 'aria-disabled="true"' : ''}><span class="file-icon">${fileIcon(rel)}</span><span title="${escapeAttr(rel)}">${escapeHtml(rel)}</span></button>`;
  }).join('');
  el.querySelectorAll('.file-btn').forEach(btn => btn.onclick = () => {
    if (!btn.classList.contains('binary') && !btn.classList.contains('unavailable')) selectFile(btn.dataset.file);
  });
}

async function selectFile(rel) {
  const item = files.get(rel); if (!item || item.binary) return;
  activeFile = rel;
  $('#fileList')?.querySelectorAll('.file-btn').forEach(b => b.classList.toggle('active', b.dataset.file === rel));
  editorView?.destroy?.(); editorView = null;
  const host = $('#codeHost'); if (!host) return;
  host.innerHTML = '<div class="editor-loading">Loading editor…</div>';
  try {
    const cm = await loadCodeMirror();
    createCodeMirrorEditor(cm, host, rel, item.current || '');
    if ($('#saveStatus')) $('#saveStatus').textContent = localExists(activeClass.id || activeClass.slug) ? 'Local changes available' : 'Original project';
  } catch (error) {
    createFallbackEditor(host, item.current || '');
    if ($('#saveStatus')) $('#saveStatus').textContent = 'Basic editor mode';
  }
  if ($('#languageStatus')) $('#languageStatus').textContent = extensionLabel(rel);
}

function createCodeMirrorEditor(cm, host, rel, value) {
  const language = /\.html?$/i.test(rel) ? cm.html.html() : /\.css$/i.test(rel) ? cm.css.css() : /\.(js|mjs|ts)$/i.test(rel) ? cm.javascript.javascript({ typescript: /\.ts$/i.test(rel) }) : [];
  const extensions = [cm.view.lineNumbers(), cm.view.highlightActiveLine(), cm.view.highlightActiveLineGutter(), cm.view.drawSelection(), cm.commands.history(), cm.view.keymap.of([...cm.commands.defaultKeymap, ...cm.commands.historyKeymap, cm.commands.indentWithTab, ...cm.autocomplete.completionKeymap, ...cm.language.closeBracketsKeymap]), cm.language.bracketMatching(), cm.language.closeBrackets(), cm.language.foldGutter(), cm.language.indentOnInput(), cm.language.syntaxHighlighting(cm.language.defaultHighlightStyle, { fallback: true }), cm.autocomplete.autocompletion({ activateOnTyping: true }), language, cm.view.EditorView.updateListener.of(v => { if (v.docChanged) onEdit(); })];
  editorView = new cm.view.EditorView({ state: cm.state.EditorState.create({ doc: value, extensions }), parent: host });
  window.__cm = { undo: cm.commands.undo, redo: cm.commands.redo };
}

function createFallbackEditor(host, value) {
  const ta = document.createElement('textarea');
  ta.className = 'fallback-editor'; ta.value = value; ta.spellcheck = false; ta.wrap = 'off';
  ta.addEventListener('input', () => { files.get(activeFile).current = ta.value; onEdit(); });
  host.innerHTML = ''; host.appendChild(ta); editorView = { fallback: true, getValue: () => ta.value, setValue: v => { ta.value = v; } };
}

function syncEditorValue() { if (!editorView || !activeFile) return; const item = files.get(activeFile); if (!item) return; if (editorView.state) item.current = editorView.state.doc.toString(); else if (editorView.getValue) item.current = editorView.getValue(); }
function onEdit() { syncEditorValue(); $('#saveStatus') && ($('#saveStatus').textContent = 'Unsaved local edit'); clearTimeout(saveTimer); saveTimer = setTimeout(() => saveCurrent(false), 350); clearTimeout(previewDebounce); previewDebounce = setTimeout(updatePreview, 450); }
function saveCurrent(manual) { if (!activeClass) return; syncEditorValue(); const out = { version: 2, files: {} }; for (const [rel, item] of files) if (!item.binary && isEditable(rel)) out.files[rel] = item.current ?? item.original ?? ''; localStorage.setItem(storageKey(activeClass.id || activeClass.slug), JSON.stringify(out)); if ($('#saveStatus')) $('#saveStatus').textContent = manual ? 'Saved locally' : 'Autosaved'; }
function loadStored(id) { try { return JSON.parse(localStorage.getItem(storageKey(id))); } catch { return null; } }
function localExists(id) { return !!localStorage.getItem(storageKey(id)); }
function storageKey(id) { return `future-web-lab:${id}`; }

async function resetProject() {
  if (!activeClass || !confirm('Reset this project to the original files? Your local edits will be removed.')) return;
  localStorage.removeItem(storageKey(activeClass.id || activeClass.slug));
  await loadProject(activeClass);
  if ($('#saveStatus')) $('#saveStatus').textContent = 'Restored original';
}

function updatePreview() {
  if (!activeClass) return;
  const htmlFile = activeClass.entry || [...files.keys()].find(r => /(^|\/)index\.html?$/i.test(r)) || [...files.keys()].find(r => /\.html?$/i.test(r));
  if (!htmlFile || !files.has(htmlFile)) return;
  let htmlText = files.get(htmlFile)?.current ?? files.get(htmlFile)?.original ?? '';
  htmlText = injectProject(htmlText, htmlFile);
  const blob = new Blob([htmlText], { type: 'text/html' });
  cleanupPreview(); previewObjectUrl = URL.createObjectURL(blob);
  const iframe = $('#previewFrame'); if (iframe) iframe.src = previewObjectUrl;
}

function injectProject(htmlText, entryFile) {
  const baseUrl = assetUrl('classes', activeClass.slug || activeClass.id) + (entryFile.includes('/') ? `/${entryFile.slice(0, entryFile.lastIndexOf('/') + 1)}` : '/');
  const absBase = new URL(baseUrl, document.baseURI).href;
  let out = htmlText.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeAttr(absBase)}">`);
  out = out.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, (m, a, src, b) => {
    const key = normalizePath(pathDir(entryFile), src); const f = files.get(key);
    return f && !f.binary ? `<script${a}${b}>\n${f.current ?? f.original ?? ''}\n<\/script>` : m.replace(src, resolveProjectUrl(entryFile, src));
  });
  out = out.replace(/<link\b([^>]*?)href=["']([^"']+\.css)["']([^>]*)>/gi, (m, a, href, b) => {
    const key = normalizePath(pathDir(entryFile), href); const f = files.get(key);
    return f && !f.binary ? `<style>\n${f.current ?? f.original ?? ''}\n</style>` : m.replace(href, resolveProjectUrl(entryFile, href));
  });
  out = out.replace(/\b(src|href)=["']([^"']+)["']/gi, (m, attr, val) => {
    if (/^(https?:|data:|blob:|#|mailto:|javascript:)/i.test(val)) return m;
    if (/^(\/\/|\/)/.test(val)) return m;
    return `${attr}="${escapeAttr(resolveProjectUrl(entryFile, val))}"`;
  });
  return out;
}

function resolveProjectUrl(entryFile, rel) { return new URL(rel, assetUrl('classes', activeClass.slug || activeClass.id, pathDir(entryFile) ? `${pathDir(entryFile)}/` : '')).href; }

async function downloadZip(edited) {
  if (!activeClass) return;
  try {
    const JSZip = await loadZip();
    const zip = new JSZip();
    const classId = activeClass.id || activeClass.slug;
    syncEditorValue();
    for (const [rel, item] of files) {
      if (rel === 'class.json') continue;
      if (item.binary) {
        const res = await fetch(item.url);
        if (res.ok) zip.file(rel, await res.blob());
      } else zip.file(rel, edited ? (item.current ?? item.original ?? '') : (item.original ?? ''));
    }
    zip.file('PROJECT-INFO.txt', `${activeClass.title || activeClass.name}\n${siteConfig.brand?.name || 'Web Lab'}\n\nGenerated by Web Lab.`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${classId}${edited ? '-my-version' : ''}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    alert(`ZIP export is temporarily unavailable: ${error.message}`);
  }
}

async function loadCodeMirror() {
  if (!cmModulesPromise) {
    cmModulesPromise = Promise.all(Object.entries(MODULES).filter(([k]) => k !== 'zip').map(async ([key, url]) => [key, await import(url)])).then(entries => {
      const o = Object.fromEntries(entries);
      return { state: o.state, view: o.view, commands: o.commands, language: o.language, html: o.html, css: o.css, javascript: o.javascript, autocomplete: o.autocomplete };
    });
  }
  return cmModulesPromise;
}
async function loadZip() { if (!zipModulePromise) zipModulePromise = import(MODULES.zip).then(m => m.default || m); return zipModulePromise; }

function showWorkspaceNotice(text) { $('.editor-shell')?.remove(); if (workspaceShell) workspaceShell.innerHTML = `<div class="workspace-empty"><div class="empty-icon">!</div><h3>Project needs attention</h3><p>${escapeHtml(text)}</p></div>`; }
function toggleFullscreen(el) { if (!el) return; if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.(); }
function onGlobalShortcut(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput?.focus(); } }
function isEditable(rel) { return /\.(html?|css|js|mjs|ts|json|md|svg)$/i.test(rel); }
function isBinary(rel) { return /\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|mp3|wav|ogg|m4a|woff2?|ttf|ico|pdf)$/i.test(rel); }
function extensionLabel(rel) { const e = rel.split('.').pop().toUpperCase(); return e === 'HTML' || e === 'HTM' ? 'HTML' : e === 'CSS' ? 'CSS' : /^(JS|MJS|TS)$/.test(e) ? 'JavaScript' : e; }
function fileIcon(rel) { if (/\.html?$/i.test(rel)) return '◈'; if (/\.css$/i.test(rel)) return '◌'; if (/\.(js|mjs|ts)$/i.test(rel)) return '✦'; if (/\.(png|jpe?g|webp|avif|svg|gif)$/i.test(rel)) return '▧'; if (/\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(rel)) return '◉'; return '·'; }
function pathDir(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function normalizePath(base, p) { const parts = (base ? `${base}/` : '').split('/').concat(String(p).split('/')); const out = []; for (const x of parts) { if (!x || x === '.') continue; if (x === '..') out.pop(); else out.push(x); } return out.join('/'); }
function escapeHtml(s = '') { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function escapeAttr(s = '') { return escapeHtml(s); }
function cleanupPreview() { if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; } }

boot();
