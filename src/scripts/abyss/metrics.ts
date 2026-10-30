/**
 * 深度 ⇄ 路线位置
 * ------------------------------------------------------------------
 * 整条路一共 TOTAL_SCREENS 屏，每层按自己的 screens 分一段：
 *
 *   层 Ⅰ 占 5/46 的路 → 0 ~ 1,350 米全挤在前 5 屏里
 *   层 Ⅶ 占 8/46 的路 → 15,500 ~ 19,500 米
 *
 * 所以「米」和「滚了多远」不再是同一件事：浅层一屏只有 270 米（走起来又慢又长），
 * 深层一屏 500 米。这是刻意的——越深越走不动。
 *
 * 以前是线性的（sank = 深度/20,000），一层只占一屏多一点，滚两下就到底。
 */

import { ABYSS_LAYERS, ABYSS_MAX_DEPTH } from '../../consts';

/** 整条路一共几屏 */
export const TOTAL_SCREENS = ABYSS_LAYERS.reduce((sum, l) => sum + l.screens, 0);

const span = (l: (typeof ABYSS_LAYERS)[number]): number => Math.max(1, l.screens) / TOTAL_SCREENS;

/** 深度（米）→ 在路线上的位置（0~1） */
export function sankFromDepth(depth: number): number {
  const d = Math.max(0, Math.min(ABYSS_MAX_DEPTH, depth));
  let acc = 0;
  for (const layer of ABYSS_LAYERS) {
    const share = span(layer);
    if (d < layer.to || layer.to >= ABYSS_MAX_DEPTH) {
      const t = Math.max(0, Math.min(1, (d - layer.from) / (layer.to - layer.from)));
      return Math.max(0, Math.min(1, acc + share * t));
    }
    acc += share;
  }
  return 1;
}

/** 路线上的位置（0~1）→ 深度（米） */
export function depthFromSank(sank: number): number {
  const s = Math.max(0, Math.min(1, sank));
  let acc = 0;
  for (const layer of ABYSS_LAYERS) {
    const share = span(layer);
    if (s <= acc + share || layer.to >= ABYSS_MAX_DEPTH) {
      const t = Math.max(0, Math.min(1, (s - acc) / share));
      return layer.from + (layer.to - layer.from) * t;
    }
    acc += share;
  }
  return ABYSS_MAX_DEPTH;
}

// 这个模块既在浏览器里跑，也会被 dive.astro 的 frontmatter 引去算刻度位置，
// 所以碰 window 的地方都要先看有没有 window。
const hasWindow = typeof window !== 'undefined';

if (hasWindow) {
  // 调试用：控制台里 __metric(12000) 看它在路上第几屏
  (window as unknown as { __metric?: unknown }).__metric = (depth: number) => ({
    depth,
    sank: Number(sankFromDepth(depth).toFixed(4)),
    screens: Number((sankFromDepth(depth) * TOTAL_SCREENS).toFixed(2)),
  });

  /**
   * 交给 dive-scroll 用的换算口子。
   * dive-scroll 是 /brief/ 和 /abyss/dive/ 共用的站点脚本，按隔离规矩不能反向 import 游戏模块，
   * 所以改成「页面把函数挂到 window 上，它看到了就用」。
   */
  (window as unknown as { __diveDepth?: unknown }).__diveDepth = {
    toDepth: depthFromSank,
    toSank: sankFromDepth,
    totalScreens: TOTAL_SCREENS,
  };
}
