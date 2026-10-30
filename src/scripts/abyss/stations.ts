/**
 * 站点表（骨架 v0.2）
 * ------------------------------------------------------------------
 * 整条下潜路线只有一种行进方式：滚轮的位移 → 滚动位置 → 折线上的点 → 深度。
 * 站点是这条路上固定的几个落点，位置由"深度"反算成滚动位置。
 *
 * 为什么不能直接按 深度/8000 算：折线是斜的、有起伏，滚动进度和折线高度
 * 不是同一条直线。按比例停会差出几十米（1,530 而不是 1,500），
 * 所以在路径上二分出"刚好走到 depth 米"的那个进度。
 *
 * 这份表是站点唯一的真相：虚拟滚动靠它做靠岸减速，牌桌靠它做吸附。
 */

import { ABYSS_MAX_DEPTH } from '../../consts';
import { sankFromDepth } from './metrics';

export type StationDef = {
  id: string;
  /** 米 */
  depth: number;
  name: string;
  /** 从这里撤离回奥斯要付多少血（固定价） */
  extract: number;
  /** 是不是原作里真有人驻守的基地：能回血 */
  base: boolean;
};

/** 整条路最深 20,000 米（原作里奈落之底在这个深度以下） */
export const MAX_DEPTH = ABYSS_MAX_DEPTH;

/**
 * 哨站。位置照原作：一层石之舟、二层监视基地、三层海盗船、
 * 四层娜娜奇的秘密基地、五层前线基地、六层生骸村。七层没有——回不来。
 */
export const STATIONS: StationDef[] = [
  { id: 's1', depth: 600, name: '石之舟', extract: 5, base: false },
  { id: 's2', depth: 2540, name: '监视基地', extract: 15, base: true },
  { id: 's3', depth: 4000, name: '被囚禁的海盗船', extract: 28, base: false },
  { id: 's4', depth: 7500, name: '娜娜奇的秘密基地', extract: 55, base: true },
  { id: 's5', depth: 12800, name: '前线基地', extract: 80, base: true },
  { id: 's6', depth: 14000, name: '生骸村', extract: 92, base: true },
];

export const trackEl = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-dive-track]');

/** 可滚动的总距离（px） */
export const trackRange = (): number => {
  const track = trackEl();
  if (!track) return 0;
  return Math.max(1, track.offsetHeight - window.innerHeight);
};

/**
 * 深度 → 滚动位置（px）。
 * 二分 28 次就够精确到亚像素了，而且只在启动/缩放时算一遍。
 */
export function scrollYForDepth(depth: number): number {
  const track = trackEl();
  if (!track) return 0;

  const path = track.querySelector<SVGPathElement>('[data-route]');
  const length = path?.getTotalLength() ?? 0;
  const routeH = path?.ownerSVGElement?.viewBox.baseVal.height || 0;

  let at = sankFromDepth(depth);
  if (path && length > 0 && routeH > 0) {
    const targetY = sankFromDepth(depth) * routeH;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid * length).y < targetY) lo = mid;
      else hi = mid;
    }
    at = (lo + hi) / 2;
  }

  return track.offsetTop + trackRange() * at;
}

/** 每个站的滚动落点，按从小到大排好（虚拟滚动要用） */
export function stationAnchors(): number[] {
  return STATIONS.map((s) => scrollYForDepth(s.depth))
    .filter((y) => Number.isFinite(y) && y > 0)
    .sort((a, b) => a - b);
}
