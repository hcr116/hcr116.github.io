/**
 * 结算：回到入口，把背回来的东西卖掉
 * ------------------------------------------------------------------
 * 只有「撤」成功了才走到这里。死了没有这一屏——东西直接掉在底下。
 */

import { money, sellOf, TIER_COLOR, type Loot } from './loot';
import { run } from './run';

export function showSettle(items: Loot[], total: number, wasted: number, onDone: () => void): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  document.querySelector('[data-settle]')?.remove();

  const veil = document.createElement('div');
  veil.className = 'settle';
  veil.dataset.settle = '';

  const rows = items
    .map((it) => {
      const color = TIER_COLOR[it.tier];
      return (
        `<li class="settle-row" data-tier="${it.tier}" style="--tier:${color}">` +
        `<span class="settle-art"><svg viewBox="0 0 24 24">${it.icon}</svg></span>` +
        `<span class="settle-name">${it.name}` +
        `<i class="settle-rank">${it.rank}</i>` +
        (it.unknown ? `<i class="settle-tag">鉴定</i>` : '') +
        `</span>` +
        `<span class="settle-size">${it.w}×${it.h}</span>` +
        `<b class="settle-price">${money(sellOf(it))}</b>` +
        `</li>`
      );
    })
    .join('');

  veil.innerHTML =
    `<div class="settle-card" role="dialog" aria-label="结算">` +
    `<p class="settle-eyebrow">入口 · 交易所</p>` +
    `<h2 class="settle-title">这一趟</h2>` +
    (items.length ? `<ul class="settle-list">${rows}</ul>` : `<p class="settle-empty">空着手回来了。</p>`) +
    `<p class="settle-total"><span>合计</span><b>${money(total)}</b></p>` +
    (wasted ? `<p class="settle-waste">没用完的补给留在下面了（${wasted} 件，不退钱）</p>` : '') +
    `<p class="settle-note">所持 ${money(run.money)}</p>` +
    `<button class="settle-btn" type="button" data-settle-ok>回入口</button>` +
    `</div>`;

  stage.append(veil);
  requestAnimationFrame(() => veil.classList.add('is-on'));

  const close = (): void => {
  veil.remove();
    onDone();
  };
  veil.querySelector('[data-settle-ok]')?.addEventListener('click', close);
}
