import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const srcDir = path.join(rootDir, 'src');
const classesDir = path.join(rootDir, 'classes');
const distDir = path.join(rootDir, 'dist');
const distClassesDir = path.join(distDir, 'classes');
const siteConfigPath = path.join(rootDir, 'site.config.json');

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.json', '.md', '.txt', '.svg', '.xml', '.webmanifest', '.map'
]);
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

function fail(message) {
  console.error(`\nBUILD ERROR: ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d{1,4}\b/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, ch => ch.toUpperCase()) || slug;
}

function detectCategory(files) {
  const has = ext => files.some(f => f.toLowerCase().endsWith(ext));
  if (has('.html') || has('.htm')) return 'HTML';
  if (has('.css')) return 'CSS';
  if (has('.js') || has('.mjs')) return 'JavaScript';
  return 'Web Development';
}

function detectTechnologies(files) {
  const tech = [];
  if (files.some(f => /\.html?$/i.test(f))) tech.push('HTML5');
  if (files.some(f => /\.css$/i.test(f))) tech.push('CSS3');
  if (files.some(f => /\.(js|mjs|cjs)$/i.test(f))) tech.push('JavaScript');
  if (files.some(f => /\.tsx?$/i.test(f))) tech.push('TypeScript');
  return tech;
}

function listFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) result.push(toPosix(path.relative(dir, absolute)));
    }
  };
  walk(dir);
  return result.sort((a, b) => a.localeCompare(b));
}

function sanitizeMeta(meta, slug, files) {
  const normalized = { ...(meta || {}) };
  normalized.id = String(normalized.id || slug);
  normalized.slug = slug;
  normalized.title = String(normalized.title || titleFromSlug(slug));
  normalized.description = String(normalized.description || 'Practice web development by editing this project in the browser.');
  normalized.category = String(normalized.category || detectCategory(files));
  normalized.level = String(normalized.level || 'Beginner');
  normalized.duration = String(normalized.duration || 'Self-paced');
  normalized.tags = Array.isArray(normalized.tags) ? normalized.tags.map(String) : [];
  normalized.technologies = Array.isArray(normalized.technologies) ? normalized.technologies.map(String) : detectTechnologies(files);
  normalized.featured = Boolean(normalized.featured);

  const htmlFiles = files.filter(f => /(^|\/)index\.html?$/i.test(f));
  const firstHtml = files.find(f => /\.html?$/i.test(f));
  const requestedEntry = typeof normalized.entry === 'string' ? normalized.entry.replace(/^\.\//, '') : '';
  normalized.entry = requestedEntry && files.includes(requestedEntry)
    ? requestedEntry
    : htmlFiles[0] || firstHtml || '';

  normalized.files = files;
  normalized.editableFiles = files.filter(f => TEXT_EXTENSIONS.has(path.extname(f).toLowerCase()));
  normalized.binaryFiles = files.filter(f => !normalized.editableFiles.includes(f));
  return normalized;
}

if (!fs.existsSync(srcDir)) fail('Missing src/ directory.');
if (!fs.existsSync(classesDir)) fail('Missing classes/ directory.');
if (!fs.existsSync(path.join(srcDir, 'index.html'))) fail('Missing src/index.html.');

fs.rmSync(distDir, { recursive: true, force: true });
ensureDir(distClassesDir);
fs.cpSync(srcDir, distDir, { recursive: true });
if (fs.existsSync(siteConfigPath)) fs.copyFileSync(siteConfigPath, path.join(distDir, 'site.config.json'));

const classEntries = fs.readdirSync(classesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
  .map(entry => entry.name);

const classesData = [];
const usedIds = new Set();

for (const slug of classEntries) {
  const classDir = path.join(classesDir, slug);
  const files = listFiles(classDir);
  if (!files.length) {
    console.warn(`Skipping empty class folder: ${slug}`);
    continue;
  }

  const metaPath = path.join(classDir, 'class.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (error) {
      fail(`Invalid JSON in ${toPosix(path.relative(rootDir, metaPath))}: ${error.message}`);
    }
  }

  const normalized = sanitizeMeta(meta, slug, files);
  if (usedIds.has(normalized.id)) fail(`Duplicate class id: ${normalized.id}`);
  usedIds.add(normalized.id);

  if (!normalized.entry) {
    console.warn(`Warning: no HTML entry file found for ${slug}. The editor will still show text files.`);
  }

  fs.cpSync(classDir, path.join(distClassesDir, slug), { recursive: true });
  classesData.push(normalized);
}

classesData.sort((a, b) => {
  const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  return ao - bo || a.title.localeCompare(b.title);
});

fs.writeFileSync(path.join(distDir, 'classes.json'), JSON.stringify(classesData, null, 2));

console.log(`Built ${classesData.length} class${classesData.length === 1 ? '' : 'es'}.`);
for (const c of classesData) console.log(` - ${c.id}: ${c.title} (${c.files.length} files)`);
