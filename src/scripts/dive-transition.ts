/**
 * 「下潜」转场
 * ------------------------------------------------------------------
 * 首页点菜单 → 整页朝点击点放大、模糊、被暖色吞掉 → 换页。
 * 目标页从同一层暖色里揭开，内容从微放大状态落地。
 *
 * 站点是 Astro 静态多页（真实跳转），所以用 sessionStorage 留一个
 * 「我正要下潜」的标记：目标页在 <head> 里读到它就先把底色铺成深色，
 * 避免换页那一瞬间的白闪。
 */

import { sfx } from './sfx';

const KEY = 'dive-to';
const OUT_MS = 420;
const IN_MS = 540;
const VEIL_ID = 'dive-veil';

export type Point = { x: number; y: number };

type Handoff = { href: string; x: number; y: number };

const reduceMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readHandoff(): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as Handoff) : null;
  } catch {
    return null;
  }
}

function writeHandoff(data: Handoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式下 sessionStorage 可能不可用，退化成普通跳转 */
  }
}

function ensureVeil(): HTMLElement {
  const found = document.getElementById(VEIL_ID);
  if (found) return found;

  const el = document.createElement('div');
  el.id = VEIL_ID;
  el.className = 'dive-veil';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  return el;
}

/** 出发：从点击点向四周吞掉当前页面，然后跳转 */
export function diveOut(href: string, origin: Point): void {
  if (reduceMotion()) {
    window.location.href = href;
    return;
  }

  const root = document.documentElement;
  root.style.setProperty('--dive-x', `${origin.x}px`);
  root.style.setProperty('--dive-y', `${origin.y}px`);

  // 记住点击位置（换算成百分比），换页后让遮罩从同一个点揭开，动画才连得上
  writeHandoff({
    href,
    x: origin.x / Math.max(1, window.innerWidth),
    y: origin.y / Math.max(1, window.innerHeight),
  });

  const veil = ensureVeil();
  root.classList.add('is-diving');
  // 强制一次重排：让遮罩先以「闭合」状态参与过布局，扩散动画才演得出来
  void veil.offsetWidth;
  veil.classList.add('is-in');

  window.setTimeout(() => {
    window.location.href = href;
  }, OUT_MS);
}

/** 给所有 a[data-dive] 挂上转场；只拦站内链接，其余交给浏览器 */
export function bindDiveLinks(): void {
  document.querySelectorAll<HTMLElement>('a[data-dive]').forEach((link) => {
    link.addEventListener('click', (event) => {
      // 新标签页打开、右键菜单、键盘中键——一律放行
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const href = link.getAttribute('href');
      if (!href || !href.startsWith('/')) return;

      event.preventDefault();
      const box = link.getBoundingClientRect();
      sfx.dive();
      diveOut(href, {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
      });
    });
  });
}

/** 清掉转场遗留状态 */
export function resetDiveState(): void {
  const root = document.documentElement;
  root.classList.remove('is-diving', 'dive-arriving');
  document.body.classList.remove('is-landing');

  const veil = document.getElementById(VEIL_ID);
  if (veil) veil.classList.remove('is-in', 'is-covering', 'is-out');
}

/**
 * 浏览器前进/后退时收拾现场。
 *
 * 关键在 bfcache：点「返回」时浏览器是把首页整页从内存里恢复出来，**脚本不会重跑**。
 * 而离开首页那一刻，`is-diving`（带 overflow:hidden）和全屏遮罩还在页面上——
 * 恢复出来就是一张糊掉、被盖住、还滚不动的页面，看起来就是「卡住」。
 */
export function bindDiveLifecycle(): void {
  window.addEventListener('pagehide', resetDiveState);
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) resetDiveState();
  });
}

/** 到达：上一页留了标记就从遮罩里揭开，否则什么都不做 */
export function diveIn(): void {
  const handoff = readHandoff();

  const root = document.documentElement;
  if (!handoff || reduceMotion()) {
    root.classList.remove('dive-arriving');
    document.dispatchEvent(new CustomEvent('dive:landed'));
    return;
  }

  root.style.setProperty('--dive-x', `${handoff.x * window.innerWidth}px`);
  root.style.setProperty('--dive-y', `${handoff.y * window.innerHeight}px`);

  const veil = ensureVeil();
  veil.classList.add('is-covering');

  // 双 rAF：等遮罩真的画上去了，下一帧再推开，否则会被合并成同一帧直接看不见
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove('dive-arriving');
      document.body.classList.add('is-landing');
      veil.classList.add('is-out');
      sfx.surface();

      window.setTimeout(() => {
        veil.classList.remove('is-covering', 'is-out');
        document.body.classList.remove('is-landing');
        // 落地动画动了 transform，滚动页需要重算一次位置
        document.dispatchEvent(new CustomEvent('dive:landed'));
      }, IN_MS);
    });
  });
}
