/**
 * 行进段里漂着的东西
 * ------------------------------------------------------------------
 * 每层漂的东西不一样（一层是光尘和叶子，三层是碎屑和卵，七层只有灰）。
 * 同屏 18 个，全部走 transform，不碰布局。
 *
 * 两个规矩：
 *   1. 越深的层看得越淡（SEE 那张表）——深处本来就不该看清什么
 *   2. 三层和七层还有一道「扫掠」：每隔 2.6 秒从上往下扫一遍，扫到的会亮一下
 *      （那两层在原作里就是「有东西在动，但你说不清是什么」的地方）
 */

import { layerAt } from '../../consts';
import { depthFromSank } from './metrics';

export type Kind = 'mote' | 'leaf' | 'vine' | 'shard' | 'egg' | 'bubble' | 'bone' | 'ash';

type Drift = {
  el: HTMLElement;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  sway: number;
  freq: number;
  phase: number;
  glow: number;
  /** 上一次写进 style 的透明度，省掉重复写 */
  shown: number;
};

/** 每种东西长什么样 */
const ART: Record<Kind, { vb: string; svg: string }> = {
  mote: { vb: '0 0 16 16', svg: '<circle cx="8" cy="8" r="3" fill="currentColor"/>' },
  leaf: {
    vb: '0 0 26 26',
    svg: '<path d="M15 3C6 6 3 13 3 22c7 0 13-5 14-13z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1"/>',
  },
  vine: {
    vb: '0 0 16 90',
    svg: '<path d="M8 2c-7 12 7 20 0 32s7 20 0 32 7 14 0 22" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  },
  shard: {
    vb: '0 0 24 24',
    svg: '<path d="M12 4l6 6-4 10H8L5 11z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1"/>',
  },
  egg: {
    vb: '0 0 24 32',
    svg: '<ellipse cx="12" cy="16" rx="6" ry="10" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1"/><path d="M12 6l-2 4 2 4 2-4z" fill="currentColor" fill-opacity=".5"/>',
  },
  bubble: {
    vb: '0 0 24 24',
    svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity=".75"/><circle cx="9" cy="9" r="2" fill="currentColor" fill-opacity=".35"/>',
  },
  bone: {
    vb: '0 0 24 24',
    svg: '<path d="M9 4a2 2 0 1 1 2 2v12a2 2 0 1 1-2 2M15 4a2 2 0 1 0-2 2v12a2 2 0 1 0 2 2" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  },
  ash: {
    vb: '0 0 24 24',
    svg: '<circle cx="12" cy="12" r="2.4" fill="currentColor" fill-opacity=".6"/><circle cx="6" cy="7" r="1.1" fill="currentColor" fill-opacity=".4"/><circle cx="18" cy="15" r="1.3" fill="currentColor" fill-opacity=".45"/>',
  },
};

/** 尺寸：宽度区间 + 高宽比（藤蔓是竖着的一条） */
const SIZE: Record<Kind, { w: [number, number]; ratio: number }> = {
  mote: { w: [4, 9], ratio: 1 },
  leaf: { w: [12, 22], ratio: 1.4 },
  vine: { w: [8, 14], ratio: 5.6 },
  shard: { w: [8, 16], ratio: 1.1 },
  egg: { w: [10, 18], ratio: 1.35 },
  bubble: { w: [8, 18], ratio: 1 },
  bone: { w: [10, 16], ratio: 1.3 },
  ash: { w: [14, 26], ratio: 1 },
};

/** 每层能看见多少（1 = 全亮，0 = 全黑） */
const SEE: Record<string, number> = {
  'Ⅰ': 0.52,
  'Ⅱ': 0.3,
  'Ⅲ': 0.05,
  'Ⅳ': 0.5,
  'Ⅴ': 0.34,
  'Ⅵ': 0.4,
  'Ⅶ': 0.16,
  'Ⅷ': 0.1,
};

/** 这两层有扫掠 */
const NEEDS_PING: Record<string, boolean> = { 'Ⅲ': true, 'Ⅶ': true };

const SWEEP_EVERY = 2600;
const SWEEP_MS = 1500;
const PING_RANGE = 90;
const COUNT = 18;

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

function initDrift(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  const layer = document.createElement('div');
  layer.className = 'dive-drift';
  layer.setAttribute('aria-hidden', 'true');
  const sweep = document.createElement('div');
  sweep.className = 'dive-sweep';
  stage.append(layer);
  stage.append(sweep);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items: Drift[] = [];
  let w = 0;
  let h = 0;
  let dark = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--dark')) || 0;

  window.addEventListener('dive:tick', (event) => {
    const detail = (event as CustomEvent<{ sank: number }>).detail;
    if (detail && Number.isFinite(detail.sank)) dark = detail.sank;
  });

  const measure = (): void => {
    w = layer.clientWidth;
    h = layer.clientHeight;
  };

  /** 放一个新位置：初始时铺满，后来从下方外面飘上来 */
  const place = (d: Drift, initial: boolean): void => {
    const size = SIZE[d.kind];
    d.w = rand(size.w[0], size.w[1]);
    d.h = d.w * size.ratio;
    d.x = rand(-0.02, 1) * w;
    d.y = initial ? rand(0, 1) * h : h + d.h + rand(0, 120);
    d.vy = d.kind === 'bubble' ? rand(52, 96) : d.kind === 'ash' ? rand(30, 60) : rand(10, 26);
    d.sway = d.kind === 'mote' ? rand(2, 6) : rand(6, 18);
    d.freq = rand(0.25, 0.7);
    d.phase = rand(0, Math.PI * 2);
    d.el.style.width = `${d.w.toFixed(1)}px`;
    d.el.style.height = `${d.h.toFixed(1)}px`;
  };

  /** 换一种东西：换图、换尺寸 */
  const setKind = (d: Drift, kind: Kind): void => {
    d.kind = kind;
    d.el.className = `drift drift--${kind}`;
    d.el.dataset.kind = kind;
    d.el.innerHTML = `<svg viewBox="${ART[kind].vb}">${ART[kind].svg}</svg>`;
    place(d, false);
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('span');
    el.className = 'drift drift--mote';
    el.dataset.kind = 'mote';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    el.append(svg);
    layer.append(el);
    items.push({ el, kind: 'mote', x: 0, y: 0, w: 6, h: 6, vy: 10, sway: 8, freq: 0.4, phase: 0, glow: 0, shown: -1 });
  }

  measure();
  items.forEach((d) => place(d, true));

  let layerNo = '';
  let last = performance.now();
  let lastScroll = window.scrollY;
  let sweepStart = -SWEEP_EVERY;

  /** 换层了就整批换成这层的东西 */
  const syncLayer = (): void => {
    const info = layerAt(depthFromSank(dark));
    if (info.no === layerNo) return;
    layerNo = info.no;
    const kinds: Kind[] = info.drift.length ? (info.drift as Kind[]) : ['mote'];
    items.forEach((d, i) => setKind(d, kinds[i % kinds.length]));
    layer.dataset.layer = info.no;
  };

  const frame = (now: number): void => {
    requestAnimationFrame(frame);

    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!dt || !w || !h) return;

    syncLayer();

    const info = layerAt(depthFromSank(dark));
    const see = SEE[info.no] ?? 0.3;
    const ping = NEEDS_PING[info.no] === true;

    // 滚动带一点「被风推着走」的效果：往下滚，东西往上跑得快一点
    const scrollDelta = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    const push = Math.max(-60, Math.min(60, scrollDelta * 0.55));

    // 扫掠
    let sweepY = Number.NaN;
    if (ping) {
      if (now - sweepStart > SWEEP_EVERY) sweepStart = now;
      const t = (now - sweepStart) / SWEEP_MS;
      if (t <= 1) {
        sweepY = -PING_RANGE + t * (h + PING_RANGE * 2);
        sweep.style.transform = `translate3d(0, ${sweepY.toFixed(1)}px, 0)`;
        sweep.style.opacity = (0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))).toFixed(3);
      } else {
        sweep.style.opacity = '0';
      }
    } else {
      sweep.style.opacity = '0';
    }

    for (const d of items) {
      if (!reduce) {
        d.y -= d.vy * dt + push;
        d.phase += dt * d.freq * Math.PI * 2;
        if (d.y < -d.h * 2) place(d, false);
      }

      // 扫到就亮一下，然后慢慢暗回去
      if (ping && Number.isFinite(sweepY) && Math.abs(d.y + d.h * 0.5 - sweepY) < PING_RANGE) d.glow = 1;
      d.glow = Math.max(0, d.glow - dt * 1.7);
      const alpha = ping && d.glow > 0 ? Math.max(see, 0.2 + d.glow * 0.7) : see;

      if (Math.abs(alpha - d.shown) > 0.01) {
        d.shown = alpha;
        d.el.style.opacity = alpha.toFixed(3);
      }

      if (!reduce) {
        const x = d.x + Math.sin(d.phase) * d.sway;
        d.el.style.transform = `translate3d(${x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0)`;
      }
    }
  };

  window.addEventListener('resize', () => {
    measure();
    for (const d of items) if (d.y > h) d.y = rand(0, h);
  });

  if (reduce) {
    for (const d of items) d.el.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0)`;
  }

  requestAnimationFrame(frame);
}

initDrift();
