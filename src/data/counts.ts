/**
 * 各方向「实际导入了几条」的计数
 * ------------------------------------------------------------------
 * 作品页那句「…，已导入 N 个」的 N 不写死，从真实内容里数出来。
 *
 * - ai：src/content/ai/*.md 的篇数（跳过 draft: true）
 * - combat：src/articles/combat/*.md 里 `## ` 章节总数（和文章页同一套数据）
 * - 其余三个方向还没有内容源，返回 0
 *
 * 这里用 fs 直接读源文件，而不是 getCollection：
 * 构建时就能同步拿到，不用把整个页面改成异步，也不会因为集合不存在就报错。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { countVfx as countVfxItems } from './vfx';
import { join } from 'node:path';

const root = process.cwd();

/** frontmatter 里写了 draft: true 的跳过 */
function isDraft(file: string): boolean {
  try {
    const text = readFileSync(file, 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return Boolean(fm && /^draft:\s*true\s*$/m.test(fm[1]));
  } catch {
    return false;
  }
}

/** AI 功能：项目篇数 */
export function countAi(): number {
  const dir = join(root, 'src/content/ai');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !isDraft(join(dir, f))).length;
}

/** 特效作品：已经到位的视频条数 */
export function countVfx(): number {
  return countVfxItems();
}

/** 战策经验：三份拆解文档里的章节数 */
export function countCombat(): number {
  const dir = join(root, 'src/articles/combat');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .reduce((sum, f) => {
      const text = readFileSync(join(dir, f), 'utf8');
      return sum + (text.match(/^## /gm)?.length ?? 0);
    }, 0);
}

/** 给作品页用：方向 id → 已导入条数 */
export function counts(): Record<string, number> {
  return {
    'game-demo': 0,
    combat: countCombat(),
    ai: countAi(),
    bass: 0,
    vfx: countVfx(),
  };
}

/** 拆解正文的汉字数（加载页那行「拆解字数」用） */
export function countCombatWords(): number {
  const dir = join(root, 'src/articles/combat');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .reduce((sum, f) => {
      const text = readFileSync(join(dir, f), 'utf8');
      return sum + (text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0);
    }, 0);
}

/** public/images 下的图片张数（加载页那行「素材库」用） */
export function countImages(): number {
  const dir = join(root, 'public/images');
  if (!existsSync(dir)) return 0;
  const walk = (d: string): number =>
    readdirSync(d, { withFileTypes: true }).reduce((sum, e) => {
      if (e.isDirectory()) return sum + walk(join(d, e.name));
      return sum + (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(e.name) ? 1 : 0);
    }, 0);
  return walk(dir);
}
