#!/usr/bin/env node
/**
 * MP3 裁剪（不依赖 ffmpeg）
 * ------------------------------------------------------------------
 * MP3 就是一串 frame，按 frame 边界切可以切出合法文件（开头会有一点点顿，
 * 因为没有重写 Xing/VBR 头，播放器会自己找同步字，能放）。
 *
 * 用法：
 *   node scripts/audio-cut.mjs <输入.mp3> --from 12 --to 88 --out public/audio/x.mp3
 *   node scripts/audio-cut.mjs <输入.mp3> --info          # 只看时长/码率/frame 数
 *
 * 为什么不用 ffmpeg：这台机器上没装，而这个活只要按 frame 切就行。
 * 真要压码率（320k → 128k）得重新编码，那步还得你导出或装 ffmpeg。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const BITRATES_V2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** 读一个 frame 头；不是合法头就返回 null */
function frameInfo(buf, pos) {
  if (pos + 4 > buf.length) return null;
  const b0 = buf[pos];
  const b1 = buf[pos + 1];
  const b2 = buf[pos + 2];
  const b3 = buf[pos + 3];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const verBits = (b1 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
  const layerBits = (b1 >> 1) & 0x03; // 1 = Layer III
  if (layerBits !== 1) return null;

  const bitrateIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  const pad = (b2 >> 1) & 0x01;

  const table = verBits === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3;
  const bitrate = table[bitrateIdx] * 1000;
  if (!bitrate) return null;

  const sampleRate = (SAMPLE_RATES[verBits] ?? SAMPLE_RATES[3])[srIdx];
  if (!sampleRate) return null;

  const samples = verBits === 3 ? 1152 : 576;
  const size = Math.floor(((samples / 8) * bitrate) / sampleRate) + pad;
  return { size, bitrate, sampleRate, samples, version: verBits };
}

/** 扫描整份文件，返回每一帧的起始偏移 */
function scan(buf) {
  const marks = [];
  let pos = 0;
  // 跳过 ID3v2
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'ID3') {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    pos = 10 + size;
  }
  while (pos < buf.length) {
    const info = frameInfo(buf, pos);
    if (!info) {
      pos += 1;
      continue;
    }
    const next = frameInfo(buf, pos + info.size);
    // 下一帧也对得上才算，避免在数据里撞到假同步字
    if (next || pos + info.size >= buf.length - 4) {
      marks.push({ pos, ...info });
      pos += info.size;
    } else {
      pos += 1;
    }
  }
  return marks;
}

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('用法：node scripts/audio-cut.mjs <输入.mp3> [--info] [--from 秒] [--to 秒] [--out 路径]');
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const buf = readFileSync(input);
const frames = scan(buf);
if (!frames.length) {
  console.error('没找到 MP3 frame —— 可能不是 Layer III，或者文件损坏');
  process.exit(1);
}

const totalSamples = frames.reduce((s, f) => s + f.samples, 0);
const firstRate = frames[0].sampleRate;
const seconds = totalSamples / firstRate;
const avgKbps = Math.round(
  (frames.reduce((s, f) => s + f.bitrate, 0) / frames.length) / 1000,
);

console.log(`文件      ${input}`);
console.log(`frame 数  ${frames.length}`);
console.log(`时长      ${seconds.toFixed(1)} 秒 (${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')})`);
console.log(`采样率    ${firstRate} Hz`);
console.log(`平均码率  ${avgKbps} kbps`);

if (argv.includes('--info')) process.exit(0);

const from = Number(flag('from', 0));
const to = Number(flag('to', seconds));
const out = flag('out', input.replace(/\.mp3$/i, `-${Math.round(from)}-${Math.round(to)}.mp3`));

if (!(to > from)) {
  console.error('--to 必须大于 --from');
  process.exit(1);
}

// 按累计时间找到起止帧
let acc = 0;
let start = 0;
let end = frames.length;
for (let i = 0; i < frames.length; i += 1) {
  const f = frames[i];
  if (acc <= from * firstRate && acc + f.samples > from * firstRate) start = i;
  if (acc >= to * firstRate) {
    end = i;
    break;
  }
  acc += f.samples;
}

const slice = frames.slice(start, end);
const bytes = Buffer.concat(slice.map((f) => buf.subarray(f.pos, f.pos + f.size)));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, bytes);

const keptSeconds = (slice.reduce((s, f) => s + f.samples, 0) / firstRate).toFixed(1);
console.log(`\n切出      ${start} → ${end} 帧，${keptSeconds} 秒`);
console.log(`输出      ${out}  (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
