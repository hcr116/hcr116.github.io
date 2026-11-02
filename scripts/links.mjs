#!/usr/bin/env node
/**
 * 每次改完跑一下：打印当前构建的版本号 + 带 ?v= 的链接。
 *
 * 为什么要带 ?v=：页面 HTML 是 no-cache，但浏览器有时候还是会拿旧副本
 * （尤其是切回来没刷新、或者上次 reload 被打断）。带一个每次都变的查询参数
 * 就是个永不撞车的缓存键——文件还是那些文件，只是浏览器不能复用旧的。
 *
 * 用法：node scripts/links.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');

const m = html.match(/<meta name="dsh-build" content="([^"]+)"/);
if (!m) {
  console.error('dist/index.html 里没有 dsh-build —— 先跑 astro build');
  process.exit(1);
}

const iso = m[1];
const stamp = new Date(iso);
const pad = (n) => String(n).padStart(2, '0');
const local = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(
  stamp.getHours(),
)}:${pad(stamp.getMinutes())}:${pad(stamp.getSeconds())}`;
const v = String(stamp.getTime());

const base = 'http://127.0.0.1:4321';
const pages = [
  ['标题页（会播启动动画）', `${base}/?boot=1&v=${v}`],
  ['标题页（直接看菜单）', `${base}/?state=home&v=${v}`],
  ['作品', `${base}/works/?v=${v}`],
  ['文章', `${base}/articles/?v=${v}`],
  ['关于', `${base}/about/?v=${v}`],
];

console.log(`构建时间  ${local}`);
console.log(`版本号    ${v}`);
console.log('');
for (const [label, url] of pages) console.log(`${label}\n  ${url}`);
