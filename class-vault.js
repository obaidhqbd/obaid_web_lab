(() => {
  const DB_NAME = 'ObaidWebLabClassVault';
  const DB_VERSION = 1;
  const STORE = 'files';
  const el = (s) => document.querySelector(s);
  let dbPromise;
  let activeSubject = 'all';

  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const size = bytes => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const typeOf = name => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return ['pdf','PDF'];
    if (['doc','docx','odt','rtf'].includes(ext)) return ['document','DOC'];
    if (['ppt','pptx','odp'].includes(ext)) return ['presentation','PPT'];
    if (['xls','xlsx','csv'].includes(ext)) return ['spreadsheet','XLS'];
    if (['zip','rar','7z','tar','gz'].includes(ext)) return ['archive','ZIP'];
    if (['png','jpg','jpeg','webp','gif','svg'].includes(ext)) return ['image','IMG'];
    if (['mp4','webm','mov','m4v'].includes(ext)) return ['video','VID'];
    return ['text','TXT'];
  };
  const openDb = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('subject', 'subject');
        store.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const all = () => openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
  const put = item => openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
  const remove = id => openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
  const get = id => openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const guessSubject = name => {
    const lower = name.toLowerCase();
    if (lower.includes('physics') || lower.includes('phy')) return 'Physics';
    if (lower.includes('chem')) return 'Chemistry';
    if (lower.includes('math') || lower.includes('calculus')) return 'Mathematics';
    if (lower.includes('ict') || lower.includes('computer') || lower.includes('web')) return 'ICT / Web';
    if (lower.includes('english')) return 'English';
    if (lower.includes('bangla')) return 'Bangla';
    return '';
  };
  const getMeta = async (count, files) => {
    const modal = document.createElement('dialog');
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-head"><div><span class="eyebrow">CLASS FILE IMPORT</span><h2>Organize these '+count+' file(s)</h2></div><button class="icon-btn small" data-vault-close>×</button></div>' +
      '<form class="form-grid"><input id="vaultSubject" placeholder="Subject e.g. Physics" required><input id="vaultClassTitle" placeholder="Class title / chapter (optional)"><input id="vaultTags" placeholder="Tags, separated by commas (optional)"><div class="muted">The original filename is kept. Metadata is shared across this upload batch.</div><div class="capture-actions"><button class="btn ghost" type="button" data-vault-cancel>Cancel</button><button class="btn primary" type="submit">Upload '+count+' file(s)</button></div></form>';
    document.body.appendChild(modal);
    const guess = guessSubject(files[0]?.name || '');
    modal.querySelector('#vaultSubject').value = guess;
    modal.querySelector('[data-vault-close]').onclick = () => modal.close();
    modal.querySelector('[data-vault-cancel]').onclick = () => modal.close();
    const result = new Promise(resolve => {
      modal.querySelector('form').onsubmit = e => {
        e.preventDefault();
        resolve({
          subject: modal.querySelector('#vaultSubject').value.trim() || 'Unsorted',
          classTitle: modal.querySelector('#vaultClassTitle').value.trim(),
          tags: modal.querySelector('#vaultTags').value.split(',').map(x => x.trim()).filter(Boolean)
        });
        modal.close();
      };
      modal.addEventListener('close', () => { if (!modal.dataset.resolved) resolve(null); modal.remove(); });
    });
    modal.showModal();
    const meta = await result;
    if (meta) modal.dataset.resolved = '1';
    return meta;
  };
  async function uploadFiles(files) {
    const list = [...files];
    if (!list.length) return;
    const meta = await getMeta(list.length, list);
    if (!meta) return;
    el('#classUploadStatus').textContent = 'UPLOADING';
    try {
      for (const file of list) {
        const [category, label] = typeOf(file.name);
        await put({
          id: uid(),
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          category,
          label,
          subject: meta.subject,
          classTitle: meta.classTitle || '',
          tags: meta.tags,
          date: new Date().toISOString(),
          blob: file
        });
      }
      if (typeof logAutomation === 'function') {
        logAutomation('Class Vault', 'Uploaded '+list.length+' class file'+(list.length === 1 ? '' : 's'));
        localStorage.setItem('owl2_state_v1', JSON.stringify(state));
      }
      el('#classUploadStatus').textContent = 'READY';
      toast(list.length+' class file'+(list.length === 1 ? '' : 's')+' uploaded');
      await renderClassVault();
    } catch (err) {
      console.error(err);
      el('#classUploadStatus').textContent = 'ERROR';
      toast('Upload failed — browser storage may be full');
    }
  }
  function iconFor(category) {
    return {pdf:'PDF',document:'DOC',presentation:'PPT',spreadsheet:'XLS',archive:'ZIP',image:'IMG',video:'VID',text:'TXT'}[category] || 'FILE';
  }
  async function previewFile(id) {
    const item = await get(id);
    if (!item) return;
    const url = URL.createObjectURL(item.blob);
    if (item.category === 'image' || item.category === 'pdf' || item.category === 'video' || item.category === 'text') {
      const w = window.open('', '_blank');
      if (!w) return toast('Allow popups to preview this file');
      if (item.category === 'text') {
        const reader = new FileReader();
        reader.onload = () => {
          w.document.write('<pre style="white-space:pre-wrap;font:14px/1.6 system-ui;padding:24px">'+esc(reader.result)+'</pre>');
          w.document.close();
        };
        reader.readAsText(item.blob);
      } else {
        w.location.href = url;
      }
    } else {
      downloadFile(id);
    }
  }
  async function downloadFile(id) {
    const item = await get(id);
    if (!item) return;
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.href = url; a.download = item.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  async function deleteFile(id) {
    if (!confirm('Delete this class file from this browser?')) return;
    await remove(id);
    toast('Class file deleted');
    renderClassVault();
  }
  function renderFolderList(items) {
    const groups = {};
    items.forEach(x => groups[x.subject || 'Unsorted'] = (groups[x.subject || 'Unsorted'] || 0) + 1);
    const sorted = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]));
    el('#classFolderList').innerHTML = '<button class="class-folder '+(activeSubject==='all'?'active':'')+'" data-folder="all"><span>All classes</span><small>'+items.length+'</small></button>' +
      sorted.map(([s,n]) => '<button class="class-folder '+(activeSubject===s?'active':'')+'" data-folder="'+esc(s)+'"><span>'+esc(s)+'</span><small>'+n+'</small></button>').join('');
    $$('.class-folder').forEach(b => b.onclick = () => { activeSubject = b.dataset.folder; renderClassVault(); });
  }
  async function renderClassVault() {
    const grid = el('#classFileGrid');
    if (!grid) return;
    let items = await all();
    const q = (el('#classSearch')?.value || '').trim().toLowerCase();
    const type = el('#classTypeFilter')?.value || 'all';
    const subject = el('#classSubjectFilter')?.value || 'all';
    if (activeSubject !== 'all') items = items.filter(x => x.subject === activeSubject);
    if (subject !== 'all') items = items.filter(x => x.subject === subject);
    if (type !== 'all') items = items.filter(x => x.category === type);
    if (q) items = items.filter(x => (x.name+' '+x.subject+' '+x.classTitle+' '+x.tags.join(' ')).toLowerCase().includes(q));
    items.sort((a,b)=>b.date.localeCompare(a.date));
    const allItems = await all();
    const subjects = [...new Set(allItems.map(x => x.subject || 'Unsorted'))].sort();
    el('#classFileCount').textContent = allItems.length;
    el('#classSubjectCount').textContent = subjects.length;
    const sf = el('#classSubjectFilter');
    const current = sf.value;
    sf.innerHTML = '<option value="all">All subjects</option>' + subjects.map(s => '<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
    sf.value = subjects.includes(current) ? current : 'all';
    renderFolderList(allItems);
    grid.innerHTML = items.length ? items.map(item => {
      const action = (item.category === 'pdf' || item.category === 'image' || item.category === 'video' || item.category === 'text') ? 'Preview' : 'Download';
      return '<article class="class-file"><div class="class-file-top"><span class="class-file-icon">'+iconFor(item.category)+'</span><span class="class-file-kind">'+esc(item.label)+'</span></div><h3 title="'+esc(item.name)+'">'+esc(item.name)+'</h3><p>'+esc(item.subject)+(item.classTitle ? ' · '+esc(item.classTitle) : '')+'<br>'+size(item.size)+' · '+new Date(item.date).toLocaleDateString()+'</p><div class="class-file-tags">'+item.tags.map(t => '<span>'+esc(t)+'</span>').join('')+'</div><div class="class-file-actions"><button class="btn ghost" data-preview-file="'+item.id+'">'+action+'</button><button class="btn ghost" data-download-file="'+item.id+'">↓</button><button class="btn danger" data-delete-file="'+item.id+'">×</button></div></article>';
    }).join('') : '<div class="muted" style="grid-column:1/-1;padding:30px;text-align:center">No class files match these filters. Upload a file to start your class archive.</div>';
    $$('[data-preview-file]').forEach(b => b.onclick = () => previewFile(b.dataset.previewFile));
    $$('[data-download-file]').forEach(b => b.onclick = () => downloadFile(b.dataset.downloadFile));
    $$('[data-delete-file]').forEach(b => b.onclick = () => deleteFile(b.dataset.deleteFile));
  }
  window.renderClassVault = renderClassVault;
  function setup() {
    if (!el('#classUploadBtn')) return;
    el('#classUploadBtn').onclick = () => el('#classFileInput').click();
    el('#classFileInput').onchange = e => { uploadFiles(e.target.files); e.target.value = ''; };
    el('#classDropZone').ondragover = e => { e.preventDefault(); el('#classDropZone').classList.add('dragover'); };
    el('#classDropZone').ondragleave = () => el('#classDropZone').classList.remove('dragover');
    el('#classDropZone').ondrop = e => { e.preventDefault(); el('#classDropZone').classList.remove('dragover'); uploadFiles(e.dataTransfer.files); };
    el('#classSearch').oninput = renderClassVault;
    el('#classTypeFilter').onchange = renderClassVault;
    el('#classSubjectFilter').onchange = () => { activeSubject = 'all'; renderClassVault(); };
    el('#classClearFilters').onclick = () => { activeSubject = 'all'; el('#classSearch').value=''; el('#classTypeFilter').value='all'; el('#classSubjectFilter').value='all'; renderClassVault(); };
    el('#classCreateFolderBtn').onclick = () => {
      const name = prompt('New class folder / subject name');
      if (!name?.trim()) return;
      toast('Folder "'+name.trim()+'" is ready — upload files and choose this subject.');
    };
    renderClassVault().catch(() => toast('Class Vault could not initialize'));
  }
  window.addEventListener('load', setup);
})();