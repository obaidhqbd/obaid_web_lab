const $ = (selector, root = document) => root.querySelector(selector);

const els = {
  grid: $('#classGrid'),
  filters: $('#filters'),
  workspace: $('#workspaceShell'),
  search: $('#search'),
  empty: $('#emptyState'),
  classCount: $('#classCount'),
  libraryCount: $('#libraryCount'),
  workspaceSubtitle: $('#workspaceSubtitle')
};

let classes = [];
let siteConfig = {};
let activeClass = null;
let files = new Map();
let activeFile = null;
let editorView = null;
let editorApi = null;
let previewObjectUrl = null;
let saveTimer = null;
let previewTimer = null;
let currentFilter = 'All';
let cmPromise = null;
let zipPromise = null;

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

function getJSON(path) {
  return fetch(path, { cache: 'no-cache' }).then(res => {
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return res.json();
  });
}

function assetUrl(...parts) {
  const safe = parts
    .filter(Boolean)
    .flatMap(part => String(part).split('/'))
    .filter(Boolean)
    .map(encodeURIComponent);
  return new URL(safe.join('/'), document.baseURI).href;
}

async function boot() {
  try {
    const [index, config] = await Promise.all([
      getJSON('classes.json'),
      getJSON('site.config.json').catch(() => ({}))
    ]);
    if (!Array.isArray(index)) throw new Error('classes.json must contain an array.');
    classes = normalizeClasses(index);
    siteConfig = config || {};
    applyBrand();
    buildFilters();
    renderClasses();
    bindGlobalEvents();
    handleHash();
  } catch (error) {
    showFatal(error);
  }
}

function normalizeClasses(list) {
  return list
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      ...item,
      id: String(item.id || item.slug || ''),
      slug: String(item.slug || item.id || ''),
      title: String(item.title || item.name || humanize(item.slug || item.id || 'Project')),
      description: String(item.description || 'Hands-on web development project.'),
      category: String(item.category || 'Web Development'),
      level: String(item.level || 'Beginner'),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      files: Array.isArray(item.files) ? item.files.map(String).filter(Boolean) : [],
      entry: String(item.entry || '')
    }))
    .filter(item => item.id && item.slug);
}

function applyBrand() {
  const brand = siteConfig.brand || {};
  const name = brand.name || 'Obaid Web Lab';
  const role = brand.role || 'Web Development Mentor';
  const tagline = brand.tagline || 'Learn. Code. Experiment. Build.';
  const description = brand.description || 'A hands-on coding environment where every project becomes a real thing you can edit, preview and take home.';
  const shortName = brand.shortName || initials('Mohammed Obaidul Hoque');

  $('#brandName') && ($('#brandName').textContent = name);
  $('#brandRole') && ($('#brandRole').textContent = role);
  $('#brandTagline') && ($('#brandTagline').textContent = tagline);
  $('#brandDescription') && ($('#brandDescription').textContent = description);
  $('#brandMark') && ($('#brandMark').textContent = shortName);
  document.title = `${name} · ${role}`;
}

function initials(value) {
  return String(value).split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase();
}

function bindGlobalEvents() {
  els.search?.addEventListener('input', renderClasses);
  window.addEventListener('keydown', globalShortcut);
  window.addEventListener('hashchange', handleHash);
  window.addEventListener('beforeunload', cleanupPreview);
}

function globalShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    els.search?.focus();
    els.search?.select();
  }
}

function buildFilters() {
  if (!els.filters) return;
  const categories = ['All', ...new Set(classes.map(item => item.category).filter(Boolean))];
  els.filters.innerHTML = categories.map(category => `
    <button type="button" class="filter ${category === currentFilter ? 'active' : ''}" data-filter="${escapeAttr(category)}">
      ${escapeHtml(category)}
    </button>
  `).join('');
  els.filters.querySelectorAll('.filter').forEach(button => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter || 'All';
      buildFilters();
      renderClasses();
    });
  });
}

function renderClasses() {
  if (!els.grid) return;
  const query = els.search?.value.trim().toLowerCase() || '';
  const visible = classes.filter(item => {
    const haystack = [
      item.id, item.slug, item.title, item.name, item.description,
      item.category, item.level, ...(item.tags || [])
    ].join(' ').toLowerCase();
    return (currentFilter === 'All' || item.category === currentFilter) && haystack.includes(query);
  });

  els.classCount && (els.classCount.textContent = String(classes.length));
  els.libraryCount && (els.libraryCount.textContent = String(visible.length));
  if (els.empty) els.empty.hidden = visible.length > 0;

  els.grid.innerHTML = visible.map(classCard).join('');
  els.grid.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
    card.addEventListener('click', () => openClass(card.dataset.id));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openClass(card.dataset.id);
      }
    });
  });
}

function classCard(item) {
  const id = item.id || item.slug;
  return `
    <article class="class-card" tabindex="0" role="button" data-id="${escapeAttr(id)}" aria-label="Open ${escapeAttr(item.title)}">
      <div class="card-top">
        <span class="card-id">${escapeHtml(id)}</span>
        <span class="card-level">${escapeHtml(item.level)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="tags">
        ${(item.tags || []).slice(0, 5).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="card-bottom">
        <span>${escapeHtml(item.category)} · ${escapeHtml(item.duration || 'Self-paced')}</span>
        <b aria-hidden="true">→</b>
      </div>
    </article>
  `;
}

function handleHash() {
  const match = location.hash.match(/^#workspace\/(.+)$/);
  if (match) openClass(decodeURIComponent(match[1]), false);
}

async function openClass(id, updateHash = true) {
  const target = classes.find(item => item.id === id || item.slug === id);
  if (!target) return;
  activeClass = target;
  if (updateHash) history.replaceState(null, '', `#workspace/${encodeURIComponent(target.id)}`);
  if (els.workspaceSubtitle) els.workspaceSubtitle.textContent = `${target.title} · edit, preview and export your version.`;
  if (els.workspace) els.workspace.innerHTML = workspaceTemplate(target);
  setupWorkspace();
  await loadProject(target);
  $('#workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function workspaceTemplate(item) {
  return `
    <div class="editor-shell" id="editorShell">
      <aside class="files-panel">
        <div class="panel-head">
          <span>PROJECT FILES</span>
          <span class="project-title" title="${escapeAttr(item.slug)}">${escapeHtml(item.slug)}</span>
        </div>
        <div class="file-list" id="fileList"></div>
      </aside>

      <div class="splitter" data-split="files" role="separator" aria-label="Resize project files panel"></div>

      <section class="editor-panel">
        <div class="toolbar">
          <button class="tool-btn tool-btn--accent" data-action="save">Save</button>
          <button class="tool-btn" data-action="reset">Reset</button>
          <button class="tool-btn" data-action="undo">Undo</button>
          <button class="tool-btn" data-action="redo">Redo</button>
          <span class="toolbar-spacer"></span>
          <button class="tool-btn" data-action="editor-full">Editor ⛶</button>
          <button class="tool-btn" data-action="preview-mode">Preview only</button>
        </div>
        <div class="editor-wrap"><div class="code-host" id="codeHost"></div></div>
        <div class="statusbar">
          <span class="status-dot"></span>
          <span id="saveStatus">Ready</span>
          <span id="languageStatus">—</span>
        </div>
      </section>

      <div class="splitter" data-split="editor" role="separator" aria-label="Resize code editor panel"></div>

      <section class="preview-panel">
        <div class="toolbar">
          <span class="project-title">LIVE PREVIEW</span>
          <span class="toolbar-spacer"></span>
          <button class="tool-btn" data-action="refresh">Refresh</button>
          <button class="tool-btn" data-action="preview-full">Preview ⛶</button>
          <button class="tool-btn" data-action="download-original">Original ZIP</button>
          <button class="tool-btn tool-btn--accent" data-action="download">My ZIP</button>
        </div>
        <div class="preview-wrap">
          <iframe id="previewFrame" title="Live project preview" sandbox="allow-scripts allow-forms allow-modals"></iframe>
        </div>
      </section>
    </div>
  `;
}

function setupWorkspace() {
  const root = $('#workspaceShell');
  if (!root) return;
  root.querySelector('[data-action="save"]').onclick = () => saveCurrent(true);
  root.querySelector('[data-action="reset"]').onclick = resetProject;
  root.querySelector('[data-action="undo"]').onclick = () => editorApi?.undo?.(editorView);
  root.querySelector('[data-action="redo"]').onclick = () => editorApi?.redo?.(editorView);
  root.querySelector('[data-action="refresh"]').onclick = updatePreview;
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
    splitter.addEventListener('pointerdown', beginSplit);
    splitter.addEventListener('dblclick', () => {
      shell.style.removeProperty('--files-width');
      shell.style.removeProperty('--editor-width');
    });
  });
}

function beginSplit(event) {
  const shell = $('#editorShell');
  if (!shell || window.matchMedia('(max-width: 760px)').matches) return;
  event.preventDefault();
  const kind = event.currentTarget.dataset.split;
  const rect = shell.getBoundingClientRect();
  const startX = event.clientX;
  const startingFiles = parseFloat(getComputedStyle(shell).getPropertyValue('--files-width')) || 270;
  const startingEditor = parseFloat(getComputedStyle(shell).getPropertyValue('--editor-width')) || 460;

  const move = current => {
    const dx = current.clientX - startX;
    if (kind === 'files') {
      shell.style.setProperty('--files-width', `${Math.max(220, Math.min(370, startingFiles + dx))}px`);
    } else {
      const next = Math.max(330, Math.min(rect.width - 220 - startingFiles - 24, startingEditor + dx));
      shell.style.setProperty('--editor-width', `${next}px`);
    }
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

async function loadProject(project) {
  cleanupEditor();
  files.clear();
  activeFile = null;

  const stored = loadStored(project.id || project.slug);
  const fileList = Array.isArray(project.files) ? project.files : [];
  if (!fileList.length) {
    showWorkspaceNotice('This project has no indexed files yet. Rebuild the website and try again.');
    return;
  }

  for (const relative of fileList) {
    const url = assetUrl('classes', project.slug || project.id, relative);
    const binary = isBinary(relative);
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(String(response.status));
      if (binary) {
        files.set(relative, { binary: true, url, original: null, current: null });
      } else {
        const original = await response.text();
        const saved = stored?.files?.[relative];
        files.set(relative, { binary: false, url, original, current: saved != null ? saved : original });
      }
    } catch (error) {
      files.set(relative, { binary, url, original: null, current: null, error: error.message });
    }
  }

  const editable = [...files.entries()]
    .filter(([, item]) => !item.binary && item.original != null && isEditable)
    .map(([relative]) => relative);

  renderFileList();
  const initial = selectEntry(project, editable);
  if (!initial) {
    showWorkspaceNotice('No editable source files were found in this project.');
    return;
  }
  await selectFile(initial);
  updatePreview();
}

function selectEntry(project, editable) {
  if (project.entry && editable.includes(project.entry)) return project.entry;
  return editable.find(path => /(^|\/)index\.html?$/i.test(path)) ||
         editable.find(path => /\.html?$/i.test(path)) ||
         editable[0];
}

function renderFileList() {
  const el = $('#fileList');
  if (!el) return;
  const sorted = [...files.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  el.innerHTML = sorted.map(relative => {
    const item = files.get(relative);
    const classes = [
      'file-btn',
      item.binary ? 'binary' : '',
      item.error ? 'unavailable' : '',
      relative === activeFile ? 'active' : ''
    ].filter(Boolean).join(' ');
    return `
      <button type="button" class="${classes}" data-file="${escapeAttr(relative)}" ${item.binary || item.error ? 'aria-disabled="true"' : ''}>
        <span class="file-icon">${fileIcon(relative)}</span>
        <span title="${escapeAttr(relative)}">${escapeHtml(relative)}</span>
      </button>
    `;
  }).join('');
  el.querySelectorAll('.file-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (!button.classList.contains('binary') && !button.classList.contains('unavailable')) selectFile(button.dataset.file);
    });
  });
}

async function selectFile(relative) {
  const item = files.get(relative);
  if (!item || item.binary || item.original == null) return;
  syncEditorValue();
  activeFile = relative;
  renderFileList();

  const host = $('#codeHost');
  if (!host) return;
  cleanupEditor();
  host.innerHTML = '<div class="editor-loading">Opening smart editor…</div>';
  $('#languageStatus') && ($('#languageStatus').textContent = extensionLabel(relative));

  try {
    const cm = await loadCodeMirror();
    createCodeMirrorEditor(cm, host, relative, item.current || '');
    setStatus(loadStored(activeClass.id || activeClass.slug) ? 'Local changes available' : 'Original project');
  } catch (error) {
    createFallbackEditor(host, item.current || '');
    setStatus('Fallback editor · network editor unavailable');
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

  editorView = new cm.view.EditorView({
    state: cm.state.EditorState.create({ doc: value, extensions }),
    parent: host
  });

  editorApi = {
    undo: cm.commands.undo,
    redo: cm.commands.redo
  };
}

function createFallbackEditor(host, value) {
  const textarea = document.createElement('textarea');
  textarea.className = 'fallback-editor';
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.value = value;
  textarea.addEventListener('input', () => {
    syncEditorValue();
    onEdit();
  });
  host.innerHTML = '';
  host.appendChild(textarea);
  editorView = {
    fallback: true,
    getValue: () => textarea.value,
    destroy: () => {},
    focus: () => textarea.focus()
  };
  editorApi = null;
}

function syncEditorValue() {
  if (!editorView || !activeFile) return;
  const item = files.get(activeFile);
  if (!item) return;
  if (editorView.state?.doc) item.current = editorView.state.doc.toString();
  else if (editorView.getValue) item.current = editorView.getValue();
}

function onEdit() {
  syncEditorValue();
  setStatus('Unsaved local edit');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveCurrent(false), 300);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
}

function saveCurrent(manual = false) {
  if (!activeClass) return;
  syncEditorValue();
  const saved = { version: 3, files: {} };
  for (const [relative, item] of files) {
    if (!item.binary && item.original != null && isEditable(relative)) {
      saved.files[relative] = item.current ?? item.original;
    }
  }
  try {
    localStorage.setItem(storageKey(activeClass.id || activeClass.slug), JSON.stringify(saved));
    setStatus(manual ? 'Saved locally' : 'Autosaved');
  } catch {
    setStatus('Edited · local storage full');
  }
}

function loadStored(id) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id)));
  } catch {
    return null;
  }
}

function resetProject() {
  if (!activeClass || !confirm('Reset this project to the original files? Local edits will be removed.')) return;
  localStorage.removeItem(storageKey(activeClass.id || activeClass.slug));
  loadProject(activeClass);
}

function updatePreview() {
  if (!activeClass) return;
  syncEditorValue();
  const entry = selectEntry(activeClass, [...files.keys()].filter(relative => !files.get(relative)?.binary && files.get(relative)?.original != null && isEditable(relative)));
  if (!entry) return;

  let html = files.get(entry)?.current ?? files.get(entry)?.original ?? '';
  html = injectProject(html, entry);
  cleanupPreview();

  const blob = new Blob([html], { type: 'text/html' });
  previewObjectUrl = URL.createObjectURL(blob);
  const iframe = $('#previewFrame');
  if (iframe) iframe.src = previewObjectUrl;
}

function injectProject(source, entryFile) {
  const classRoot = assetUrl('classes', activeClass.slug || activeClass.id) + '/';
  const entryDirectory = pathDir(entryFile);
  const baseHref = new URL(entryDirectory ? `${classRoot}${entryDirectory}/` : classRoot, document.baseURI).href;

  let html = source;
  html = html.replace(/<head(\s[^>]*)?>/i, match => `${match}<base href="${escapeAttr(baseHref)}">`);

  html = html.replace(/<link\b([^>]*?)href=["']([^"']+\.css(?:\?[^"']*)?)["']([^>]*)>/gi,
    (match, before, href, after) => {
      const key = normalizePath(entryDirectory, href.split('?')[0]);
      const file = files.get(key);
      return file && !file.binary ? `<style>\n${file.current ?? file.original ?? ''}\n</style>` : match.replace(href, resolveProjectUrl(entryFile, href));
    });

  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (match, before, src, after) => {
      const clean = src.split('?')[0];
      const key = normalizePath(entryDirectory, clean);
      const file = files.get(key);
      return file && !file.binary ? `<script${before}${after}>\n${file.current ?? file.original ?? ''}\n<\/script>` : match.replace(src, resolveProjectUrl(entryFile, src));
    });

  html = html.replace(/\b(src|href)=["']([^"']+)["']/gi, (match, attribute, value) => {
    if (/^(https?:|\/\/|data:|blob:|#|mailto:|javascript:)/i.test(value)) return match;
    if (attribute.toLowerCase() === 'href' && /^javascript:/i.test(value)) return match;
    if (/^\/\//.test(value)) return match;
    return `${attribute}="${escapeAttr(resolveProjectUrl(entryFile, value))}"`;
  });

  return html;
}

async function downloadZip(edited) {
  if (!activeClass) return;
  try {
    const JSZip = await loadZip();
    syncEditorValue();
    const zip = new JSZip();
    for (const [relative, item] of files) {
      if (relative === 'class.json') continue;
      if (item.binary) {
        const response = await fetch(item.url, { cache: 'no-cache' });
        if (response.ok) zip.file(relative, await response.blob());
      } else if (item.original != null) {
        zip.file(relative, edited ? (item.current ?? item.original) : item.original);
      }
    }
    zip.file('PROJECT-INFO.txt', `${activeClass.title}\nMentor: Mohammed Obaidul Hoque\n\nGenerated by Obaid Web Lab.`);
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    triggerDownload(blob, `${activeClass.id}${edited ? '-my-version' : ''}.zip`);
  } catch (error) {
    alert(`ZIP export is temporarily unavailable.\n\n${error.message}`);
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function loadCodeMirror() {
  if (!cmPromise) {
    cmPromise = Promise.all(
      Object.entries(MODULES)
        .filter(([key]) => key !== 'zip')
        .map(async ([key, url]) => [key, await import(url)])
    ).then(entries => {
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
  return cmPromise;
}

function loadZip() {
  if (!zipPromise) zipPromise = import(MODULES.zip).then(module => module.default || module);
  return zipPromise;
}

function setStatus(message) {
  $('#saveStatus') && ($('#saveStatus').textContent = message);
}

function toggleFullscreen(element) {
  if (!element) return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    element.requestFullscreen?.();
  }
}

function showWorkspaceNotice(message) {
  if (els.workspace) {
    els.workspace.innerHTML = `
      <div class="workspace-empty">
        <div class="workspace-empty__core"><span>!</span><i></i></div>
        <div class="eyebrow">PROJECT NEEDS ATTENTION</div>
        <h3>${escapeHtml(message)}</h3>
      </div>
    `;
  }
}

function showFatal(error) {
  if (els.grid) {
    els.grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty__icon">!</div>
        <h3>Project library could not load</h3>
        <p>${escapeHtml(error?.message || 'Unknown error')}</p>
      </div>
    `;
  }
}

function cleanupEditor() {
  try { editorView?.destroy?.(); } catch {}
  editorView = null;
  editorApi = null;
}

function cleanupPreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function storageKey(id) {
  return `obaid-web-lab:${id}`;
}

function isEditable(value) {
  return /\.(html?|css|js|mjs|ts|json|md|svg)$/i.test(value);
}

function isBinary(value) {
  return /\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|woff2?|ttf|otf|ico|pdf)$/i.test(value);
}

function extensionLabel(value) {
  const ext = value.split('.').pop()?.toUpperCase() || 'FILE';
  if (['HTML', 'HTM'].includes(ext)) return 'HTML';
  if (ext === 'CSS') return 'CSS';
  if (['JS', 'MJS', 'TS'].includes(ext)) return 'JavaScript';
  return ext;
}

function fileIcon(value) {
  if (/\.html?$/i.test(value)) return '◇';
  if (/\.css$/i.test(value)) return '◌';
  if (/\.(js|mjs|ts)$/i.test(value)) return '✦';
  if (/\.(png|jpe?g|webp|avif|svg|gif)$/i.test(value)) return '▧';
  if (/\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(value)) return '◉';
  return '·';
}

function pathDir(path) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function normalizePath(base, target) {
  const result = [];
  for (const part of `${base ? `${base}/` : ''}${String(target)}`.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') result.pop();
    else result.push(part);
  }
  return result.join('/');
}

function resolveProjectUrl(entryFile, relative) {
  if (/^(https?:|\/\/|data:|blob:|#|mailto:)/i.test(relative)) return relative;
  const relativeDir = pathDir(entryFile);
  const projectPath = normalizePath(relativeDir, relative);
  return assetUrl('classes', activeClass.slug || activeClass.id, projectPath);
}

function humanize(slug) {
  return String(slug).replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, char => char.toUpperCase()) || String(slug);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

boot();
