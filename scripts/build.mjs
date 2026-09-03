import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const classesDir = path.join(rootDir, 'classes');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const distClassesDir = path.join(distDir, 'classes');

function assertDir(dir, label) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`${label} directory not found: ${dir}`);
}

function walkFiles(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === '.DS_Store' || entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.isDirectory()) result.push(...walkFiles(full, base));
    else if (entry.isFile()) result.push(path.relative(base, full).replaceAll(path.sep, '/'));
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function humanize(slug) {
  return String(slug).replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()) || slug;
}

function inferCategory(files) {
  const set = new Set(files.map(f => f.toLowerCase().split('.').pop()));
  if (set.has('html') || set.has('htm')) return 'HTML';
  if (set.has('css')) return 'CSS';
  if (set.has('js') || set.has('mjs') || set.has('ts')) return 'JavaScript';
  return 'Web Development';
}

function inferTags(files) {
  const lower = files.join(' ').toLowerCase();
  const tags = [];
  if (/\.html?\b/.test(lower)) tags.push('HTML');
  if (/\.css\b/.test(lower)) tags.push('CSS');
  if (/\.(?:m?js|ts)\b/.test(lower)) tags.push('JavaScript');
  if (/\.(?:png|jpe?g|gif|webp|avif|svg)\b/.test(lower)) tags.push('Assets');
  if (/\.(?:mp4|webm|mov)\b/.test(lower)) tags.push('Video');
  if (/\.(?:mp3|wav|ogg|m4a)\b/.test(lower)) tags.push('Audio');
  return [...new Set(tags)];
}

function readMetadata(projectDir, fallbackSlug, files) {
  const jsonPath = path.join(projectDir, 'class.json');
  let meta = {};
  if (fs.existsSync(jsonPath)) {
    try { meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) || {}; }
    catch { console.warn(`Invalid class.json in ${fallbackSlug}; using safe defaults.`); }
  }
  const id = String(meta.id || fallbackSlug);
  const title = String(meta.title || meta.name || humanize(fallbackSlug));
  const entry = String(meta.entry || files.find(f => /(^|\/)index\.html?$/i.test(f)) || files.find(f => /\.html?$/i.test(f)) || '');
  return {
    ...meta,
    id,
    title,
    description: String(meta.description || 'Hands-on web development project.'),
    category: String(meta.category || inferCategory(files)),
    level: String(meta.level || 'Beginner'),
    tags: Array.isArray(meta.tags) ? meta.tags : inferTags(files),
    entry,
    slug: fallbackSlug,
    files: files.filter(f => f !== 'class.json')
  };
}

function copyProject(projectDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(projectDir, targetDir, { recursive: true });
  return targetDir;
}

function detectProjectRoot(extractedDir) {
  const all = walkFiles(extractedDir);
  const indexes = all.filter(f => /(^|\/)index\.html?$/i.test(f));
  if (!indexes.length) return null;
  const candidates = indexes
    .map(rel => {
      const abs = path.join(extractedDir, rel);
      let dir = path.dirname(abs);
      let score = 0;
      if (fs.existsSync(path.join(dir, 'class.json'))) score += 100;
      while (dir.startsWith(extractedDir) && dir !== extractedDir) {
        if (fs.existsSync(path.join(dir, 'class.json'))) score += 50;
        dir = path.dirname(dir);
      }
      return { index: rel, score, root: path.dirname(path.join(extractedDir, rel)) };
    })
    .sort((a, b) => b.score - a.score || a.root.length - b.root.length);
  return candidates[0]?.root || null;
}

function safeSlug(value) {
  return String(value).trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'class';
}

function findArchiveMetadata(archivePath, extractedDir, archiveSlug) {
  const projectRoot = detectProjectRoot(extractedDir);
  if (!projectRoot) return null;
  const files = walkFiles(projectRoot);
  const meta = readMetadata(projectRoot, archiveSlug, files);
  return { projectRoot, files, meta };
}

function buildClassFromDirectory(name) {
  const dir = path.join(classesDir, name);
  const files = walkFiles(dir);
  if (!files.some(f => /\.html?$/i.test(f))) {
    console.warn(`Skipping ${name}: no HTML source/entry file found.`);
    return null;
  }
  return { projectDir: dir, files, meta: readMetadata(dir, name, files) };
}

const tempRoots = [];

function buildClassFromArchive(fileName) {
  const archivePath = path.join(classesDir, fileName);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-lab-'));
  tempRoots.push(tempRoot);
  execFileSync('unzip', ['-q', '-o', archivePath, '-d', tempRoot], { stdio: 'ignore' });
    const archiveSlug = safeSlug(fileName.replace(/\.zip$/i, ''));
    const found = findArchiveMetadata(archivePath, tempRoot, archiveSlug);
    if (!found) {
      console.warn(`Skipping ${fileName}: ZIP does not contain an HTML project.`);
      return null;
    }
    return { projectDir: found.projectRoot, files: found.files, meta: found.meta };
}

assertDir(classesDir, 'Classes');
assertDir(srcDir, 'Source');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distClassesDir, { recursive: true });
fs.cpSync(srcDir, distDir, { recursive: true });
if (fs.existsSync(path.join(rootDir, 'site.config.json'))) fs.copyFileSync(path.join(rootDir, 'site.config.json'), path.join(distDir, 'site.config.json'));

const classesData = [];
const usedSlugs = new Set();

for (const entry of fs.readdirSync(classesDir, { withFileTypes: true })) {
  if (entry.name.startsWith('.')) continue;
  let result = null;
  if (entry.isDirectory()) result = buildClassFromDirectory(entry.name);
  else if (entry.isFile() && /\.zip$/i.test(entry.name)) result = buildClassFromArchive(entry.name);
  if (!result) continue;

  let slug = result.meta.slug || safeSlug(entry.name.replace(/\.zip$/i, ''));
  if (usedSlugs.has(slug)) {
    let i = 2;
    while (usedSlugs.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }
  usedSlugs.add(slug);
  result.meta.slug = slug;
  classesData.push(result.meta);
  copyProject(result.projectDir, path.join(distClassesDir, slug));
}

// Legacy compatibility: classes/ itself may contain a single project.
if (!classesData.length) {
  const rootFiles = walkFiles(classesDir);
  if (rootFiles.some(f => /\.html?$/i.test(f))) {
    const meta = readMetadata(classesDir, 'class', rootFiles);
    meta.slug = 'class';
    classesData.push(meta);
    copyProject(classesDir, path.join(distClassesDir, 'class'));
  }
}

classesData.sort((a, b) => {
  const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  return ao - bo || String(a.slug).localeCompare(String(b.slug), undefined, { numeric: true });
});

const configPath = path.join(rootDir, 'site.config.json');
let siteConfig = {};
if (fs.existsSync(configPath)) {
  try { siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) || {}; } catch { siteConfig = {}; }
}

fs.writeFileSync(path.join(distDir, 'classes.json'), JSON.stringify(classesData, null, 2));
fs.writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify({ generatedAt: new Date().toISOString(), classCount: classesData.length }, null, 2));

const siteBase = 'https://obaidhqbd.github.io/obaid_web_lab/';
fs.writeFileSync(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteBase}sitemap.xml\n`);
const sitemapUrls = [siteBase, ...classesData.map(c => `${siteBase}#workspace/${encodeURIComponent(c.id || c.slug)}`)];
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`);

// Bootstrap immutable page data into HTML so the homepage does not need extra JSON requests.
const indexPath = path.join(distDir, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const bootstrap = `<script>window.__WEB_LAB_DATA__=${JSON.stringify({ classes: classesData, siteConfig }) .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};</script>`;
indexHtml = indexHtml.replace(/<head([^>]*)>/i, `<head$1>${bootstrap}`);
fs.writeFileSync(indexPath, indexHtml);

console.log(`Built ${classesData.length} classes.`);
classesData.forEach(c => console.log(` - ${c.id}: ${c.title}`));

for (const tempRoot of tempRoots) fs.rmSync(tempRoot, { recursive: true, force: true });
