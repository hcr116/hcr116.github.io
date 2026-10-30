/**
 * 检视一件东西
 * ------------------------------------------------------------------
 * 点开一件东西，看清它是什么、多大、值多少、能不能用。
 * 背包里点一下、补给/宝物面板里点一下，都往 window 上抛 `loot:inspect`，
 * 这里接住——背包那边就不用反过来 import 这个模块。
 */

import { bag } from './bag';
import { heal, run } from './run';
import { toast } from './hud';
import { TIER_COLOR, money, sellOf, type Loot } from './loot';

let current: Loot | null = null;

const effectText = (loot: Loot): string => {
  const u = loot.use;
  if (!u) return '';
  return [u.heal ? `回血 ${u.heal}` : '', u.hunger ? `饱 ${u.hunger}` : '', u.thirst ? `解渴 ${u.thirst}` : '']
    .filter(Boolean)
    .join(' · ');
};

function build(loot: Loot): HTMLElement {
  const veil = document.createElement('div');
  veil.className = 'inspect';
  veil.dataset.inspect = '';
  veil.style.setProperty('--tier', TIER_COLOR[loot.tier]);

  const name = loot.unknown ? '？？？' : loot.name;
  const rank = loot.unknown ? '未鉴定' : loot.rank;
  const price = loot.unknown ? '—' : loot.provision ? '不回收' : money(sellOf(loot));
  const desc = loot.unknown
    ? '看不出是什么。形状、大小、颜色都记下来了，带回入口才弄得清楚。'
    : loot.desc;
  const usable = !!loot.use && !loot.unknown;
  const effect = effectText(loot);

  veil.innerHTML =
    `<div class="inspect-card" role="dialog" aria-label="物品">` +
    `<div class="inspect-top">` +
    `<span class="inspect-art"><svg viewBox="0 0 24 24">${loot.icon}</svg></span>` +
    `<span class="inspect-head"><b class="inspect-name">${name}</b><i class="inspect-rank">${rank}</i></span>` +
    `<button class="inspect-close" type="button" data-inspect-close aria-label="关">×</button>` +
    `</div>` +
    `<dl class="inspect-facts">` +
    `<div><dt>类型</dt><dd>${loot.unknown ? '不明' : loot.kind}</dd></div>` +
    `<div><dt>占格</dt><dd>${loot.w}×${loot.h}</dd></div>` +
    `<div><dt>${loot.provision ? '买价' : '估价'}</dt><dd>${price}</dd></div>` +
    `</dl>` +
    `<p class="inspect-desc">${desc}</p>` +
    (usable ? `<p class="inspect-hint">生命 ${Math.round(run.hp)} / ${run.max}</p>` : '') +
    (usable
      ? `<div class="inspect-actions"><button class="inspect-btn" type="button" data-inspect-use>` +
        `${loot.use!.label}${effect ? ` · ${effect}` : ''}</button></div>`
      : '') +
    `</div>`;

  return veil;
}

function close(): void {
  const veil = document.querySelector<HTMLElement>('[data-inspect]');
  if (!veil) return;
  veil.remove();
  current = null;
}

export function openInspect(loot: Loot): void {
  if (!document.querySelector('[data-dive-stage]')) return;
  document.querySelector('[data-inspect]')?.remove();
  current = loot;

  const veil = build(loot);
  document.querySelector('[data-dive-stage]')!.append(veil);
  requestAnimationFrame(() => veil.classList.add('is-on'));

  veil.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === veil || target.closest('[data-inspect-close]')) {
      close();
      return;
    }
    if (target.closest('[data-inspect-use]') && current) {
      const used = current;
      if (used.use?.heal) heal(used.use.heal);
      bag?.remove(used.uid);
      toast(`${used.use?.label ?? '用了'}`);
      close();
    }
  });
}

window.addEventListener('loot:inspect', (event) => {
  const loot = (event as CustomEvent<{ loot: Loot }>).detail?.loot;
  if (loot) openInspect(loot);
});

window.addEventListener('keydown', (event) => {
  if ((event as KeyboardEvent).key === 'Escape') close();
});

// 调试用
(window as unknown as { __inspect: (loot: Loot) => void }).__inspect = openInspect;
