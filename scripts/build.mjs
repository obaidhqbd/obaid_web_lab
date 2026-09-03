import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const classesDir = path.join(rootDir, 'classes');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const distClassesDir = path.join(distDir, 'classes');

function assertDir(dir, label) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} directory not found: ${dir}`);
  }
}

function walkFiles(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === '.DS_Store' || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) result.push(...walkFiles(full, base));
    else if (entry.isFile()) result.push(path.relative(base, full).replaceAll(path.sep, '/'));
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function humanize(slug) {
  return slug
    .replace(/^\d+[-_ ]*/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()) || slug;
}

function inferCategory(files) {
  const set = new Set(files.map(f => f.toLowerCase().split('.').pop()));
  if (set.has('html') || set.has('htm')) return 'HTML';
  if (set.has('css')) return 'CSS';
  if (set.has('js') || set.has('mjs') || set.has('ts')) return 'JavaScript';
  return 'Web Development';
}

function inferTags(files) {
  const tags = [];
  const lower = files.join(' ').toLowerCase();
  if (/\.html?\b/.test(lower)) tags.push('HTML');
  if (/\.css\b/.test(lower)) tags.push('CSS');
  if (/\.(m?js|ts)\b/.test(lower)) tags.push('JavaScript');
  if (/\.(png|jpe?g|gif|webp|avif|svg)\b/.test(lower)) tags.push('Assets');
  if (/\.(mp4|webm|mov)\b/.test(lower)) tags.push('Video');
  if (/\.(mp3|wav|ogg|m4a)\b/.test(lower)) tags.push('Audio');
  return [...new Set(tags)];
}

function readClassMetadata(classDirName, files) {
  const dir = path.join(classesDir, classDirName);
  const jsonPath = path.join(dir, 'class.json');
  let meta = {};
  if (fs.existsSync(jsonPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) || {};
    } catch (error) {
      console.warn(`Invalid class.json in ${classDirName}; using safe defaults.`);
    }
  }
  const id = String(meta.id || classDirName);
  const title = String(meta.title || meta.name || humanize(classDirName));
  const entry = String(meta.entry || (files.find(f => /(^|\/)index\.html?$/i.test(f)) || files.find(f => /\.html?$/i.test(f)) || ''));
  return {
    ...meta,
    id,
    title,
    description: String(meta.description || 'Hands-on web development project.'),
    category: String(meta.category || inferCategory(files)),
    level: String(meta.level || 'Beginner'),
    tags: Array.isArray(meta.tags) ? meta.tags : inferTags(files),
    entry,
    slug: classDirName,
    files: files.filter(f => f !== 'class.json')
  };
}

assertDir(classesDir, 'Classes');
assertDir(srcDir, 'Source');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distClassesDir, { recursive: true });
fs.cpSync(srcDir, distDir, { recursive: true });
if (fs.existsSync(path.join(rootDir, 'site.config.json'))) {
  fs.copyFileSync(path.join(rootDir, 'site.config.json'), path.join(distDir, 'site.config.json'));
}

const classesData = [];

// Normal mode: each direct child directory under classes/ is a class.
for (const entry of fs.readdirSync(classesDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
  const classDir = path.join(classesDir, entry.name);
  const files = walkFiles(classDir);
  if (!files.some(f => /\.html?$/i.test(f))) {
    console.warn(`Skipping ${entry.name}: no HTML entry/source file found.`);
    continue;
  }
  const info = readClassMetadata(entry.name, files);
  classesData.push(info);
  fs.cpSync(classDir, path.join(distClassesDir, entry.name), { recursive: true });
}

// Compatibility mode: if classes/ itself contains a project and no child
// class directories were discovered, treat the root as one class. This keeps
// browser-uploaded single-class projects working without creating duplicates
// when the normal classes/<class-name>/ structure is present.
const rootFiles = walkFiles(classesDir);
const hasChildClasses = classesData.length > 0;
const rootHtml = rootFiles.filter(f => !f.includes('/') && /\.html?$/i.test(f));
if (!hasChildClasses && rootHtml.length) {
  const virtualName = 'class';
  const virtualInfo = readClassMetadata(virtualName, rootFiles);
  virtualInfo.slug = 'class';
  classesData.push(virtualInfo);
  const target = path.join(distClassesDir, virtualName);
  fs.mkdirSync(target, { recursive: true });
  for (const file of rootFiles) {
    if (file === 'README.md') continue;
    const from = path.join(classesDir, file);
    const to = path.join(target, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

classesData.sort((a, b) => {
  const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  return ao - bo || a.slug.localeCompare(b.slug);
});

fs.writeFileSync(path.join(distDir, 'classes.json'), JSON.stringify(classesData, null, 2));
fs.writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  classCount: classesData.length
}, null, 2));

const siteBase = 'https://obaidhqbd.github.io/obaid_web_lab/';
fs.writeFileSync(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteBase}sitemap.xml\n`);
const sitemapUrls = [siteBase, ...classesData.map(c => `${siteBase}#workspace/${encodeURIComponent(c.id || c.slug)}`)];
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
console.log(`Built ${classesData.length} classes.`);
classesData.forEach(c => console.log(` - ${c.id}: ${c.title}`));
