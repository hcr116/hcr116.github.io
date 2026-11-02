#!/usr/bin/env node
/**
 * 截图处理：把原图压成站上能用的尺寸，顺手生成 frontmatter 片段。
 * --------------------------------------------------------------------------
 * 用法：
 *   node scripts/img.mjs <图片...>                    # 默认进 public/images/ai
 *   node scripts/img.mjs a.png b.png --out ai --width 1600
 *   node scripts/img.mjs shot.png --ratio 16:10 --quality 82
 *   node scripts/img.mjs shot.png --mask              # 标记为「隐私打码」
 *
 * 参数：
 *   --out <目录>      输出到 public/images/<目录>，默认 ai
 *   --width <px>      最大宽度，默认 1600（不放大，只缩）
 *   --ratio <w:h>     裁成这个比例（居中裁切），不填就保比例
 *   --quality <1-100> JPEG 质量，默认 82
 *   --mask            生成片段时给这条加 blur: true
 *   --png             输出 PNG（默认 JPEG；有透明通道会自动用 PNG）
 *
 * 为什么要有这个：public 里以前堆了 33MB 原图，很多单张 2MB，
 * 手机上打开要等好几秒。统一压到 1600px 宽、JPEG 82 之后，一张通常 150-300KB。
 */

import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public', 'images');

const argv = process.argv.slice(2);
const files = [];
const opt = { out: 'ai', width: 1600, ratio: '', quality: 82, mask: false, png: false };

for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--out') opt.out = argv[++i];
  else if (a === '--width') opt.width = Number(argv[++i]) || 1600;
  else if (a === '--ratio') opt.ratio = argv[++i] ?? '';
  else if (a === '--quality') opt.quality = Number(argv[++i]) || 82;
  else if (a === '--mask') opt.mask = true;
  else if (a === '--png') opt.png = true;
  else if (a.startsWith('--')) {
    console.error(`不认识的参数：${a}`);
    process.exit(1);
  } else files.push(a);
}

if (!files.length) {
  console.error('用法：node scripts/img.mjs <图片...> [--out ai] [--width 1600] [--ratio 16:10] [--quality 82] [--mask]');
  process.exit(1);
}

/** "16:10" → { w: 16, h: 10 } */
function parseRatio(text) {
  const m = /^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(text.trim());
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]) };
}

const ratio = parseRatio(opt.ratio);
const outDir = join(PUBLIC, opt.out);
if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

const kb = (n) => `${Math.round(n / 1024)}KB`;
const snippets = [];

for (const file of files) {
  const input = resolve(file);
  if (!existsSync(input)) {
    console.error(`× 找不到 ${file}`);
    continue;
  }

  const before = (await stat(input)).size;
  let pipe = sharp(input, { failOn: 'none' }).rotate();
  const meta = await pipe.metadata();

  // 先裁再缩：裁切的目标宽高由比例决定，避免"先缩后裁"损失分辨率
  if (ratio) {
    const w = Math.min(meta.width ?? opt.width, opt.width);
    const h = Math.round((w * ratio.h) / ratio.w);
    pipe = sharp(input, { failOn: 'none' })
      .rotate()
      .resize(w, h, { fit: 'cover', position: 'centre', withoutEnlargement: false });
  } else {
    pipe = pipe.resize({ width: opt.width, withoutEnlargement: true });
  }

  const hasAlpha = Boolean(meta.hasAlpha);
  // 默认出 JPEG：截图基本不需要透明，PNG 会大两三倍。
  // 真有透明需求就加 --png；带透明但出 JPEG 时垫一层网页底色，避免透明区变白。
  const usePng = opt.png;
  if (!usePng && hasAlpha) pipe = pipe.flatten({ background: '#0b0c10' });
  const name = basename(input, extname(input)).replace(/[^\w.-]+/g, '-').toLowerCase();
  const outName = `${name}.${usePng ? 'png' : 'jpg'}`;
  const outPath = join(outDir, outName);

  const info = await (usePng
    ? pipe.png({ compressionLevel: 9 })
    : pipe.jpeg({ quality: opt.quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
  ).toFile(outPath);

  console.log(
    `${outName.padEnd(34)} ${kb(before).padStart(7)} → ${kb(info.size).padStart(7)}   ${info.width}×${info.height}${ratio ? `  (${opt.ratio})` : ''}`,
  );

  snippets.push(
    `          - src: '/images/${opt.out}/${outName}'` +
      `\n            alt: ''` +
      (opt.mask ? `\n            blur: true` : ''),
  );
}

console.log(`\n已写入 public/images/${opt.out}/`);
if (snippets.length) {
  console.log('\n粘到 frontmatter 的 shots 里：\n');
  console.log('      shots:\n' + snippets.join('\n'));
}
