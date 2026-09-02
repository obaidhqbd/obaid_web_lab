import { EditorState } from 'https://esm.sh/@codemirror/state@6.5.2';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from 'https://esm.sh/@codemirror/view@6.36.5';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from 'https://esm.sh/@codemirror/commands@6.8.1';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, closeBrackets } from 'https://esm.sh/@codemirror/language@6.11.1';
import { html } from 'https://esm.sh/@codemirror/lang-html@6.4.9';
import { css } from 'https://esm.sh/@codemirror/lang-css@6.3.1';
import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6.2.2';
import { autocompletion, closeBracketsKeymap, completionKeymap } from 'https://esm.sh/@codemirror/autocomplete@6.18.6';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const $ = selector => document.querySelector(selector);
const classGrid = $('#classGrid');
const filtersEl = $('#filters');
const workspaceShell = $('#workspaceShell');
const searchInput = $('#search');

let classes = [];
let siteConfig = {};
let activeClass = null;
let files = new Map();
let editorView = null;
let activeFile = null;
let previewObjectUrl = null;
let saveTimer = 0;
let previewDebounce = 0;
let currentFilter = 'All';
let classLoadToken = 0;

const TEXT_FILE = /\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|svg|xml|webmanifest)$/i;
const BINARY_FILE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac|woff2?|ttf|otf|eot|pdf|zip)$/i;
const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/|#|mailto:|tel:)/i;

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${url}`);
  return res.json();
}

async function boot() {
  try {
    const [classData, config] = await Promise.all([
      getJSON('classes.json'),
      getJSON('site.config.json').catch(() => ({}))
    ]);

    classes = Array.isArray(classData) ? classData : [];
    siteConfig = config && typeof config === 'object' ? config : {};

    applyBrand();
    buildFilters();
    renderClasses();
    bindGlobalUI();
    handleLocation();
  } catch (error) {
    renderFatal(error);
  }
}

function bindGlobalUI() {
  searchInput?.addEventListener('input', renderClasses);
  window.addEventListener('keydown', onGlobalShortcut);
  window.addEventListener('hashchange', handleLocation);
  window.addEventListener('beforeunload', () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  });
}

function applyBrand() {
  const brand = siteConfig.brand ?? {};
  const name = String(brand.name || 'Web Lab');
  const role = String(brand.role || 'Learning Lab');
  $('#brandName').textContent = name;
  $('#brandRole').textContent = role;
  $('#brandTagline').textContent = String(brand.tagline || 'Learn. Code. Experiment. Build.');
  $('#brandDescription').textContent = String(brand.description || 'A hands-on coding lab.');
  $('#footerBrand').textContent = name;
  $('#brandMark').textContent = String(brand.shortName || initials(name));
  document.title = `${name} · ${role}`;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 3).toUpperCase();
}

function buildFilters() {
  if (!filtersEl) return;
  const categories = [...new Set(classes.map(item => String(item.category || '').trim()).filter(Boolean))];
  const values = ['All', ...categories];
  filtersEl.innerHTML = values.map(category => `
    <button class="filter ${category === currentFilter ? 'active' : ''}" type="button" data-filter="${escapeAttr(category)}">
      ${escapeHtml(category)}
    </button>`).join('');
  filtersEl.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter || 'All';
      buildFilters();
      renderClasses();
    });
  });
}

function renderClasses() {
  if (!classGrid) return;
  const query = (searchInput?.value || '').trim().toLowerCase();
  const visible = classes.filter(item => {
    const haystack = [
      item.id, item.slug, item.title, item.description, item.category, item.level,
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.technologies) ? item.technologies : [])
    ].join(' ').toLowerCase();
    return (currentFilter === 'All' || item.category === currentFilter) && haystack.includes(query);
  });

  $('#classCount').textContent = String(classes.length);
  $('#emptyState').hidden = visible.length > 0;
  classGrid.innerHTML = visible.map(cardTemplate).join('');

  classGrid.querySelectorAll('.class-card').forEach(card => {
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

function cardTemplate(item) {
  const id = String(item.id || item.slug || '');
  const title = String(item.title || item.name || titleFromSlug(id));
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 4) : [];
  return `<article class="class-card" tabindex="0" role="button" data-id="${escapeAttr(id)}">
    <div class="card-top">
      <span class="card-id">${escapeHtml(id)}</span>
      <span class="card-level">${escapeHtml(item.level || 'Project')}</span>
    </div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(item.description || 'Practice, edit and experiment in the browser.')}</p>
    <div class="tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="card-bottom">
      <span>${escapeHtml(item.category || 'Web Development')} · ${escapeHtml(item.duration || 'Self-paced')}</span>
      <b aria-hidden="true">→</b>
    </div>
  </article>`;
}

function handleLocation() {
  const match = location.hash.match(/^#workspace\/(.+)$/);
  if (!match) return;
  openClass(decodeURIComponent(match[1]), { updateHash: false, scroll: false });
}

async function openClass(id, options = {}) {
  const item = classes.find(entry => String(entry.id || entry.slug) === String(id));
  if (!item) {
    showToast('Project not found in the class index.');
    return;
  }

  const token = ++classLoadToken;
  activeClass = item;
  clearWorkspace();

  if (options.updateHash !== false) {
    const normalizedId = item.id || item.slug;
    history.replaceState(null, '', `#workspace/${encodeURIComponent(normalizedId)}`);
  }

  $('#workspaceSubtitle').textContent = `${item.title || item.name || titleFromSlug(item.slug)} · learn, edit, preview and export.`;
  workspaceShell.innerHTML = workspaceTemplate(item);
  bindWorkspace();
  showWorkspaceLoading();

  try {
    await loadProject(item, token);
    if (token !== classLoadToken) return;
    renderTutorial(item);
    if (options.scroll !== false) $('#workspace')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    if (token === classLoadToken) showWorkspaceNotice(`This project could not be loaded: ${error.message}`);
  }
}

function workspaceTemplate(item) {
  const classId = item.id || item.slug;
  return `<div class="editor-shell" id="editorShell">
    <aside class="files-panel" aria-label="Project files">
      <div class="panel-head"><span>PROJECT</span><span class="project-title">${escapeHtml(classId)}</span></div>
      <div class="file-actions">
        <button class="tool-btn" type="button" data-action="new-file">+ File</button>
        <button class="tool-btn" type="button" data-action="collapse-files">Hide</button>
      </div>
      <div class="file-list" id="fileList"></div>
    </aside>

    <section class="editor-panel" aria-label="Code editor">
      <div class="toolbar">
        <button class="tool-btn" type="button" data-action="save">Save</button>
        <button class="tool-btn" type="button" data-action="reset">Reset</button>
        <button class="tool-btn" type="button" data-action="undo">Undo</button>
        <button class="tool-btn" type="button" data-action="redo">Redo</button>
        <span class="toolbar-spacer"></span>
        <button class="tool-btn" type="button" data-action="editor-full">Editor ⛶</button>
      </div>
      <div class="editor-wrap"><div class="code-host" id="codeHost"></div></div>
      <div class="statusbar"><span class="status-dot"></span><span id="saveStatus">Loading…</span><span id="languageStatus">—</span></div>
    </section>

    <section class="preview-panel" aria-label="Live preview">
      <div class="toolbar">
        <span class="project-title">LIVE PREVIEW</span>
        <span class="toolbar-spacer"></span>
        <button class="tool-btn" type="button" data-action="refresh">Refresh</button>
        <button class="tool-btn" type="button" data-action="preview-full">Preview ⛶</button>
        <button class="tool-btn" type="button" data-action="download-original">Original ZIP</button>
        <button class="tool-btn primary-tool" type="button" data-action="download">My ZIP</button>
      </div>
      <div class="preview-wrap"><iframe id="previewFrame" title="Live project preview" sandbox="allow-scripts allow-forms allow-modals" loading="lazy"></iframe></div>
    </section>
  </div>
  <div class="workspace-subgrid">
    <section class="tutorial-card" id="tutorialCard" hidden></section>
    <section class="homework-card" id="homeworkCard" hidden></section>
  </div>`;
}

function bindWorkspace() {
  const root = workspaceShell;
  root.querySelector('[data-action="save"]').onclick = () => saveCurrent(true);
  root.querySelector('[data-action="reset"]').onclick = resetProject;
  root.querySelector('[data-action="undo"]').onclick = () => editorView && undo(editorView);
  root.querySelector('[data-action="redo"]').onclick = () => editorView && redo(editorView);
  root.querySelector('[data-action="refresh"]').onclick = () => updatePreview();
  root.querySelector('[data-action="download"]').onclick = () => downloadZip(true);
  root.querySelector('[data-action="download-original"]').onclick = () => downloadZip(false);
  root.querySelector('[data-action="editor-full"]').onclick = () => toggleFullscreen($('.editor-panel'));
  root.querySelector('[data-action="preview-full"]').onclick = () => toggleFullscreen($('.preview-panel'));
  root.querySelector('[data-action="new-file"]').onclick = createNewFile;
  root.querySelector('[data-action="collapse-files"]').onclick = () => $('#editorShell')?.classList.toggle('files-hidden');
}

function showWorkspaceLoading() {
  const list = $('#fileList');
  if (list) list.innerHTML = '<div class="file-loading">Scanning project files…</div>';
}

async function loadProject(item, token) {
  files.clear();
  activeFile = null;
  editorView?.destroy();
  editorView = null;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  const stored = loadStored(item.id || item.slug);
  const fileNames = Array.isArray(item.files) && item.files.length ? item.files : inferFallbackFiles(item);

  await Promise.all(fileNames.map(async rel => {
    if (rel === 'class.json') return;
    const normalized = normalizeProjectRelative(rel);
    if (!normalized || files.has(normalized)) return;
    const url = projectUrl(item, normalized);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const binary = BINARY_FILE.test(normalized) && !TEXT_FILE.test(normalized);
      if (binary) {
        files.set(normalized, { binary: true, url, original: null });
      } else {
        files.set(normalized, { binary: false, url, original: await res.text() });
      }
    } catch (error) {
      files.set(normalized, { binary: true, url, original: null, unavailable: true, error: error.message });
    }
  }));

  if (token !== classLoadToken) return;

  for (const [rel, itemData] of files) {
    if (itemData.binary) continue;
    itemData.current = Object.prototype.hasOwnProperty.call(stored?.files || {}, rel)
      ? String(stored.files[rel])
      : itemData.original;
  }

  const editable = [...files.keys()].filter(isEditable);
  renderFileList([...files.keys()]);

  if (!editable.length) {
    showWorkspaceNotice('No editable source files were found in this class. Add an HTML, CSS, JavaScript or other text source file.');
    return;
  }

  const requestedEntry = normalizeProjectRelative(item.entry || '');
  const entry = requestedEntry && files.has(requestedEntry) && isEditable(requestedEntry)
    ? requestedEntry
    : editable.find(rel => /(^|\/)index\.html?$/i.test(rel)) || editable.find(rel => /\.html?$/i.test(rel)) || editable[0];

  selectFile(entry);
  updatePreview();
  $('#saveStatus').textContent = localExists(item.id || item.slug) ? 'Local changes available' : 'Original project';
}

function inferFallbackFiles(item) {
  const files = [];
  if (item.entry) files.push(normalizeProjectRelative(item.entry));
  files.push('index.html', 'style.css', 'script.js');
  return [...new Set(files.filter(Boolean))];
}

function projectUrl(item, rel) {
  const slug = encodeURIComponent(item.slug || item.id);
  return `classes/${slug}/${rel.split('/').map(encodeURIComponent).join('/')}`;
}

function renderFileList(allFiles) {
  const list = $('#fileList');
  if (!list) return;
  const entries = buildTree(allFiles);
  list.innerHTML = entries.map(entry => {
    if (entry.type === 'folder') {
      return `<div class="tree-folder" style="--depth:${entry.depth}"><span>▾</span><span>${escapeHtml(entry.name)}</span></div>`;
    }
    const item = files.get(entry.path);
    const unavailable = item?.unavailable ? ' unavailable' : '';
    const binary = item?.binary ? ' binary' : '';
    return `<button class="file-btn${unavailable}${binary}" type="button" data-file="${escapeAttr(entry.path)}" style="--depth:${entry.depth}" ${item?.binary ? 'disabled' : ''}>
      <span class="file-icon">${fileIcon(entry.path)}</span><span>${escapeHtml(entry.name)}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.file-btn:not([disabled])').forEach(btn => btn.onclick = () => selectFile(btn.dataset.file));
}

function buildTree(paths) {
  const sorted = [...paths].map(normalizeProjectRelative).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const result = [];
  const seenFolders = new Set();
  for (const filePath of sorted) {
    const parts = filePath.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      if (!seenFolders.has(folderPath)) {
        seenFolders.add(folderPath);
        result.push({ type: 'folder', name: parts[i], depth: i, path: folderPath });
      }
    }
    result.push({ type: 'file', name: parts.at(-1), depth: parts.length - 1, path: filePath });
  }
  return result;
}

function selectFile(rel) {
  const item = files.get(rel);
  if (!item || item.binary) return;
  activeFile = rel;
  $('#fileList')?.querySelectorAll('.file-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.file === rel));
  editorView?.destroy();

  const language = languageExtension(rel);
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab, ...completionKeymap, ...closeBracketsKeymap]),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    autocompletion({ activateOnTyping: true }),
    language,
    EditorView.updateListener.of(update => { if (update.docChanged) onEdit(); })
  ];

  editorView = new EditorView({
    state: EditorState.create({ doc: item.current ?? item.original ?? '', extensions }),
    parent: $('#codeHost')
  });

  $('#languageStatus').textContent = extensionLabel(rel);
  $('#saveStatus').textContent = localExists(activeClass.id || activeClass.slug) ? 'Local changes available' : 'Original project';
}

function languageExtension(rel) {
  if (/\.html?$/i.test(rel)) return html();
  if (/\.css$/i.test(rel)) return css();
  if (/\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(rel)) return javascript({ typescript: /\.tsx?$/i.test(rel) });
  return [];
}

function onEdit() {
  if (!editorView || !activeFile) return;
  const item = files.get(activeFile);
  if (!item || item.binary) return;
  item.current = editorView.state.doc.toString();
  $('#saveStatus').textContent = 'Unsaved local edit';
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveCurrent(false), 300);
  clearTimeout(previewDebounce);
  previewDebounce = window.setTimeout(updatePreview, 400);
}

function saveCurrent(manual = false) {
  if (!activeClass) return;
  if (editorView && activeFile && files.has(activeFile)) files.get(activeFile).current = editorView.state.doc.toString();
  const output = { version: 2, savedAt: new Date().toISOString(), files: {} };
  for (const [rel, item] of files) {
    if (!item.binary && isEditable(rel)) output.files[rel] = item.current ?? item.original ?? '';
  }
  try {
    localStorage.setItem(storageKey(activeClass.id || activeClass.slug), JSON.stringify(output));
    $('#saveStatus').textContent = manual ? 'Saved locally' : 'Autosaved';
  } catch {
    $('#saveStatus').textContent = 'Local storage limit reached';
    showToast('Your browser could not save the whole project locally. Download a ZIP to keep a copy.');
  }
}

function loadStored(id) {
  try {
    const value = localStorage.getItem(storageKey(id));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function localExists(id) {
  return Boolean(localStorage.getItem(storageKey(id)));
}

function storageKey(id) {
  return `mentor-obaidul-web-lab:v2:${id}`;
}

async function resetProject() {
  if (!activeClass) return;
  if (!confirm('Reset this project to the original files? Your local edits will be removed.')) return;
  localStorage.removeItem(storageKey(activeClass.id || activeClass.slug));
  await loadProject(activeClass, ++classLoadToken);
  $('#saveStatus').textContent = 'Restored original';
}

function updatePreview() {
  if (!activeClass) return;
  const htmlFile = normalizeProjectRelative(activeClass.entry || '') && files.has(normalizeProjectRelative(activeClass.entry || ''))
    ? normalizeProjectRelative(activeClass.entry)
    : [...files.keys()].find(rel => /(^|\/)index\.html?$/i.test(rel)) || [...files.keys()].find(rel => /\.html?$/i.test(rel));
  if (!htmlFile) return;

  let htmlText = files.get(htmlFile)?.current ?? files.get(htmlFile)?.original ?? '';
  htmlText = buildPreviewDocument(htmlText, htmlFile);
  const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(blob);
  const frame = $('#previewFrame');
  if (frame) frame.src = previewObjectUrl;
}

function buildPreviewDocument(htmlText, entryFile) {
  const baseUrl = projectAbsoluteBase();
  let output = htmlText;

  output = output.replace(/<link\b([^>]*?)href\s*=\s*(["'])([^"']+\.css(?:\?[^"']*)?)(\2)([^>]*)>/gi, (match, before, q1, href, q2, after) => {
    const key = resolveProjectPath(entryFile, stripQueryHash(href));
    const item = files.get(key);
    if (item && !item.binary) {
      const cssText = rewriteCssAssets(item.current ?? item.original ?? '', key, baseUrl);
      return `<style data-source="${escapeHtml(key)}">\n${cssText}\n</style>`;
    }
    return match;
  });

  output = output.replace(/<script\b([^>]*?)src\s*=\s*(["'])([^"']+)(\2)([^>]*)>\s*<\/script>/gi, (match, before, q1, src, q2, after) => {
    const key = resolveProjectPath(entryFile, stripQueryHash(src));
    const item = files.get(key);
    if (item && !item.binary) {
      const code = item.current ?? item.original ?? '';
      return `<script${before}${after}>\n${code}\n<\/script>`;
    }
    if (!EXTERNAL_URL.test(src)) return match;
    return match;
  });

  output = rewriteHtmlReferences(output, entryFile, baseUrl);

  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head[^>]*>/i, match => `${match}\n<base href="${escapeAttr(baseUrl)}">`);
  } else {
    output = `<base href="${escapeAttr(baseUrl)}">\n${output}`;
  }
  return output;
}

function rewriteHtmlReferences(htmlText, entryFile, baseUrl) {
  return htmlText.replace(/\b(src|href|poster)\s*=\s*(["'])([^"']+)(\2)/gi, (match, attr, q1, value, q2) => {
    if (EXTERNAL_URL.test(value) || /^data:/i.test(value) || /^javascript:/i.test(value)) return match;
    const clean = stripQueryHash(value);
    const suffix = value.slice(clean.length);
    if (!clean) return match;
    const key = resolveProjectPath(entryFile, clean);
    if (files.has(key)) return `${attr}=${q1}${projectAbsoluteFile(key)}${suffix}${q2}`;
    return match;
  });
}

function rewriteCssAssets(cssText, cssFile, baseUrl) {
  return cssText.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, value) => {
    if (EXTERNAL_URL.test(value) || /^data:/i.test(value)) return match;
    const clean = stripQueryHash(value);
    const key = resolveProjectPath(cssFile, clean);
    if (!files.has(key)) return match;
    return `url("${projectAbsoluteFile(key)}${value.slice(clean.length)}")`;
  });
}

function projectAbsoluteBase() {
  return new URL(`classes/${encodeURIComponent(activeClass.slug || activeClass.id)}/`, document.baseURI).href;
}

function projectAbsoluteFile(rel) {
  return new URL(rel.split('/').map(encodeURIComponent).join('/'), projectAbsoluteBase()).href;
}

function stripQueryHash(value) {
  return value.split(/[?#]/, 1)[0];
}

function resolveProjectPath(baseFile, value) {
  if (EXTERNAL_URL.test(value)) return value;
  return normalizeProjectRelative(joinPath(pathDir(baseFile), value));
}

function normalizeProjectRelative(value) {
  if (!value) return '';
  const raw = String(value).replace(/\\/g, '/').replace(/^\/?/, '');
  const out = [];
  for (const segment of raw.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

function joinPath(base, value) {
  return `${base ? `${base}/` : ''}${value}`;
}

function pathDir(value) {
  const index = value.lastIndexOf('/');
  return index === -1 ? '' : value.slice(0, index);
}

async function downloadZip(edited) {
  if (!activeClass) return;
  const zip = new JSZip();
  const classId = activeClass.id || activeClass.slug;
  const entries = [...files.entries()];

  for (const [rel, item] of entries) {
    if (rel === 'class.json') continue;
    if (item.unavailable) continue;
    if (item.binary) {
      try {
        const response = await fetch(item.url, { cache: 'no-store' });
        if (response.ok) zip.file(rel, await response.blob());
      } catch {
        // Preserve the rest of the project even when one binary asset is unavailable.
      }
    } else {
      zip.file(rel, edited ? (item.current ?? item.original ?? '') : (item.original ?? ''));
    }
  }

  zip.file('PROJECT-INFO.txt', `${activeClass.title || titleFromSlug(classId)}\n${siteConfig.brand?.name || 'Web Lab'}\n\nGenerated by Mentor Obaidul Web Lab.`);
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(classId)}${edited ? '-my-version' : '-original'}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createNewFile() {
  if (!activeClass) return;
  const raw = prompt('New file path, for example: js/app.js');
  if (raw == null) return;
  const rel = normalizeProjectRelative(raw);
  if (!rel || rel.endsWith('/') || !TEXT_FILE.test(rel)) {
    showToast('Please enter a supported text file path, such as js/app.js or notes.md.');
    return;
  }
  if (files.has(rel)) {
    showToast('That file already exists.');
    return;
  }
  files.set(rel, { binary: false, url: null, original: '', current: '' , created: true });
  renderFileList([...files.keys()]);
  selectFile(rel);
  saveCurrent(true);
  updatePreview();
}

function clearWorkspace() {
  editorView?.destroy();
  editorView = null;
  files.clear();
  activeFile = null;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function renderTutorial(item) {
  const tutorial = $('#tutorialCard');
  const homework = $('#homeworkCard');
  const notesFile = [...files.keys()].find(rel => /(^|\/)README\.md$/i.test(rel)) || [...files.keys()].find(rel => /(^|\/)(tutorial|lesson|notes)\.(md|html?)$/i.test(rel));
  const markdown = notesFile && files.get(notesFile)?.current;

  if (tutorial && markdown) {
    tutorial.hidden = false;
    tutorial.innerHTML = `<div class="eyebrow">LESSON NOTES</div><h3>${escapeHtml(item.title || 'Tutorial')}</h3><div class="markdown-content">${renderSimpleMarkdown(markdown)}</div>`;
  }

  if (homework && item.homework) {
    homework.hidden = false;
    homework.innerHTML = `<div class="eyebrow">HOMEWORK</div><h3>${escapeHtml(item.homework.title || 'Practice task')}</h3><p>${escapeHtml(item.homework.description || '')}</p>`;
  }
}

function renderSimpleMarkdown(markdown) {
  let text = escapeHtml(markdown);
  text = text.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, block => `<ul>${block}</ul>`);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.split(/\n{2,}/).map(block => /^</.test(block.trim()) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`).join('');
  return text;
}

function showWorkspaceNotice(message) {
  workspaceShell.innerHTML = `<div class="workspace-empty"><div class="empty-icon">!</div><h3>Project needs attention</h3><p>${escapeHtml(message)}</p></div>`;
}

function renderFatal(error) {
  if (classGrid) classGrid.innerHTML = `<div class="empty">The project library could not load. ${escapeHtml(error.message || 'Unknown error')}</div>`;
  if (searchInput) searchInput.disabled = true;
}

function showToast(message) {
  let toast = $('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function toggleFullscreen(element) {
  if (!element) return;
  if (!document.fullscreenElement) element.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function onGlobalShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput?.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    if (activeClass) {
      event.preventDefault();
      saveCurrent(true);
    }
  }
}

function isEditable(rel) {
  return TEXT_FILE.test(rel);
}

function extensionLabel(rel) {
  const ext = rel.split('.').pop()?.toLowerCase() || '';
  if (/html?/.test(ext)) return 'HTML';
  if (ext === 'css') return 'CSS';
  if (/js|mjs|cjs|ts|tsx|jsx/.test(ext)) return 'JavaScript';
  if (ext === 'md') return 'Markdown';
  if (ext === 'json') return 'JSON';
  return ext.toUpperCase() || 'TEXT';
}

function fileIcon(rel) {
  if (/\.html?$/i.test(rel)) return '◈';
  if (/\.css$/i.test(rel)) return '◌';
  if (/\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(rel)) return '✦';
  if (/\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(rel)) return '▧';
  if (/\.(mp4|webm|mov|mp3|wav|ogg|m4a|aac)$/i.test(rel)) return '◉';
  if (/\.(woff2?|ttf|otf|eot)$/i.test(rel)) return 'Aa';
  if (/\.md$/i.test(rel)) return 'M';
  return '·';
}

function titleFromSlug(slug) {
  return String(slug || '').replace(/^\d{1,4}[-_]?/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Untitled Project';
}

function safeFileName(value) {
  return String(value || 'project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'project';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function escapeAttr(value = '') { return escapeHtml(value); }
function prefersReducedMotion() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }

boot();
