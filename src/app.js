const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  classes: [],
  siteConfig: {},
  activeClass: null,
  files: new Map(),
  activeFile: null,
  editorView: null,
  previewObjectUrl: null,
  saveTimer: null,
  previewTimer: null,
  currentFilter: 'All',
  cmPromise: null,
  zipPromise: null,
  resize: { files: 250, editor: 520 }
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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

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

function initials(name = 'Web Lab') {
  return String(name).split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 3).toUpperCase();
}

function storageKey(id) {
  return `future-web-lab:${id}`;
}

function loadStored(id) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id)) || 'null');
  } catch {
    return null;
  }
}

function hasLocalChanges(id) {
  return !!localStorage.getItem(storageKey(id));
}

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
  const filters = $('#filters');
  if (!filters) return;
  filters.innerHTML = categories.map(category => `
    <button type="button" class="filter ${category === state.currentFilter ? 'active' : ''}" data-filter="${escapeAttr(category)}">
      ${escapeHtml(category)}
    </button>`).join('');
  $$('.filter', filters).forEach(button => button.addEventListener('click', () => {
    state.currentFilter = button.dataset.filter || 'All';
    buildFilters();
    renderClasses();
  }));
}

function classSearchText(item) {
  return [item.id, item.slug, item.title, item.name, item.description, item.category, item.level, ...(Array.isArray(item.tags) ? item.tags : [])]
    .filter(Boolean).join(' ').toLowerCase();
}

function renderClasses() {
  const grid = $('#classGrid');
  if (!grid) return;
  const query = ($('#search')?.value || '').trim().toLowerCase();
  const visible = state.classes.filter(item => {
    const categoryMatch = state.currentFilter === 'All' || item.category === state.currentFilter;
    return categoryMatch && classSearchText(item).includes(query);
  });

  $('#classCount').textContent = String(state.classes.length);
  $('#libraryCount').textContent = String(visible.length);
  $('#libraryHint').textContent = visible.length === state.classes.length
    ? 'LIVE INDEX • AUTO UPDATED'
    : `${state.classes.length - visible.length} HIDDEN BY SEARCH / FILTER`;
  $('#emptyState').hidden = visible.length !== 0;

  grid.innerHTML = visible.map(cardTemplate).join('');
  $$('.class-card', grid).forEach(card => {
    let frame = 0;
    let pointX = 50;
    let pointY = 0;
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      pointX = event.clientX - rect.left;
      pointY = event.clientY - rect.top;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        card.style.setProperty('--mx', `${pointX}px`);
        card.style.setProperty('--my', `${pointY}px`);
        frame = 0;
      });
    }, { passive: true });
    card.addEventListener('click', () => openClass(card.dataset.id));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openClass(card.dataset.id);
      }
    });
  });
}

function cardTemplate(item) {
  const id = item.id || item.slug;
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 4) : [];
  const local = hasLocalChanges(id);
  return `<article class="class-card" tabindex="0" role="button" data-id="${escapeAttr(id)}" aria-label="Open ${escapeAttr(item.title || id)}">
    <div class="card-top">
      <span class="card-index">${escapeHtml(id)}</span>
      <span class="card-level">${escapeHtml(item.level || 'Project')}</span>
    </div>
    <div class="card-title-row">
      <div class="class-symbol" aria-hidden="true">&lt;/&gt;</div>
      <div>
        <h3>${escapeHtml(item.title || item.name || 'Untitled Project')}</h3>
        <span class="card-category">${escapeHtml(item.category || 'Web Development')}</span>
      </div>
    </div>
    <p>${escapeHtml(item.description || 'Hands-on web development project.')}</p>
    <div class="tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="card-bottom">
      <span>${local ? '<i class="saved-dot"></i> local version available' : 'open project workspace'}</span>
      <b aria-hidden="true">↗</b>
    </div>
  </article>`;
}

async function openClass(id) {
  clearTimeout(state.saveTimer);
  clearTimeout(state.previewTimer);
  const selected = state.classes.find(item => (item.id || item.slug) === id);
  if (!selected) return;
  cleanupEditor();
  cleanupPreview();
  state.activeClass = selected;
  location.hash = `workspace/${encodeURIComponent(selected.id || selected.slug)}`;
  $('#workspaceSubtitle').textContent = `${selected.title || selected.name || selected.slug} · edit, preview, experiment and export your version.`;
  $('#workspaceShell').innerHTML = workspaceTemplate(selected);
  setupWorkspace();
  await loadProject(selected);
  $('#workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function workspaceTemplate(item) {
  const id = item.id || item.slug;
  return `<div class="editor-shell" id="editorShell">
    <aside class="files-panel">
      <div class="panel-head">
        <div><span class="panel-eyebrow">PROJECT</span><strong title="${escapeAttr(id)}">${escapeHtml(id)}</strong></div>
        <button class="icon-btn" data-action="files-toggle" aria-label="Hide files" title="Hide files">≡</button>
      </div>
      <div class="file-toolbar">
        <span id="fileCount">0 files</span>
        <span class="file-dot"></span>
        <span>LOCAL</span>
      </div>
      <div class="file-list" id="fileList"></div>
    </aside>
    <div class="splitter" data-split="files" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize files panel"></div>

    <section class="editor-panel">
      <div class="toolbar workspace-toolbar">
        <div class="toolbar-group">
          <button class="tool-btn" data-action="files-toggle">Files</button>
          <button class="tool-btn primary-tool" data-action="save">Save</button>
          <button class="tool-btn" data-action="reset">Reset</button>
          <button class="tool-btn" data-action="undo">Undo</button>
          <button class="tool-btn" data-action="redo">Redo</button>
        </div>
        <div class="toolbar-file" id="activeFileLabel">Select a file</div>
        <div class="toolbar-group">
          <button class="tool-btn" data-action="editor-full">Editor ⛶</button>
          <button class="tool-btn mobile-preview-toggle" data-action="preview-mode">Preview</button>
        </div>
      </div>
      <div class="editor-wrap"><div class="code-host" id="codeHost"><div class="editor-loading">Choose a file to begin…</div></div></div>
      <div class="statusbar">
        <div><span class="status-dot"></span><span id="saveStatus">Ready</span></div>
        <div><span id="languageStatus">—</span><span class="status-divider"></span><span>CTRL/CMD K Search</span></div>
      </div>
    </section>
    <div class="splitter" data-split="editor" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize editor panel"></div>

    <section class="preview-panel">
      <div class="toolbar">
        <div class="toolbar-group"><span class="live-badge"><i></i> LIVE PREVIEW</span></div>
        <div class="toolbar-group">
          <button class="tool-btn mobile-code-toggle" data-action="preview-mode">Code</button>
          <button class="tool-btn" data-action="refresh">Refresh</button>
          <button class="tool-btn" data-action="preview-full">Preview ⛶</button>
          <button class="tool-btn" data-action="download-original">Original ZIP</button>
          <button class="tool-btn primary-tool" data-action="download">My ZIP</button>
        </div>
      </div>
      <div class="preview-wrap">
        <div class="preview-frame-head"><span>localhost / ${escapeHtml(id)}</span><span id="previewState">READY</span></div>
        <iframe id="previewFrame" title="Live project preview" sandbox="allow-scripts allow-forms allow-modals"></iframe>
      </div>
    </section>
  </div>`;
}

function setupWorkspace() {
  const root = $('#workspaceShell');
  if (!root) return;
  const actions = {
    save: () => saveCurrent(true),
    reset: () => resetProject(),
    undo: () => state.editorView && window.__cm?.undo?.(state.editorView),
    redo: () => state.editorView && window.__cm?.redo?.(state.editorView),
    refresh: () => updatePreview(),
    download: () => downloadZip(true),
    'download-original': () => downloadZip(false),
    'editor-full': () => toggleFullscreen($('.editor-panel')),
    'preview-full': () => toggleFullscreen($('.preview-panel')),
    'preview-mode': () => $('#editorShell')?.classList.toggle('preview-mode'),
    'files-toggle': () => $('#editorShell')?.classList.toggle('files-hidden')
  };
  Object.entries(actions).forEach(([name, handler]) => root.querySelector(`[data-action="${name}"]`)?.addEventListener('click', handler));
  setupSplitters();
}

function setupSplitters() {
  const shell = $('#editorShell');
  if (!shell) return;
  const available = shell.getBoundingClientRect().width;
  if (available && available < 1120 && available > 900) {
    state.resize.files = Math.max(200, Math.min(230, Math.round(available * 0.22)));
    state.resize.editor = Math.max(360, Math.round((available - state.resize.files - 12) / 2));
  }
  shell.style.setProperty('--files-width', `${state.resize.files}px`);
  shell.style.setProperty('--editor-width', `${state.resize.editor}px`);
  $$('.splitter', shell).forEach(splitter => {
    splitter.addEventListener('pointerdown', startSplitDrag);
    splitter.addEventListener('dblclick', () => {
      const width = shell.getBoundingClientRect().width;
      state.resize.files = width < 1120 ? Math.max(200, Math.min(230, Math.round(width * 0.22))) : 250;
      state.resize.editor = width < 1120
        ? Math.max(360, Math.round((width - state.resize.files - 12) / 2))
        : 520;
      shell.style.setProperty('--files-width', `${state.resize.files}px`);
      shell.style.setProperty('--editor-width', `${state.resize.editor}px`);
    });
  });
}

function startSplitDrag(event) {
  const shell = $('#editorShell');
  const kind = event.currentTarget.dataset.split;
  if (!shell || window.matchMedia('(max-width: 900px)').matches) return;
  event.preventDefault();
  const rect = shell.getBoundingClientRect();
  const move = moveEvent => {
    const x = Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left));
    if (kind === 'files') {
      state.resize.files = Math.round(Math.max(220, Math.min(360, x)));
      shell.style.setProperty('--files-width', `${state.resize.files}px`);
      return;
    }
    const available = rect.width - state.resize.files - 12;
    const editor = Math.round(Math.max(360, Math.min(available - 360, x - state.resize.files - 8)));
    state.resize.editor = editor;
    shell.style.setProperty('--editor-width', `${editor}px`);
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop, { once: true });
  window.addEventListener('pointercancel', stop, { once: true });
}

async function loadProject(item) {
  state.files.clear();
  state.activeFile = null;
  cleanupEditor();
  const id = item.id || item.slug;
  const stored = loadStored(id);
  const list = Array.isArray(item.files) ? item.files : [];
  if (!list.length) {
    showWorkspaceNotice('No project files were indexed. Add files to the class folder and rebuild.');
    return;
  }

  await Promise.all(list.map(async relative => {
    const url = assetUrl('classes', item.slug || id, relative);
    try {
      if (isBinary(relative)) {
        state.files.set(relative, { binary: true, url });
        return;
      }
      const response = await fetch(url, { cache: 'default' });
      if (!response.ok) {
        state.files.set(relative, { binary: false, url, error: response.status });
        return;
      }
      const original = await response.text();
      state.files.set(relative, { binary: false, url, original, current: stored?.files?.[relative] ?? original });
    } catch (error) {
      state.files.set(relative, { binary: isBinary(relative), url, error: error.message });
    }
  }));

  const editable = [...state.files.entries()]
    .filter(([, entry]) => !entry.binary && !entry.error && typeof entry.original === 'string')
    .map(([relative]) => relative);
  renderFileList();
  $('#fileCount').textContent = `${state.files.size} file${state.files.size === 1 ? '' : 's'}`;

  if (!editable.length) {
    showWorkspaceNotice('This project has no editable source files.');
    return;
  }

  const preferred = item.entry && state.files.has(item.entry) && !state.files.get(item.entry)?.binary
    ? item.entry
    : editable.find(file => /(^|\/)index\.html?$/i.test(file)) || editable[0];
  await selectFile(preferred);
  updatePreview();
}

function renderFileList() {
  const container = $('#fileList');
  if (!container) return;
  const sorted = [...state.files.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  container.innerHTML = sorted.map(relative => {
    const item = state.files.get(relative);
    const unavailable = item?.error ? ' unavailable' : '';
    const binary = item?.binary ? ' binary' : '';
    const active = relative === state.activeFile ? ' active' : '';
    const segments = relative.split('/');
    const depth = segments.length - 1;
    return `<button type="button" class="file-btn${active}${binary}${unavailable}" data-file="${escapeAttr(relative)}" style="--depth:${depth}" title="${escapeAttr(relative)}" ${item?.binary || item?.error ? 'aria-disabled="true"' : ''}>
      <span class="file-icon">${fileIcon(relative)}</span><span class="file-name">${escapeHtml(relative)}</span>
    </button>`;
  }).join('');
  $$('.file-btn', container).forEach(button => button.addEventListener('click', () => {
    if (!button.classList.contains('binary') && !button.classList.contains('unavailable')) selectFile(button.dataset.file);
  }));
}

async function selectFile(relative) {
  const item = state.files.get(relative);
  if (!item || item.binary || item.error) return;
  syncEditorValue();
  state.activeFile = relative;
  renderFileList();
  $('#activeFileLabel').textContent = relative;
  $('#languageStatus').textContent = extensionLabel(relative);
  const host = $('#codeHost');
  if (!host) return;
  cleanupEditor();
  host.innerHTML = '<div class="editor-loading"><span></span> Preparing smart editor…</div>';
  try {
    const cm = await loadCodeMirror();
    createCodeMirrorEditor(cm, host, relative, item.current ?? item.original ?? '');
    $('#saveStatus').textContent = hasLocalChanges(state.activeClass.id || state.activeClass.slug) ? 'Local version available' : 'Original project';
  } catch {
    createFallbackEditor(host, item.current ?? item.original ?? '');
    $('#saveStatus').textContent = 'Fallback editor mode';
  }
}

function createCodeMirrorEditor(cm, host, relative, value) {
  const language = /\.html?$/i.test(relative)
    ? cm.html.html()
    : /\.css$/i.test(relative)
      ? cm.css.css()
      : /\.(js|mjs|ts)$/i.test(relative)
        ? cm.javascript.javascript({ typescript: /\.ts$/i.test(relative) })
        : [];
  const extensions = [
    cm.view.lineNumbers(),
    cm.view.highlightActiveLine(),
    cm.view.highlightActiveLineGutter(),
    cm.view.drawSelection(),
    cm.commands.history(),
    cm.view.keymap.of([
      ...cm.commands.defaultKeymap,
      ...cm.commands.historyKeymap,
      cm.commands.indentWithTab,
      ...cm.autocomplete.completionKeymap,
      ...cm.language.closeBracketsKeymap
    ]),
    cm.language.bracketMatching(),
    cm.language.closeBrackets(),
    cm.language.foldGutter(),
    cm.language.indentOnInput(),
    cm.language.syntaxHighlighting(cm.language.defaultHighlightStyle, { fallback: true }),
    cm.autocomplete.autocompletion({ activateOnTyping: true }),
    language,
    cm.view.EditorView.updateListener.of(update => {
      if (update.docChanged) onEdit();
    })
  ];
  state.editorView = new cm.view.EditorView({
    state: cm.state.EditorState.create({ doc: value, extensions }),
    parent: host
  });
  window.__cm = { undo: cm.commands.undo, redo: cm.commands.redo };
}

function createFallbackEditor(host, value) {
  const textarea = document.createElement('textarea');
  textarea.className = 'fallback-editor';
  textarea.value = value;
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.addEventListener('input', () => onEdit());
  host.innerHTML = '';
  host.appendChild(textarea);
  state.editorView = {
    fallback: true,
    getValue: () => textarea.value,
    setValue: next => { textarea.value = next; }
  };
}

function cleanupEditor() {
  state.editorView?.destroy?.();
  state.editorView = null;
}

function syncEditorValue() {
  if (!state.editorView || !state.activeFile) return;
  const item = state.files.get(state.activeFile);
  if (!item) return;
  item.current = state.editorView.state
    ? state.editorView.state.doc.toString()
    : state.editorView.getValue?.() ?? item.current;
}

function onEdit() {
  syncEditorValue();
  $('#saveStatus') && ($('#saveStatus').textContent = 'Unsaved local edit');
  clearTimeout(state.saveTimer);
  clearTimeout(state.previewTimer);
  const targetId = state.activeClass?.id || state.activeClass?.slug;
  state.saveTimer = setTimeout(() => {
    if ((state.activeClass?.id || state.activeClass?.slug) === targetId) saveCurrent(false);
  }, 450);
  $('#previewState') && ($('#previewState').textContent = 'UPDATING…');
  state.previewTimer = setTimeout(() => {
    if ((state.activeClass?.id || state.activeClass?.slug) === targetId) updatePreview();
  }, 400);
}

function saveCurrent(manual = false) {
  if (!state.activeClass) return;
  syncEditorValue();
  const payload = { version: 3, updatedAt: new Date().toISOString(), files: {} };
  for (const [relative, item] of state.files) {
    if (!item.binary && !item.error && isEditable(relative)) payload.files[relative] = item.current ?? item.original ?? '';
  }
  try {
    localStorage.setItem(storageKey(state.activeClass.id || state.activeClass.slug), JSON.stringify(payload));
    $('#saveStatus') && ($('#saveStatus').textContent = manual ? 'Saved locally' : 'Autosaved');
    renderClasses();
  } catch (error) {
    $('#saveStatus') && ($('#saveStatus').textContent = 'Local save unavailable');
    showToast('Could not save locally. Browser storage may be full.');
  }
}

async function resetProject() {
  if (!state.activeClass) return;
  clearTimeout(state.saveTimer);
  clearTimeout(state.previewTimer);
  const id = state.activeClass.id || state.activeClass.slug;
  if (!confirm('Reset this project to the original files? Your local edits will be removed.')) return;
  localStorage.removeItem(storageKey(id));
  await loadProject(state.activeClass);
  $('#saveStatus') && ($('#saveStatus').textContent = 'Original project restored');
  showToast('Project reset to the original version.');
}

function updatePreview() {
  if (!state.activeClass) return;
  syncEditorValue();
  const htmlFile = state.activeClass.entry && state.files.has(state.activeClass.entry)
    ? state.activeClass.entry
    : [...state.files.keys()].find(file => /(^|\/)index\.html?$/i.test(file));
  if (!htmlFile) return;
  const html = injectProject(state.files.get(htmlFile)?.current ?? state.files.get(htmlFile)?.original ?? '', htmlFile);
  cleanupPreview();
  const frame = $('#previewFrame');
  if (frame) {
    frame.srcdoc = html;
    frame.title = `${state.activeClass.title || state.activeClass.id || 'Project'} live preview`;
  }
  $('#previewState') && ($('#previewState').textContent = 'LIVE');
}

function projectRootUrl() {
  const id = state.activeClass.slug || state.activeClass.id;
  return assetUrl('classes', id) + '/';
}

function resolveProjectUrl(entryFile, relative) {
  const entryBase = new URL(pathDir(entryFile) ? `${pathDir(entryFile)}/` : './', projectRootUrl());
  return new URL(relative, entryBase).href;
}

function injectProject(source, entryFile) {
  const root = projectRootUrl();
  const base = new URL(pathDir(entryFile) ? `${pathDir(entryFile)}/` : './', root).href;
  let output = source.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeAttr(base)}">`);
  output = output.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
    const key = normalizePath(pathDir(entryFile), src);
    const file = state.files.get(key);
    if (file && !file.binary && !file.error) return `<script${before}${after}>\n${file.current ?? file.original ?? ''}\n<\/script>`;
    return match.replace(src, resolveProjectUrl(entryFile, src));
  });
  output = output.replace(/<link\b([^>]*?)href=["']([^"']+\.css(?:\?[^"']*)?)["']([^>]*)>/gi, (match, before, href, after) => {
    const cleanHref = href.split('?')[0];
    const key = normalizePath(pathDir(entryFile), cleanHref);
    const file = state.files.get(key);
    if (file && !file.binary && !file.error) return `<style>\n${file.current ?? file.original ?? ''}\n</style>`;
    return match.replace(href, resolveProjectUrl(entryFile, href));
  });
  output = output.replace(/\b(src|href)=["']([^"']+)["']/gi, (match, attr, value) => {
    if (/^(https?:|data:|blob:|#|mailto:|javascript:|\/\/|\/)/i.test(value)) return match;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return match;
    return `${attr}="${escapeAttr(resolveProjectUrl(entryFile, value))}"`;
  });
  return output;
}

async function loadCodeMirror() {
  if (!state.cmPromise) {
    state.cmPromise = Promise.all(Object.entries(MODULES).filter(([key]) => key !== 'zip').map(async ([key, url]) => [key, await import(url)]))
      .then(entries => {
        const modules = Object.fromEntries(entries);
        return {
          state: modules.state,
          view: modules.view,
          commands: modules.commands,
          language: modules.language,
          html: modules.html,
          css: modules.css,
          javascript: modules.javascript,
          autocomplete: modules.autocomplete
        };
      });
  }
  return state.cmPromise;
}

async function loadZip() {
  if (!state.zipPromise) state.zipPromise = import(MODULES.zip).then(module => module.default || module);
  return state.zipPromise;
}

async function downloadZip(edited) {
  if (!state.activeClass) return;
  try {
    const JSZip = await loadZip();
    const zip = new JSZip();
    const id = state.activeClass.id || state.activeClass.slug;
    syncEditorValue();
    for (const [relative, item] of state.files) {
      if (relative === 'class.json' || item.error) continue;
      if (item.binary) {
        const response = await fetch(item.url, { cache: 'no-store' });
        if (response.ok) zip.file(relative, await response.arrayBuffer());
      } else {
        zip.file(relative, edited ? (item.current ?? item.original ?? '') : (item.original ?? ''));
      }
    }
    zip.file('PROJECT-INFO.txt', `${state.activeClass.title || id}\n${state.siteConfig.brand?.name || 'Obaid Web Lab'}\n\nGenerated by the Web Lab browser workspace.`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(id)}${edited ? '-my-version' : ''}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(edited ? 'Your edited project is ready.' : 'Original project ZIP is ready.');
  } catch (error) {
    showToast(`ZIP export unavailable: ${error.message}`);
  }
}

function showWorkspaceNotice(message) {
  cleanupEditor();
  $('#workspaceShell').innerHTML = `<div class="workspace-empty error-state"><div class="empty-core"><span>!</span><i></i></div><p class="eyebrow">PROJECT CHECK</p><h3>Workspace needs attention</h3><p>${escapeHtml(message)}</p><a class="button primary small" href="#classes">Back to projects →</a></div>`;
}

function toggleFullscreen(element) {
  if (!element) return;
  if (!document.fullscreenElement) element.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function onGlobalShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#search')?.focus();
    $('#search')?.select();
  }
}

function isEditable(relative) {
  return /\.(html?|css|js|mjs|ts|json|md|svg)$/i.test(relative);
}

function isBinary(relative) {
  return /\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|mp3|wav|ogg|m4a|woff2?|ttf|otf|ico|pdf|zip)$/i.test(relative);
}

function extensionLabel(relative) {
  const extension = relative.split('.').pop()?.toUpperCase() || 'FILE';
  if (extension === 'HTM' || extension === 'HTML') return 'HTML';
  if (extension === 'CSS') return 'CSS';
  if (/^(JS|MJS|TS)$/.test(extension)) return 'JavaScript';
  return extension;
}

function fileIcon(relative) {
  if (/\.html?$/i.test(relative)) return '◇';
  if (/\.css$/i.test(relative)) return '◌';
  if (/\.(js|mjs|ts)$/i.test(relative)) return '✦';
  if (/\.(png|jpe?g|webp|avif|svg|gif)$/i.test(relative)) return '▧';
  if (/\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(relative)) return '◉';
  return '·';
}

function pathDir(relative) {
  const index = relative.lastIndexOf('/');
  return index === -1 ? '' : relative.slice(0, index);
}

function normalizePath(base, value) {
  const parts = (base ? `${base}/` : '').split('/').concat(String(value).split('/'));
  const output = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') output.pop();
    else output.push(part);
  }
  return output.join('/');
}

function slugify(value) {
  return String(value).trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project';
}

function cleanupPreview() {
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = null;
  }
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function boot() {
  try {
    const [classes, config] = await Promise.all([
      getJSON('classes.json'),
      getJSON('site.config.json').catch(() => ({}))
    ]);
    if (!Array.isArray(classes)) throw new Error('classes.json must contain an array.');
    state.classes = classes;
    state.siteConfig = config || {};
    applyBrand();
    buildFilters();
    renderClasses();
    let searchTimer = 0;
    $('#search')?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderClasses, 60);
    });
    window.addEventListener('keydown', onGlobalShortcut);
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#workspace/')) {
        const id = decodeURIComponent(location.hash.slice('#workspace/'.length));
        if ((state.activeClass?.id || state.activeClass?.slug) !== id) openClass(id);
      }
    });
    window.addEventListener('beforeunload', () => {
      clearTimeout(state.saveTimer);
      clearTimeout(state.previewTimer);
      cleanupEditor();
      cleanupPreview();
    });
    if (location.hash.startsWith('#workspace/')) {
      const id = decodeURIComponent(location.hash.slice('#workspace/'.length));
      await openClass(id);
    }
  } catch (error) {
    $('#classGrid').innerHTML = `<div class="empty"><strong>Project library unavailable.</strong><br>${escapeHtml(error.message)}</div>`;
  }
}

boot();
