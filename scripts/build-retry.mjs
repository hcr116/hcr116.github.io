#!/usr/bin/env node
/**
 * 低内存环境下重试构建
 * ------------------------------------------------------------------
 * 背景：这台机器偶尔会有别的吃内存的程序（实测 UnrealEditor 占 6-7GB），
 * 导致 astro build 的 WASM 编译器直接 "out of memory"。
 * 这个脚本隔一段时间重试，直到构建成功或次数用完。
 *
 * 用法：node scripts/build-retry.mjs [次数] [间隔秒]
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const tries = Number(process.argv[2] ?? 20);
const gapSec = Number(process.argv[3] ?? 60);

const log = [];
const out = 'tmp/build-retry.log';

for (let i = 1; i <= tries; i += 1) {
  const stamp = new Date().toISOString().slice(11, 19);
  const res = spawnSync(process.execPath, ['node_modules/astro/astro.js', 'build'], {
    encoding: 'utf8',
    timeout: 300_000,
  });
  const all = (res.stdout ?? '') + (res.stderr ?? '');
  const ok = all.includes('Complete!') && res.status === 0;

  const line = ok ? `${stamp} #${i} 构建成功` : `${stamp} #${i} 失败：${(all.match(/out of memory[^\n]*|Error[^\n]*/) ?? ['未知'])[0]}`;
  console.log(line);
  log.push(line);
  writeFileSync(out, log.join('\n') + '\n', 'utf8');

  if (ok) process.exit(0);

  /* 输出为空 = 进程都没起来（内存不够），继续等 */
  const empty = all.trim() === '';

  /* 不是内存问题就别白等了 */
  if (!empty && !/out of memory|Allocation failed|heap/i.test(all)) {
    console.log('不是内存问题，停止重试。把上面的报错贴出来。');
    process.exit(1);
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, gapSec * 1000);
}

console.log('重试次数用完，还是没构建成功。');
process.exit(1);
