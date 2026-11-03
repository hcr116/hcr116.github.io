#!/usr/bin/env node
/**
 * 视觉一致性收敛（一次性脚本，可重复跑）
 * ------------------------------------------------------------------
 * 把散在各文件里的近似值收敛到同一套刻度：
 *   · 圆角：3px→4px，6px→7px，1px→2px（三档：2 / 4 / 7）
 *   · 描边透明度：.14 / .16 / .18 → .16（三档：.10 / .16 / .45）
 *   · 字号：9.5→9，10.5→10，11.5→11，15.5→16（去掉半像素档）
 *   · 曲线：几条约等于"先快后慢"的 → var(--ease-film)
 *
 * 不动：abyss*.css（那是"游戏"的皮肤，隔离检查要求它独立）、
 *       title-*.css / boot.css / menu-glitch.css（标题画面自成一体）。
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TOKENS = join(ROOT, 'src/styles/global.css');

const FILES = [
  'src/styles/global.css',
  'src/styles/works-ps.css',
  'src/styles/ar-ps.css',
  'src/styles/contact.css',
  'src/styles/profile.css',
  'src/styles/article-ui.css',
  'src/styles/crt.css',
];

/* 一次性替换：左边是现在的写法，右边是收敛后的写法 */
const RULES = [
  /* 圆角 */
  [/border-radius:\s*3px/g, 'border-radius: 4px'],
  [/border-radius:\s*6px/g, 'border-radius: 7px'],
  [/border-radius:\s*1px/g, 'border-radius: 2px'],

  /* 描边透明度（只收敛"弱边"，选中态的高亮不动） */
  [/rgba\(255,\s*255,\s*255,\s*0\.14\)/g, 'rgba(255, 255, 255, 0.16)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.18\)/g, 'rgba(255, 255, 255, 0.16)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.13\)/g, 'rgba(255, 255, 255, 0.12)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.11\)/g, 'rgba(255, 255, 255, 0.12)'],

  /* 字号：去掉半像素档 + 并入主刻度（9 / 10 / 11 / 13 / 16） */
  [/font-size:\s*14px/g, 'font-size: 13px'],
  [/font-size:\s*15px/g, 'font-size: 16px'],

  /* 字距：收敛到两档（.12em 标签 / .16em 大写小字 / 2px 数字） */
  [/letter-spacing:\s*0\\.1em/g, 'letter-spacing: 0.12em'],
  [/letter-spacing:\s*0\\.14em/g, 'letter-spacing: 0.12em'],
  [/letter-spacing:\s*0\\.18em/g, 'letter-spacing: 0.16em'],

  /* 字号：去掉半像素档 */
  [/font-size:\s*9\.5px/g, 'font-size: 9px'],
  [/font-size:\s*10\.5px/g, 'font-size: 10px'],
  [/font-size:\s*11\.5px/g, 'font-size: 11px'],
  [/font-size:\s*15\.5px/g, 'font-size: 16px'],

  /* 曲线：把几条几乎一样的"先快后慢"收到一个 token */
  [/cubic-bezier\(0\.3,\s*0\.9,\s*0\.2,\s*1\)/g, 'var(--ease-film)'],
  [/cubic-bezier\(0\.22,\s*0\.9,\s*0\.2,\s*1\)/g, 'var(--ease-film)'],
  [/cubic-bezier\(0\.22,\s*0\.9,\s*0\.24,\s*1\)/g, 'var(--ease-film)'],
  [/cubic-bezier\(0\.22,\s*0\.61,\s*0\.36,\s*1\)/g, 'var(--ease-film)'],
];

const report = [];

for (const rel of FILES) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) continue;
  let css = readFileSync(file, 'utf8');
  let changed = 0;

  for (const [pattern, to] of RULES) {
    const hits = css.match(pattern)?.length ?? 0;
    if (!hits) continue;
    css = css.replace(pattern, to);
    changed += hits;
  }

  if (changed) {
    writeFileSync(file, css, 'utf8');
    report.push(`${rel}: ${changed} 处`);
  }
}

/* 补 token（只在还没有的时候加一次） */
if (existsSync(TOKENS)) {
  let css = readFileSync(TOKENS, 'utf8');
  if (!css.includes('--ease-film')) {
    css = css.replace(
      /:root\s*\{/,
      `:root {
  /* ---- 统一刻度（收敛多套近似值，别再加新档） ----
     圆角：2（小块）/ 4（卡片）/ 7（大方块）
     描边：.10 弱 / .16 中 / .45 高亮
     字号：9 / 10 / 11 / 13 / 16（再大的是展示字，单独处理）
     曲线：先快后慢一律用 --ease-film */
  --r-xs: 2px;
  --r-sm: 4px;
  --r-md: 7px;
  --line-weak: rgba(255, 255, 255, 0.1);
  --line-mid: rgba(255, 255, 255, 0.16);
  --line-strong: rgba(255, 255, 255, 0.45);
  --ease-film: cubic-bezier(0.22, 0.9, 0.2, 1);`,
    );
    writeFileSync(TOKENS, css, 'utf8');
    report.push('global.css: 已加入 token 定义');
  }
}

console.log(report.length ? report.join('\n') : '没有需要收敛的值');
