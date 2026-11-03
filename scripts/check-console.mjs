#!/usr/bin/env node
/**
 * 控制台错误巡检
 * ------------------------------------------------------------------
 * 逐页打开，收集 window.onerror / unhandledrejection，报告有没有运行时错误。
 *
 * 为什么需要：Astro 构建**不做类型检查**，`.astro` 的 <script> 里用了个
 * 不存在的变量，构建照样通过，只在浏览器里炸（之前踩过：t is not defined，
 * 整段脚本失效，页面"看起来正常"但所有交互都没了）。
 *
 * 用法：
 *   npm run console            # 巡检全部页面
 *   node scripts/check-console.mjs articles
 *
 * 前提：预览服务在跑（node node_modules/astro/astro.js preview --port 4321）。
 */

import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:4321';
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));

/** 找到 dist 里所有的页面（有 index.html 的目录） */
function findPages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findPages(full));
    else if (name === 'index.html') out.push(relative(DIST, full).replace(/\\/g, '/'));
  }
  return out;
}

const COLLECTOR = `
<script>
  window.__errors = [];
  window.addEventListener('error', (e) => {
    window.__errors.push('error: ' + (e.message || String(e.error)));
  });
  window.addEventListener('unhandledrejection', (e) => {
    window.__errors.push('reject: ' + String(e.reason));
  });
  window.addEventListener('load', () => {
    setTimeout(() => {
      const box = document.createElement('div');
      box.id = '__page_errors';
      box.textContent = JSON.stringify(window.__errors);
      document.body.appendChild(box);
    }, 1800);
  });
</script>`;

const pages = findPages(DIST)
  .map((p) => (p === 'index.html' ? '/' : '/' + p.replace(/\/index\.html$/, '/')))
  .filter((p) => !filter || p.includes(filter))
  .sort();

if (!pages.length) {
  console.error('[console] 没找到要巡检的页面');
  process.exit(1);
}

let bad = 0;

for (const page of pages) {
  const file = page === '/' ? join(DIST, 'index.html') : join(DIST, page, 'index.html');
  const html = readFileSync(file, 'utf8');
  const tmpName = `__console${page.replace(/[^\w]/g, '_') || 'root'}.html`;
  const tmp = join(DIST, tmpName);
  writeFileSync(tmp, html.replace('</body>', COLLECTOR + '</body>'), 'utf8');

  const profile = join(ROOT, 'tmp', 'console', tmpName);
  const res = spawnSync(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${profile}`,
      '--window-size=1280,860',
      '--virtual-time-budget=9000',
      '--dump-dom',
      `${BASE}/${tmpName}`,
    ],
    { encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
  );

  try {
    unlinkSync(tmp);
  } catch {
    /* 清理失败不影响结果 */
  }

  const dom = res.stdout ?? '';
  const match = dom.match(/<div id="__page_errors">([\s\S]*?)<\/div>/);
  if (!match) {
    console.log(`  ? ${page}  没拿到结果（页面可能没加载完）`);
    continue;
  }

  const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  let errors = [];
  try {
    errors = JSON.parse(raw);
  } catch {
    errors = ['? 解析失败：' + raw.slice(0, 80)];
  }

  if (errors.length) {
    bad += 1;
    console.log(`  ✗ ${page}`);
    for (const e of errors) console.log(`      ${e}`);
  } else {
    console.log(`  ✓ ${page}`);
  }
}

console.log('');
console.log(bad ? `有 ${bad} 个页面报错` : `全部 ${pages.length} 个页面没有运行时错误`);
process.exit(bad ? 1 : 0);
