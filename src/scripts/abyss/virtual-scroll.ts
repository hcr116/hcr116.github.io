/**
 * 虚拟滚动（骨架 v0.2）
 * ------------------------------------------------------------------
 * 为什么不用浏览器原生滚动：
 *   1. 靠岸减速——原生滚动没法改「一格滚轮走多远」
 *   2. 站内软阻力——到了平台，滚轮该顶一下再弹回来，不是死锁
 *   3. 蹬离——下潜那一下要自动多推一截
 *   4. 设计文档里写过的「5,000 米后继续滚，页面反向走一点」
 *
 * 做法很简单：位移自己管，位置最终还是交给 window.scrollTo。
 * 所以 getBoundingClientRect、sticky、progress、折线、雷达——一行都不用改，
 * 只是「谁在改 scrollY」从浏览器换成了这里。
 */

import { stationAnchors } from './stations';

const FOLLOW = 0.15; // 位置追赶目标的速度
const MAX_STEP = 140; // 一帧最多走多少 px：跳转（End / 锚点）也得一站一站过，不能飞过去
/**
 * 滚轮的水分。整个路线 2 万米，按 1:1 走一格滚轮就是一百多米，
 * 太粗了；压到 0.34，一格大约 55 米，能停在想看的地方。
 */
const WHEEL_SCALE = 0.34;
const DECEL_NEAR = 900; // 离站还有多少 px 开始减速
const DECEL_MIN = 0.42; // 贴到站时，一格滚轮只剩这么多
const ELASTIC = 110; // 站内还能往外顶多少 px
/** 从站上往上走超过这么多，就放行（想爬回去随时可以） */
const LEAVE_UP = 60;
const SPRING = 0.82; // 每帧把「顶出去的那截」收回来多少
const PUSH_SCREENS = 0.055; // 蹬离时多推几屏

let pos = 0;
let target = 0;
let lockY = -1;
let maxY = 1;
let anchors: number[] = [];
let raf = 0;
let reduce = false;

const measure = (): void => {
  const doc = document.documentElement;
  maxY = Math.max(1, doc.scrollHeight - window.innerHeight);
  anchors = stationAnchors();
};

const clampTarget = (): void => {
  target = Math.max(0, Math.min(maxY, target));
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 往下走时，越靠近下一个站，一格滚轮走得越少 */
const speedAt = (to: number, delta: number): number => {
  if (reduce || delta <= 0) return 1;
  for (const anchor of anchors) {
    const gap = anchor - to;
    if (gap > 0 && gap < DECEL_NEAR) {
      return DECEL_MIN + (1 - DECEL_MIN) * smooth(gap / DECEL_NEAR);
    }
  }
  return 1;
};

const tick = (): void => {
  raf = 0;

  // 站内：位置 = 落点 + 一个会自己收回去的「挤开量」
  // （别让 target 自己去追落点——它收得比 pos 快，两者会中途撞上然后停在那儿）
  if (lockY >= 0) {
    const off = pos - lockY;
    if (reduce) pos = lockY;
    else if (Math.abs(off) > 0.4) {
      const rate = Math.abs(off) > 220 ? FOLLOW : SPRING; // 远：滑过去；近：弹回来
      pos = lockY + off * rate;
    } else pos = lockY;

    target = pos;
    window.scrollTo(0, pos);
    if (!reduce && Math.abs(pos - lockY) > 0.4) raf = requestAnimationFrame(tick);
    return;
  }

  const dp = target - pos;
  if (reduce || Math.abs(dp) < 0.4) pos = target;
  else pos += Math.max(-MAX_STEP, Math.min(MAX_STEP, dp * FOLLOW));

  window.scrollTo(0, pos);

  if (!reduce && Math.abs(target - pos) > 0.4) raf = requestAnimationFrame(tick);
};

const schedule = (): void => {
  if (!raf) raf = requestAnimationFrame(tick);
};

const nudge = (delta: number): void => {
  if (lockY >= 0) {
    // 站内：往下顶有阻尼，往上走是放行的——想爬回去随时可以
    const next = pos + delta * speedAt(pos, delta);
    if (next < lockY - LEAVE_UP) {
      lockY = -1;
      pos = next;
      target = pos;
      schedule();
      return;
    }
    pos = Math.min(lockY + ELASTIC, next);
    target = pos;
    schedule();
    return;
  }
  target += delta * speedAt(target, delta);
  clampTarget();
  schedule();
};

const onWheel = (event: WheelEvent): void => {
  if (event.ctrlKey) return; // 留给浏览器缩放
  event.preventDefault();

  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16; // 按行
  else if (event.deltaMode === 2) delta *= window.innerHeight; // 按页
  if (!delta) return;

  nudge(delta * WHEEL_SCALE);
};

const KEY_STEP: Record<string, number> = {
  ArrowDown: 0.16,
  ArrowUp: -0.16,
  PageDown: 0.86,
  PageUp: -0.86,
  ' ': 0.86,
};

const onKey = (event: KeyboardEvent): void => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (event.key === 'Home') {
    event.preventDefault();
    target = 0;
    clampTarget();
    schedule();
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    target = maxY;
    clampTarget();
    schedule();
    return;
  }

  const step = KEY_STEP[event.key];
  if (step === undefined) return;
  event.preventDefault();
  nudge(step * window.innerHeight * WHEEL_SCALE);
};

export const gate = {
  /** 钉在某个滚动位置上（落脚点吸附） */
  lockAt(y: number): void {
    lockY = y;
    target = y;
    clampTarget();
    schedule();
  },
  /** 放行：多推一截，读作「蹬离」 */
  open(): void {
    lockY = -1;
    if (!reduce) target = Math.min(maxY, target + window.innerHeight * PUSH_SCREENS);
    schedule();
  },
  /** 直接搬过去（回奥斯 / 传送）：不带动画，免得从 15,000 米一路飞回去 */
  warp(y: number): void {
    lockY = -1;
    pos = Math.max(0, Math.min(maxY, y));
    target = pos;
    window.scrollTo(0, pos);
    schedule();
  },
  isLocked: (): boolean => lockY >= 0,
};

function initVirtualScroll(): void {
  // 游戏关掉时（ABYSS_GAME = false）这个页面上根本没有下潜轨道：
  // 直接退出，别去接管滚轮，也别把全站的滚动条藏掉
  if (!document.querySelector('[data-dive-track]')) return;

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduce = mq.matches;
  mq.addEventListener('change', () => {
    reduce = mq.matches;
  });

  // 藏掉滚动条：位置还是真的，只是不再由用户拖着走
  document.documentElement.classList.add('vscroll');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  document.documentElement.style.scrollBehavior = 'auto';

  measure();
  pos = window.scrollY;
  target = pos;
  clampTarget();

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);

  // 别人（锚点跳转、浏览器恢复位置、调试脚本）把页面挪走时，把内部位置对齐
  window.addEventListener(
    'scroll',
    () => {
      if (raf) return;
      const y = window.scrollY;
      if (Math.abs(y - pos) <= 2) return;
      if (lockY >= 0) {
        schedule(); // 站内：不管谁挪的，都弹回落点
        return;
      }
      pos = y;
      target = y;
    },
    { passive: true },
  );

  window.addEventListener('resize', () => {
    measure();
    clampTarget();
    schedule();
  });

  // 站点表依赖布局（折线长度、轨道高度），字体或图片撑开后再量一次
  const remeasure = (): void => {
    measure();
    clampTarget();
    schedule();
  };
  if (document.readyState === 'complete') remeasure();
  else window.addEventListener('load', remeasure);
}

initVirtualScroll();

// 调试用：控制台里 __vs() 能看到内部位置和目标
(window as unknown as { __vs?: () => unknown }).__vs = () => ({
  pos,
  target,
  lockY,
  maxY,
  real: window.scrollY,
  anchors,
});
