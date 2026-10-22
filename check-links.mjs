/**
 * 部署前自检：扫描 dist/ 里所有本地 href/src，确认目标文件真实存在。
 * 用法：node scripts/check-links.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

function listPages(dir = DIST, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listPages(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function resolves(url) {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('mailto:') || url.startsWith('#')) return true;
  const clean = url.split('?')[0].split('#')[0];
  const target = join(DIST, clean);
  if (existsSync(target) && statSync(target).isFile()) return true;
  if (existsSync(join(target, 'index.html'))) return true;
  return false;
}

const pages = listPages();
let checked = 0;
let missing = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const url of new Set(urls)) {
    checked++;
    if (!resolves(url)) {
      missing++;
      console.log(`  ✗ ${page} → ${url}`);
    }
  }
}

console.log(`\n扫描 ${pages.length} 个页面，检查 ${checked} 个引用，失效 ${missing} 个`);
process.exit(missing === 0 ? 0 : 1);
