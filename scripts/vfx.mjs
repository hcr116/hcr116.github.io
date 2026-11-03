#!/usr/bin/env node
/**
 * 录屏 → 网页用视频（批量）
 * ------------------------------------------------------------------
 * 把一堆原始录屏（mp4/mov/mkv/avi/flv/wmv，手机/QQ/OBS 导出的都行）压成
 * 网页能直接播的小文件，并且顺手截一张 poster 封面。
 *
 * 用法：
 *   node scripts/vfx.mjs <源目录> [--out public/video/vfx] [--width 1280]
 *                        [--crf 26] [--fps 30] [--max 20] [--start 0]
 *
 * 例：
 *   node scripts/vfx.mjs "D:\CloudMusic\vfx" --max 15
 *   node scripts/vfx.mjs ./src-video --width 960 --crf 28
 *
 * 输出：
 *   <out>/<名字>.mp4     H.264 / yuv420p / faststart，能直接 <video> 播
 *   <out>/<名字>.jpg     poster（第 0.8 秒那一帧，切到 4:3 之外不会黑屏）
 *   最后打印一段可以直接贴进 content 的 YAML
 *
 * 为什么用 H.264 不用 VP9/AV1：录屏是静态画面多，H.264 体积已经够小，
 * 而且 Safari 直接支持；VP9 还得再带一份回退，不值。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.flv', '.wmv', '.webm', '.m4v']);

/* ---------- 找 ffmpeg ---------- */
function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    'C:\\Users\\chenrui.huang\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe',
    'ffmpeg',
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      execFileSync(c, ['-hide_banner', '-version'], { stdio: 'ignore' });
      return c;
    } catch {
      /* 试下一个 */
    }
  }
  return null;
}

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const src = argv.find((a) => !a.startsWith('--'));
if (!src) {
  console.error('用法：node scripts/vfx.mjs <源目录> [--out public/video/vfx] [--width 1280] [--crf 26] [--fps 30] [--max 20] [--start 0]');
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const outDir = resolve(flag('out', 'public/video/vfx'));
const width = Number(flag('width', 1280));
const crf = Number(flag('crf', 26));
const fps = Number(flag('fps', 30));
const maxSeconds = Number(flag('max', 20));
const startAt = Number(flag('start', 0));
const smart = argv.includes('--smart');
/** --smart 模式下，超过这个体积才重编码；没超过只换封装（画质零损失） */
const reencodeOver = Number(flag('over', 2.5)) * 1024 * 1024;
/** 源文件顺序按修改时间（QQ 缓存里按导出先后） */
const byTime = argv.includes('--by-time');

const ffmpeg = findFfmpeg();
if (!ffmpeg) {
  console.error('找不到 ffmpeg。装一个：winget install Gyan.FFmpeg，或者设置 FFMPEG_PATH。');
  process.exit(1);
}

/* ---------- 收集源文件 ---------- */
const srcDir = resolve(src);
if (!existsSync(srcDir)) {
  console.error(`目录不存在：${srcDir}`);
  process.exit(1);
}

const files = readdirSync(srcDir)
  .filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()))
  .map((f) => join(srcDir, f))
  .sort((a, b) => (byTime ? statSync(a).mtimeMs - statSync(b).mtimeMs : a.localeCompare(b)));

if (!files.length) {
  console.error(`目录里没有视频文件：${srcDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

console.log(`源目录  ${srcDir}`);
console.log(`输出    ${outDir}`);
console.log(`规则    ${width}px 宽 · CRF ${crf} · ${fps}fps · 最多 ${maxSeconds}s\n`);

const manifest = [];
let totalIn = 0;
let totalOut = 0;

for (const file of files) {
  const name = basename(file, extname(file))
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const mp4 = join(outDir, `${name}.mp4`);
  const jpg = join(outDir, `${name}.jpg`);

  const inSize = statSync(file).size;
  totalIn += inSize;

  /* --smart：小的只换封装（不动画质），大的才重编码。
   * QQ / 微信缓存出来的片子本身已经被压过一遍，再压一次会糊；
   * 所以只有明显超重（默认 > 2.5MB）的才值得重新编码。 */
  const passthrough = smart && inSize <= reencodeOver;

  process.stdout.write(`· ${basename(file)} → ${name}.mp4 `);

  try {
    if (passthrough) {
      execFileSync(
        ffmpeg,
        ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-c', 'copy', '-movflags', '+faststart', mp4],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
    } else {
      execFileSync(
        ffmpeg,
        [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-ss',
          String(startAt),
          '-t',
          String(maxSeconds),
          '-i',
          file,
          // 只缩不放：比目标窄的保持原宽度，宽高取偶数（H.264 要求）
          '-vf',
          `scale='min(${width},iw)':-2:flags=lanczos,fps=${fps}`,
          '-c:v',
          'libx264',
          '-preset',
          'slow',
          '-crf',
          String(crf),
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          // 有音轨就压成 96k 单声道，没音轨也不报错
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-ac',
          '1',
          mp4,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
    }

    execFileSync(
      ffmpeg,
      ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '0.8', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg],
      { stdio: 'ignore' },
    );

    const outSize = statSync(mp4).size;
    totalOut += outSize;
    manifest.push({ name, file: `/video/vfx/${name}.mp4`, poster: `/video/vfx/${name}.jpg`, kb: Math.round(outSize / 1024) });
    console.log(`${(outSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log('失败');
    console.error(String(error.stderr || error.message).slice(0, 400));
  }
}

console.log(`\n合计：${(totalIn / 1024 / 1024).toFixed(1)} MB → ${(totalOut / 1024 / 1024).toFixed(1)} MB`);

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('\n可以贴进 src/content/vfx/*.md 的片段：\n');
for (const m of manifest) {
  console.log(`- label: ${m.name}`);
  console.log(`  src: ${m.file}`);
  console.log(`  poster: ${m.poster}`);
}
console.log(`\n清单也写了一份：${join(outDir, 'manifest.json')}`);
