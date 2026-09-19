import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const password = process.env.CLASS_ACCESS_PASSWORD || '';
if (!password) throw new Error('CLASS_ACCESS_PASSWORD is required for build verification.');

const mustExist = [
  'index.html', 'app.js', 'styles.css', 'sw.js', 'data/catalog.enc.json', 'data/site.json',
  'data/build-info.json', 'sitemap.xml', 'assets/vendor/jszip.min.js', 'site.webmanifest'
];
for (const rel of mustExist) {
  if (!fs.existsSync(path.join(dist, rel))) throw new Error(`Missing build output: ${rel}`);
}

const files = [];
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p); else files.push(path.relative(dist, p).replaceAll(path.sep, '/'));
  }
})(dist);
if (files.some(f => f.startsWith('Classes/') || f.startsWith('Blogs/'))) throw new Error('Raw source content leaked into dist.');

const b64 = (s) => Buffer.from(s, 'base64');
function decrypt(envelope) {
  const key = crypto.pbkdf2Sync(Buffer.from(password), Buffer.from(envelope.salt, 'hex'), envelope.iterations, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, b64(envelope.iv));
  decipher.setAAD(Buffer.from(envelope.aad || ''));
  decipher.setAuthTag(b64(envelope.tag));
  return Buffer.concat([decipher.update(b64(envelope.data)), decipher.final()]);
}

const catalogEnvelope = JSON.parse(fs.readFileSync(path.join(dist, 'data/catalog.enc.json'), 'utf8'));
if (catalogEnvelope.algorithm !== 'AES-256-GCM' || !catalogEnvelope.data || !catalogEnvelope.aad) throw new Error('Invalid catalog envelope.');
let catalog;
try { catalog = JSON.parse(decrypt(catalogEnvelope).toString('utf8')); } catch { throw new Error('Catalog decryption failed.'); }
if (!Array.isArray(catalog.classes) || !Array.isArray(catalog.blogs)) throw new Error('Decrypted catalog has invalid collections.');

const buildInfo = JSON.parse(fs.readFileSync(path.join(dist, 'data/build-info.json'), 'utf8'));
if (buildInfo.classes !== catalog.classes.length || buildInfo.blogs !== catalog.blogs.length) throw new Error('build-info.json counts do not match catalog.');

for (const [kind, items] of [['classes', catalog.classes], ['blogs', catalog.blogs]]) {
  for (const item of items) {
    if (!item.resource || !item.resource.startsWith(`./data/${kind}/`)) throw new Error(`Invalid ${kind} resource path: ${item.resource}`);
    const rel = item.resource.slice(2);
    const full = path.join(dist, rel);
    if (!fs.existsSync(full)) throw new Error(`Missing catalog resource: ${item.resource}`);
    const env = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (env.algorithm !== 'AES-256-GCM' || !env.data) throw new Error(`Invalid encrypted resource: ${item.resource}`);
    const tmp = path.join(os.tmpdir(), `oml-${kind}-${crypto.randomUUID()}.zip`);
    try {
      fs.writeFileSync(tmp, decrypt(env));
      execFileSync('unzip', ['-tq', tmp], { stdio: 'pipe' });
    } finally { try { fs.unlinkSync(tmp); } catch {} }
  }
}

const site = JSON.parse(fs.readFileSync(path.join(dist, 'data/site.json'), 'utf8'));
if (site.portfolioUrl && !/^https?:\/\//i.test(site.portfolioUrl)) throw new Error('site.json contains an invalid portfolio URL.');
if (!fs.readFileSync(path.join(dist, 'assets/vendor/jszip.min.js'), 'utf8').includes('JSZip')) throw new Error('Local JSZip vendor file looks invalid.');
if (/demo-only-change-me/.test(files.map(f => fs.readFileSync(path.join(dist, f), 'utf8')).filter(Boolean).join('\n'))) throw new Error('Demo password leaked into build.');

console.log(`Build verification passed: ${catalog.classes.length} classes, ${catalog.blogs.length} blogs, all catalog resources exist and decrypt successfully.`);
