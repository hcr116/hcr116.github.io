/**
 * 隔离检查：确认「阿比斯小游戏」碰不到站点本身
 *
 * 这个脚本只做四件事，任何一条不过就以退出码 1 结束（CI 会拦住 deploy）：
 *   1. 游戏目录之外，没有文件 import 游戏模块（scripts/abyss/、scripts/station、styles/abyss.css）
 *   2. 站点样式表 global.css 里，没有一条游戏选择器
 *   3. 游戏样式表 abyss.css 里，没有裸的 html / body / :root / * 规则
 *   4. 两个数组打印一下体积，方便看出站点那边有没有被游戏拖胖
 *
 * 用法：node scripts/check-isolation.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');

/** 游戏自己的地盘：这些路径下的东西可以随便引用游戏模块 */
const GAME_DIRS = [join(SRC, 'pages', 'abyss'), join(SRC, 'scripts', 'abyss')];
const GAME_FILES = [join(SRC, 'scripts', 'station.ts'), join(SRC, 'styles', 'abyss.css')];

/** 在站点文件里出现就等于「耦合」的字符串 */
const GAME_IMPORTS = [
  'scripts/abyss/',
  'scripts/station',
  'styles/abyss.css',
  "from './abyss/",
  "from '../abyss/",
  "from '../../abyss/",
];

/** global.css 里不该再出现的游戏选择器 */
const GAME_SELECTORS = [
  '.pcard',
  '.station',
  '.drift',
  '.dive-route',
  '.dive-radar',
  '.dive-curse',
  '.dive-dim',
  '.dive-deep-flash',
  '.dive-risk',
  '.dive-zone',
  '.abyss-',
  'html.vscroll',
  'html.station-open',
];

const problems = [];
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|ts|js|mjs|css)$/.test(name)) out.push(p);
  }
  return out;
};

const isGameFile = (p) => GAME_FILES.includes(p) || GAME_DIRS.some((d) => p.startsWith(d + sep));

// 1. 反向依赖
for (const file of walk(SRC)) {
  if (isGameFile(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const needle of GAME_IMPORTS) {
    if (text.includes(needle)) {
      problems.push(`${relative(ROOT, file)} 引用了游戏模块（${needle}）`);
    }
  }
}

// 2. 站点样式里不许有游戏选择器
const globalCss = readFileSync(join(SRC, 'styles', 'global.css'), 'utf8');
for (const sel of GAME_SELECTORS) {
  if (globalCss.includes(sel)) {
    problems.push(`global.css 里还有游戏选择器：${sel}`);
  }
}

// 3. 游戏样式里不许有裸的全局规则
const abyssCss = readFileSync(join(SRC, 'styles', 'abyss.css'), 'utf8');
for (const bad of ['\nhtml {', '\nbody {', '\n:root', '\n* {', '\n*::']) {
  if (abyssCss.includes(bad)) problems.push(`abyss.css 里有裸的全局规则：${bad.trim()}`);
}

// 4. 体积
const kb = (p) => (readFileSync(p).length / 1024).toFixed(1) + ' KB';
console.log(`站点样式 global.css  ${kb(join(SRC, 'styles', 'global.css'))}`);
console.log(`游戏样式 abyss.css    ${kb(join(SRC, 'styles', 'abyss.css'))}`);

if (problems.length) {
  console.error('\n隔离检查没通过：');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('\n游戏和站点必须互不引用。要么把这段搬进 src/pages/abyss 或 src/scripts/abyss，');
  console.error('要么按 docs/abyss-design.md 末尾的拆除清单把它删掉。');
  process.exit(1);
}

console.log('\n✓ 隔离检查通过：游戏那边再怎么改，也碰不到站点的样式和脚本。');
