#!/usr/bin/env node
/**
 * 文案表导入（src/data/copy.csv → src/data/copy.generated.ts）
 * ------------------------------------------------------------------
 * 表是唯一的数据源，但**不是**"页面存不存在"的来源：
 *   · 表里删掉一行 → 页面用代码里写的默认字（不会白屏）
 *   · 表里多一行   → 只警告，不影响构建（方便先写未来文案）
 *
 * 每次 build 前自动跑（见 package.json 的 build 脚本）。
 *
 * 校验会拦住这些：
 *   · 缺 id / 缺 zh
 *   · id 重复
 *   · state 不是 在用 / 待定 / 废弃
 *   · 列数不对（多半是逗号或引号没转义）
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const CSV = join(root, 'src/data/copy.csv');
const OUT = join(root, 'src/data/copy.generated.ts');

const STATES = new Set(['在用', '待定', '废弃']);

/** 极简 CSV 解析：支持双引号包裹、引号内换行、" " 转义 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c === '\r') {
      /* 忽略 */
    } else {
      cell += c;
    }
  }

  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const rawBytes = readFileSync(CSV);

/* Excel / WPS 默认会存成 ANSI（简体中文 = GBK），存完中文就变乱码。
   这里先按 UTF-8 读，读不通就按 GBK 再试一次 —— 表还能用，不拦构建。
   想彻底避免：另存为时选「CSV UTF-8」。 */
let raw = rawBytes.toString('utf8');
if (raw.includes('\uFFFD')) {
  try {
    raw = new TextDecoder('gbk').decode(rawBytes);
    console.log('[copy] 表不是 UTF-8（多半是 Excel / WPS 存成了 ANSI），已按 GBK 读进来。');
    console.log('[copy] 建议：另存为时选「CSV UTF-8」，否则以后改动有丢字风险。');
  } catch {
    console.error('[copy] 表既不是 UTF-8 也读不成 GBK，请另存为「CSV UTF-8」再构建。');
    process.exit(1);
  }
}
raw = raw.replace(/^\uFEFF/, '');
const rows = parseCsv(raw);
const header = rows.shift() ?? [];

const need = ['id', 'area', 'zh', 'state', 'note'];
const missingCols = need.filter((c) => !header.includes(c));
if (missingCols.length) {
  console.error(`[copy] 表头缺列：${missingCols.join(', ')}（应该是 ${need.join(', ')}）`);
  process.exit(1);
}

const col = Object.fromEntries(header.map((h, i) => [h, i]));

const problems = [];
const entries = new Map();
let pending = 0;
let dropped = 0;

for (const [n, row] of rows.entries()) {
  const line = n + 2;
  const id = (row[col.id] ?? '').trim();
  const zh = (row[col.zh] ?? '').trim();
  const state = (row[col.state] ?? '').trim() || '在用';

  if (row.length !== header.length) {
    problems.push(`第 ${line} 行：列数 ${row.length}，表头是 ${header.length}（逗号或引号没转义？）`);
    continue;
  }
  if (!id) {
    problems.push(`第 ${line} 行：id 是空的`);
    continue;
  }
  if (!zh) {
    problems.push(`第 ${line} 行：${id} 的 zh 是空的`);
    continue;
  }
  if (!STATES.has(state)) {
    problems.push(`第 ${line} 行：${id} 的 state 是「${state}」，只能是 在用 / 待定 / 废弃`);
    continue;
  }
  if (entries.has(id)) {
    problems.push(`第 ${line} 行：id 重复 —— ${id}`);
    continue;
  }

  if (state === '待定') pending += 1;
  if (state === '废弃') {
    dropped += 1;
    continue;
  }

  entries.set(id, zh);
}

if (problems.length) {
  console.error('[copy] 表里有问题，先修好再构建：\n' + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}

const body = [...entries.entries()]
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join('\n');

writeFileSync(
  OUT,
  `/* 这个文件是 scripts/copy-import.mjs 生成的，别手改。
   要改字就去改 src/data/copy.csv，然后重新 build。 */

export const COPY: Record<string, string> = {
${body}
};
`,
  'utf8',
);

console.log(
  `[copy] 导入 ${entries.size} 条（待定 ${pending} 条，废弃 ${dropped} 条）→ src/data/copy.generated.ts`,
);
