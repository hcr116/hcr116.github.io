#!/usr/bin/env node
/**
 * 字体子集化
 * ------------------------------------------------------------------
 * Zpix 全字库 922KB，首屏必等它。这里把它裁到「站里用到的字 + GB2312 一级常用字」，
 * 一般是 200KB 上下，首屏能快 1 秒以上。
 *
 * 为什么要带常用字：只裁"当前用到的字"最省，但你以后在文案表里加一句话，
 * 里面有个没裁进去的字，就会掉回系统等宽字体 —— 一眼看得出来。
 * 带上 3755 个一级常用字，等于留了一个安全垫。
 *
 * 依赖：python + fonttools + brotli
 *   python -m pip install fonttools brotli
 *
 * 用法：
 *   node scripts/font-subset.mjs            # 用系统 python
 *   PYTHON=... node scripts/font-subset.mjs # 指定 python
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
/* 全字库放在 assets/ 里（不进 public，避免把 922KB 也部署上去） */
const IN = join(ROOT, 'assets/fonts/zpix.woff2');
const OUT = join(ROOT, 'public/fonts/zpix-subset.woff2');
const CHARS = join(ROOT, 'tmp/font-chars.txt');

const PY = process.env.PYTHON || 'python';

const EXTS = new Set(['.astro', '.md', '.ts', '.mjs', '.csv', '.json', '.html', '.txt']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

/* ---------- 1. 收集站里真正用到的字符 ---------- */

const used = new Set();
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const ch of text) {
    const code = ch.codePointAt(0);
    /* 只收看得见的字符：CJK、拉丁、数字、常见标点 */
    if (code < 0x20) continue;
    if (code >= 0x4e00 && code <= 0x9fff) used.add(ch);
    else if (code >= 0x3000 && code <= 0x303f) used.add(ch); // CJK 标点
    else if (code >= 0xff00 && code <= 0xffef) used.add(ch); // 全角
    else if (code >= 0x20 && code <= 0x7e) used.add(ch); // ASCII
    else if ('—…·→←↑↓×÷•◦●○◇◆△▽▲▼■□★☆✓✕'.includes(ch)) used.add(ch);
  }
}

/* ---------- 2. 安全垫：GB2312 一级常用字（3755 个） ---------- */

const common = [];
const decoder = new TextDecoder('gbk');
for (let hi = 0xb0; hi <= 0xd7; hi += 1) {
  for (let lo = 0xa1; lo <= 0xfe; lo += 1) {
    const ch = decoder.decode(new Uint8Array([hi, lo]));
    if (ch && ch.length === 1 && ch !== '\uFFFD') common.push(ch);
  }
}

for (const ch of common) used.add(ch);

/* ---------- 3. 写字符集 + 调 pyftsubset ---------- */

if (!existsSync(IN)) {
  console.error(`[font] 找不到 ${IN}`);
  process.exit(1);
}

writeFileSync(CHARS, [...used].join(''), 'utf8');

const before = statSync(IN).size;

const args = [
  '-m',
  'fontTools.subset',
  IN,
  `--text-file=${CHARS}`,
  `--output-file=${OUT}`,
  '--flavor=woff2',
  '--layout-features=*',
  '--no-hinting',
  '--desubroutinize',
  '--drop-tables+=DSIG',
];

const res = spawnSync(PY, args, { encoding: 'utf8' });
if (res.status !== 0) {
  console.error('[font] 子集化失败：');
  console.error((res.stdout ?? '') + (res.stderr ?? ''));
  console.error('提示：需要 python + fonttools + brotli（python -m pip install fonttools brotli）');
  process.exit(1);
}

const after = statSync(OUT).size;
const pct = ((1 - after / before) * 100).toFixed(1);

console.log(`[font] 用到的字符 ${used.size} 个（含 GB2312 一级常用字 ${common.length} 个）`);
console.log(`[font] ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB（省 ${pct}%）`);
console.log(`[font] 输出 ${OUT.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
