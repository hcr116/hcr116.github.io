/**
 * 你自己
 * ------------------------------------------------------------------
 * 以前「你」只是一个隐含概念：东西都摆在屏幕正中那条带上，但没有任何东西代表你。
 * 于是看什么都像上帝视角——我知道哪一级有几点血，却不知道这一点站在哪。
 *
 * 现在画出来：屏幕正中一个「你」，外面一圈光。
 *
 *   · 三层以上（还有阳光）——光圈很大
 *   · 三层以下的黑里——带灯就是这个圈，没灯就只剩脚下一小圈
 *
 * 这一圈就是以后视野的边界：圈外的搜索点和生物会看不到，或者只剩轮廓。
 * 深度在右边那条剖面上（红点），水平位置是不知道的——你在深渊里只能确定自己多深。
 */

import { bag } from './bag';
import { depthFromSank } from './metrics';

/** 从这一层开始没有天光 */
const DARK_FROM = 2600;
const RADIUS_DAY = 240;
const RADIUS_LAMP = 200;
const RADIUS_NONE = 92;

function initSelf(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  const el = document.createElement('div');
  el.className = 'self';
  el.dataset.light = 'day';
  el.innerHTML =
    `<span class="self-ring" aria-hidden="true"></span>` +
    `<span class="self-body" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">` +
    `<circle cx="12" cy="6.5" r="2.6"/><path d="M12 9.4v5.2M12 14.6l-2.6 4M12 14.6l2.6 4M7.6 11h8.8"/>` +
    `</svg></span>` +
    `<span class="self-label">你</span>`;
  stage.append(el);

  const ring = el.querySelector<HTMLElement>('.self-ring');

  const sync = (depth: number): void => {
    // 还没下水（开场那块记录）就先别画——压在大标题上很碍事
    const off = depth < 15;
    if (el.dataset.off !== String(off)) el.dataset.off = String(off);

    let radius = RADIUS_DAY;
    let light = 'day';
    if (depth >= DARK_FROM) {
      const hasLamp = (bag?.countOf('lamp') ?? 0) > 0;
      radius = hasLamp ? RADIUS_LAMP : RADIUS_NONE;
      light = hasLamp ? 'lamp' : 'none';
    }
    if (el.dataset.light !== light) el.dataset.light = light;
    // 光圈半径写成 CSS 变量，实际尺寸由样式算
    if (ring) ring.style.setProperty('--r', `${radius}px`);
  };

  window.addEventListener('dive:tick', (event) => {
    const sank = (event as CustomEvent<{ sank: number }>).detail?.sank ?? 0;
    sync(depthFromSank(sank));
  });
  window.addEventListener('bag:changed', () => {
    const d = Number((document.querySelector<HTMLElement>('[data-depth]')?.textContent ?? '0').replace(/[^\d]/g, '')) || 0;
    sync(d);
  });

  sync(0);
}

initSelf();
