#!/usr/bin/env node
/**
 * 动效护栏
 * ------------------------------------------------------------------
 * 起因：`--ease-film: var(--ease-film)` 自己引自己 + 压缩器删掉"没被用到"的变量，
 * 导致全站 `transition: ... var(--ease-film)` 整条失效 —— 页面看起来"没有动效"，
 * 而状态断言（探针）全部通过，因为**状态是对的，只是没有过渡**。
 *
 * 这个脚本专门查这一类"声明写了但无效"的问题：
 *
 *   A. 静态：构建出来的 CSS 里，凡是用 var(--x) 的，--x 必须有定义，
 *      且不能自己引自己。压缩器删变量、手滑写自引用，都会在这里被抓到。
 *   B. 运行时：拿无头浏览器打开关键页面，量关键元素的计算样式，
 *      transition-duration 不能是 0s（除非明确允许）
 *
 * 用法：
 *   node scripts/check-motion.mjs          # A + B
 *   node scripts/check-motion.mjs --static # 只跑 A（快，不用浏览器）
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const STATIC_ONLY = process.argv.includes('--static');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let failed = 0;
const fail = (msg) => {
  console.log(`  ✗ ${msg}`);
  failed += 1;
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

/* ============================================================
   A. 静态：var() 必须都有定义
   ============================================================ */

function cssFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
  return out;
}

console.log('\n▌ A. 静态检查：CSS 变量的定义与引用');

const files = existsSync(DIST) ? cssFiles(DIST) : [];
if (!files.length) {
  fail('dist 里没有 CSS（先 npm run build）');
} else {
  const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');

  /* 变量还可能写在 HTML 的内联 style 里，或者由 JS 用 setProperty 注入
     （--x / --gx 这种）。这两类都算"有定义"，否则护栏天天误报，最后没人看。 */
  const extra = [];
  for (const name of readdirSync(DIST)) {
    if (name.endsWith('.html')) extra.push(readFileSync(join(DIST, name), 'utf8'));
  }
  const jsDir = join(DIST, '_astro');
  if (existsSync(jsDir)) {
    /* 递归：分块脚本可能在子目录里 */
    const stack = [jsDir];
    while (stack.length) {
      const dir = stack.pop();
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (name.endsWith('.js')) extra.push(readFileSync(full, 'utf8'));
      }
    }
  }
  const inlineText = extra.join('\n');

  /* 定义：--name: 值（排除 var(--name) 这种自引用形式） */
  const defined = new Set();
  const selfRef = new Set();
  for (const m of all.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g)) {
    const [, name, value] = m;
    defined.add(name);
    if (new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(value)) selfRef.add(name);
  }

  /* HTML 内联 style 里写的 --x: 值 */
  for (const m of inlineText.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    defined.add(m[1]);
  }
  /* JS 里 setProperty('--x', ...) 注入的 */
  for (const m of inlineText.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9-]+)['"]/g)) {
    defined.add(m[1]);
  }

  /* 引用：var(--name) 或 var(--name, fallback) */
  const used = new Map();
  for (const m of all.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,?)\s*([^)]*)\)/g)) {
    const [, name, comma, fallback] = m;
    if (comma) continue; /* 有兜底值：变量丢了也不会失效 */
    used.set(name, (used.get(name) ?? 0) + 1);
  }

  if (selfRef.size) {
    for (const name of selfRef) fail(`${name} 自己引自己（整条声明会失效）`);
  } else {
    pass('没有自引用的变量');
  }

  const missing = [...used.entries()].filter(([name]) => !defined.has(name));
  if (missing.length) {
    for (const [name, n] of missing) {
      fail(`${name} 被引用 ${n} 次，但构建产物里没有定义（压缩器可能把它删了）`);
    }
  } else {
    pass(`所有 var() 引用都有定义（${used.size} 个变量）`);
  }
}

/* ============================================================
   B. 运行时：关键元素的 transition 不能是 0s
   ============================================================ */

const CASES = [
  {
    url: '/works/',
    name: '作品页 · 存档层',
    /* 像用户那样先点开频道（深链 ?ch= 走的是 is-vfx-instant，本来就该没有过渡） */
    click: '.ws-tile[href="#vfx"]',
    selectors: ['.ws-vfx', '.ws-vfx-card'],
  },
  {
    url: '/articles/',
    name: '文章页 · 存档层',
    click: '.ar-tile',
    selectors: ['.ws-vfx'],
  },
];

const probe = (selectors, click) => `
<script>
window.addEventListener('load', () => setTimeout(async () => {
  /* 先点开频道，让"打开"这条路径真的跑一遍 */
  const trigger = ${JSON.stringify(click)} ? document.querySelector(${JSON.stringify(click)}) : null;
  if (trigger) {
    trigger.click();
    await new Promise((r) => setTimeout(r, 700));
  }

  const out = [];
  for (const sel of ${JSON.stringify(selectors)}) {
    const el = document.querySelector(sel);
    if (!el) { out.push({ sel, ok: false, info: '元素不存在' }); continue; }
    const cs = getComputedStyle(el);
    const durations = cs.transitionDuration.split(',').map((s) => parseFloat(s) || 0);
    const max = Math.max(...durations);
    out.push({ sel, ok: max > 0.01, info: 'duration=' + cs.transitionDuration });
  }
  const d = document.createElement('div');
  d.id = 'motion-result';
  d.textContent = JSON.stringify(out);
  document.body.appendChild(d);
}, 1400));
</script>`;

if (!STATIC_ONLY) {
  console.log('\n▌ B. 运行时检查：关键元素的过渡时长');

  if (!existsSync(EDGE)) {
    fail(`找不到 Edge：${EDGE}（可以用 EDGE=... 指定）`);
  } else {
    for (const item of CASES) {
      const page = join(DIST, item.url.split('?')[0].replace(/\/$/, ''), 'index.html');
      const fromRoot = join(DIST, item.url.split('?')[0].replace(/^\//, ''), 'index.html');
      const source = existsSync(fromRoot) ? fromRoot : page;
      if (!existsSync(source)) {
        fail(`${item.name}：构建产物里找不到这个页面`);
        continue;
      }

      /* 把探针注入一份临时副本，放到 dist 根下，保证相对路径还对 */
      const base = item.url.split('?')[0].replace(/\/$/, '') || '';
      const tmpName = `__motion${base.replace(/\//g, '-')}.html`;
      const tmpPath = join(DIST, tmpName);
      const html = readFileSync(source, 'utf8').replace('</body>', probe(item.selectors, item.click) + '</body>');
      /* 用 .html 直出的话样式是相对 /_astro/，没问题；query 手动带上 */
      writeFileSync(tmpPath, html, 'utf8');

      const shot = mkdtempSync(join(tmpdir(), 'motion-'));
      const res = spawnSync(
        EDGE,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--no-first-run',
          '--mute-audio',
          '--force-prefers-reduced-motion', /* 系统"减少动画"开着也必须动 */
          `--user-data-dir=${shot}`,
          '--window-size=1280,860',
          '--virtual-time-budget=8000',
          '--dump-dom',
          `http://127.0.0.1:4321/${tmpName}${item.url.includes('?') ? '?' + item.url.split('?')[1] : ''}`,
        ],
        { encoding: 'utf8', timeout: 60_000 },
      );

      rmSync(shot, { recursive: true, force: true });
      rmSync(tmpPath, { force: true });

      const m = /<div id="motion-result">([^<]*)<\/div>/.exec(res.stdout ?? '');
      if (!m) {
        fail(`${item.name}：没拿到结果（预览服务器没开？node_modules/.bin/astro preview）`);
        continue;
      }

      const rows = JSON.parse(m[1]);
      for (const row of rows) {
        if (row.ok) pass(`${item.name} ${row.sel}  ${row.info}`);
        else fail(`${item.name} ${row.sel}  ${row.info} ← 这条过渡无效（动画不会发生）`);
      }
    }
  }
}

console.log('');
if (failed) {
  console.log(`动效护栏：${failed} 项失败`);
  process.exit(1);
}
console.log('动效护栏：全部通过（变量都有定义，关键过渡时长不为 0）');
