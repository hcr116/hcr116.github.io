#!/usr/bin/env node
/**
 * 读水印：把一段文字里的零宽水印解出来
 * ------------------------------------------------------------------
 * 用法：
 *   node scripts/wm-check.mjs                # 解 built 站里第一段正文
 *   node scripts/wm-check.mjs "<粘贴的文字>"
 *   node scripts/wm-check.mjs --file some.txt
 *
 * 场景：有人把你整段拆解搬到别处，你把那段文字喂给这个脚本，
 * 能读出来源（默认编码 hcr116.github.io）。
 */

import { readFileSync, existsSync } from 'node:fs';
import { wmDecode } from '../src/scripts/watermark.ts';

const args = process.argv.slice(2);

let text = '';

if (args[0] === '--file' && args[1]) {
  text = readFileSync(args[1], 'utf8');
} else if (args.length) {
  text = args.join(' ');
} else {
  /* 没给参数：从构建产物里抽一段正文来验证水印确实在 */
  const page = 'dist/articles/combat/index.html';
  if (!existsSync(page)) {
    console.error('[wm] 没有参数，且找不到 dist/articles/combat/index.html（先 npm run build）');
    process.exit(1);
  }
  text = readFileSync(page, 'utf8');
  console.log('[wm] 在构建产物里找水印…');
}

const found = wmDecode(text);
const zeroWidth = (text.match(/[\u200b\u200c]/g) ?? []).length;

if (found) {
  console.log(`[wm] 水印内容：${found}`);
  console.log(`[wm] 零宽字符数：${zeroWidth}`);
} else {
  console.log('[wm] 没找到水印');
  console.log(`[wm] 文本里零宽字符数：${zeroWidth}（0 说明这段文字没经过带水印的页面）`);
  process.exit(1);
}
