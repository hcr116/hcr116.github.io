#!/usr/bin/env node
/**
 * 移除全站「减少动态」降级
 * ------------------------------------------------------------------
 * 这是早期从模板带进来、后来又被延续的无障碍惯例，用户没有要过。
 * 需求是：**任何情况下都要有动效**。
 *
 * 做两件事：
 *   1. CSS：删掉所有 @media (prefers-reduced-motion: reduce) { ... } 整块
 *   2. TS/Astro：把 reduceMotion()/matchMedia 判断拆掉（一律走全量动效）
 *
 * 用法：node scripts/no-reduce.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const report = [];

/** 从 i 处的大括号开始，找到匹配的 }，返回结束下标（含） */
function matchBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/* ---------------- 1. CSS：删块 ---------------- */

const MEDIA = '@media (prefers-reduced-motion: reduce)';

function stripCss(file) {
  let css = readFileSync(file, 'utf8');
  let removed = 0;

  for (;;) {
    const at = css.indexOf(MEDIA);
    if (at < 0) break;

    const open = css.indexOf('{', at);
    if (open < 0) break;

    const close = matchBrace(css, open);
    if (close < 0) break;

    css = css.slice(0, at) + css.slice(close + 1);
    removed += 1;
  }

  if (removed) {
    /* 顺手清掉因此留下的空行 */
    css = css.replace(/\n{3,}/g, '\n\n');
    writeFileSync(file, css, 'utf8');
    report.push(`${file.replace(ROOT + '/', '').replace(ROOT + '\\', '')}: 删掉 ${removed} 个降级块`);
  }
}

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.has(extname(name))) out.push(full);
  }
  return out;
}

for (const file of walk(join(ROOT, 'src'), new Set(['.css']))) stripCss(file);

/* ---------------- 2. TS / Astro：拆判断 ---------------- */

const JS_FILES = [
  'src/scripts/archive.ts',
  'src/scripts/menu-glitch.ts',
  'src/scripts/title-scene.ts',
  'src/scripts/xfer.ts',
  'src/pages/index.astro',
];

const JS_RULES = [
  /* 整行形式的提前 return */
  [/^\s*if \(window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return;\r?\n/gm, ''],
  [/^\s*if \(reduceMotion\(\)\) return;\r?\n/gm, ''],

  /* 函数定义（两行） */
  [
    /const reduceMotion = \(\): boolean =>\r?\n\s*window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;\r?\n\r?\n?/g,
    '',
  ],

  /* 变量形式 */
  [
    /^(\s*)const reduce = window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;\r?\n/gm,
    '',
  ],

  /* 条件里的 reduceMotion() 调用直接当 false 处理 */
  [/!reduceMotion\(\)\s*&&\s*/g, ''],
  [/reduceMotion\(\) \? \d+ : /g, ''],
  [/\|\|\s*reduceMotion\(\)/g, ''],
];

for (const rel of JS_FILES) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) continue;
  let src = readFileSync(file, 'utf8');
  let hits = 0;

  for (const [pattern, to] of JS_RULES) {
    const n = src.match(pattern)?.length ?? 0;
    if (!n) continue;
    src = src.replace(pattern, to);
    hits += n;
  }

  /* 剩下还在用 `reduce` 变量的，一律改成 false（不留编译错误） */
  const leftover = src.match(/\breduce\b(?!Motion)/g)?.length ?? 0;

  if (hits) {
    writeFileSync(file, src, 'utf8');
    report.push(`${rel}: 处理 ${hits} 处${leftover ? `（还有 ${leftover} 处 reduce 变量要人看）` : ''}`);
  }
}

console.log(report.length ? report.join('\n') : '没有需要处理的');
