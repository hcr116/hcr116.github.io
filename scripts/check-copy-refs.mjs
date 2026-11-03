#!/usr/bin/env node
/**
 * 检查客户端脚本有没有漏 import 文案表
 * ------------------------------------------------------------------
 * 为什么需要它：Astro 构建**不做类型检查**，所以 .astro 的 <script> 里
 * 用了 t() / ct() / tf() 却没 import 时，构建照样通过——
 * 直到浏览器里抛 ReferenceError，整段脚本挂掉（点击、按键全失效）。
 *
 * 这个脚本就是把那次事故变成一个能提前发现的问题：
 *   凡是 <script> 里出现 t( / ct( / tf( 的，必须在同一段里 import 过。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const pagesDir = join(root, 'src/pages');

/** 递归找 .astro */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.astro')) out.push(full);
  }
  return out;
}

const problems = [];

for (const file of walk(pagesDir)) {
  const src = readFileSync(file, 'utf8');
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];

  for (const [i, block] of blocks.entries()) {
    const code = block[1];
    const used = ['t', 'ct', 'tf'].filter((fn) => new RegExp(`(^|[^\\w.$])${fn}\\(`).test(code));
    if (!used.length) continue;

    const imported = new Set(
      [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*data\/copy['"]/g)]
        .flatMap((m) => m[1].split(','))
        .map((s) => s.trim().split(/\s+as\s+/).pop())
        .filter(Boolean),
    );

    const missing = used.filter((fn) => !imported.has(fn));
    if (missing.length) {
      problems.push(
        `${relative(root, file)} 第 ${i + 1} 段 <script>：用了 ${missing.join(', ')} 但没 import（会抛 ReferenceError，整段脚本失效）`,
      );
    }
  }
}

if (problems.length) {
  console.error('[copy-refs] 客户端脚本引用了文案表却没 import：\n' + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}

console.log('[copy-refs] 客户端脚本的文案引用都 import 了');
