#!/usr/bin/env node
/**
 * 给视频烧可见水印
 * ------------------------------------------------------------------
 * 目的不是"防下载"（下载拦不住），而是**截图被转出去时能看出出处**。
 *
 * 样式：左下角一行极淡的小字 `hcr116.github.io`，字号按视频宽度算，
 * 不遮挡画面主体（引擎自带的水印在右下，两边对称）。
 *
 * 用法：
 *   node scripts/vfx-watermark.mjs            # 处理 public/video/vfx/*.mp4
 *   node scripts/vfx-watermark.mjs --dry      # 只看会做什么
 */

import { readdirSync, statSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG =
  process.env.FFMPEG ||
  'C:\\Users\\chenrui.huang\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';

const DIR = join(process.cwd(), 'public/video/vfx');
const TEXT = 'hcr116.github.io';
/* Windows 上的 ffmpeg 没有 fontconfig，必须显式给字体文件；
   用等宽 Consolas，和站里的像素字气质接近。 */
const FONT = process.env.FONT || 'C:/Windows/Fonts/consola.ttf';
const DRY = process.argv.includes('--dry');

if (!existsSync(FFMPEG)) {
  console.error(`[vfx-wm] 找不到 ffmpeg：${FFMPEG}\n        可以用 FFMPEG=... 指定`);
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.mp4')).sort();
if (!files.length) {
  console.error('[vfx-wm] 没有 mp4 可处理');
  process.exit(1);
}

for (const name of files) {
  const src = join(DIR, name);
  const tmp = join(DIR, name.replace(/\.mp4$/, '.wm.mp4'));
  const before = statSync(src).size;

  /* 字号跟着宽度走：1280 宽时 22px；位置在左下，留 28px 边距 */
  const vf =
    `drawtext=fontfile='${FONT.replace(/:/g, '\\:')}':text='${TEXT}':` +
    `fontsize=max(16\\,w*0.017):` +
    `fontcolor=white@0.28:` +
    `x=28:y=h-th-24:` +
    `shadowcolor=black@0.5:shadowx=1:shadowy=1`;

  const args = [
    '-y',
    '-i',
    src,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-crf',
    '26',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    tmp,
  ];

  if (DRY) {
    console.log(`[vfx-wm] 会处理 ${name}（${(before / 1024).toFixed(0)} KB）`);
    continue;
  }

  const res = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`[vfx-wm] ${name} 失败：\n${(res.stderr ?? '').split('\n').slice(-6).join('\n')}`);
    continue;
  }

  const after = statSync(tmp).size;
  renameSync(tmp, src);
  console.log(
    `[vfx-wm] ${name}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`,
  );
}

console.log('[vfx-wm] 完成');
