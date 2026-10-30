/**
 * 出发准备（在奥斯，0 米）
 * ------------------------------------------------------------------
 * 暗黑地牢那个「进本前买补给」的界面：
 *
 *   · 左边是货架，右边就是你的背包（东西直接买进格子）
 *   · 顶部按「打算下到第几层」给一套推荐配置，一键买齐
 *   · 没用完的补给不会退钱——所以买多了就是白扔
 *   · 顺便在这买背筐（扩容）
 *
 * 钱不够、格子不够时就不买，绝不半途付了钱没拿到东西。
 */

import { ABYSS_LAYERS } from '../../consts';
import { BAG_UPGRADES, bag } from './bag';
import { PROVISIONS, makeProvision, money } from './loot';
import { run, spend } from './run';
import { onRun } from './run';
import { toast } from './supply';

const LIGHT_FROM = 2600;

/**
 * 按目标深度算一套推荐配置
 * ------------------------------------------------------------------
 * 饥渴每 100 米掉 2 点（上下都算），一份补给顶 25 点。
 * 所以一条路要的份数 ≈ (目标深度 × 2 趟 × 0.02 - 100) / 25。
 */
function plan(depth: number): Record<string, number> {
  const travel = depth * 2;
  const spend = travel * 0.02; // 两趟加起来掉多少点
  const need = Math.ceil(Math.max(0, spend - 100) / 25);
  return {
    ration: Math.max(1, need),
    water: Math.max(1, need),
    lamp: ABYSS_LAYERS.filter((l) => l.from >= LIGHT_FROM && l.from <= depth).length,
    medkit: 1 + Math.floor(depth / 6000),
    rope: depth >= LIGHT_FROM ? 1 : 0,
    hardtack: 0,
  };
}

const PLAN_TARGETS = [
  { label: '一层', depth: 1350 },
  { label: '二层', depth: 2600 },
  { label: '三层', depth: 7000 },
  { label: '四层', depth: 12000 },
];

let veil: HTMLElement | null = null;
let targetDepth = 1350;

const depthNow = (): number => {
  const el = document.querySelector<HTMLElement>('[data-depth]');
  const n = Number((el?.textContent ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** 买一份：钱和格子都够才成 */
function buy(id: string, count = 1): number {
  const def = PROVISIONS.find((p) => p.id === id);
  if (!def || !bag) return 0;
  let bought = 0;
  for (let i = 0; i < count; i++) {
    if (run.money < def.price) break;
    const loot = makeProvision(id);
    if (!loot) break;
    if (!bag.add(loot)) {
      toast('背包放不下了');
      break;
    }
    if (!spend(def.price)) {
      // 理论上不会走到这（上面已经查过钱），保险起见退回去
      bag.remove(loot.uid);
      break;
    }
    bought += 1;
  }
  return bought;
}

function rowsHtml(): string {
  return PROVISIONS.map((p) => {
    const have = bag?.countOf(p.id) ?? 0;
    return (
      `<li class="prep-row" data-tier="${p.tier}">` +
      `<span class="prep-art"><svg viewBox="0 0 24 24">${p.icon}</svg></span>` +
      `<span class="prep-name">${p.name}<i>${p.w}×${p.h} · ${p.desc}</i></span>` +
      `<span class="prep-have" data-have="${p.id}">×${have}</span>` +
      `<b class="prep-price">${money(p.price)}</b>` +
      `<button class="prep-buy" type="button" data-buy="${p.id}">买</button>` +
      `</li>`
    );
  }).join('');
}

function nextUpgrade() {
  const size = bag?.size() ?? { cols: 6, rows: 5 };
  return BAG_UPGRADES.find((u) => u.cols > size.cols || u.rows > size.rows) ?? null;
}

function paint(): void {
  if (!veil) return;

  for (const p of PROVISIONS) {
    const el = veil.querySelector<HTMLElement>(`[data-have="${p.id}"]`);
    if (el) el.textContent = `×${bag?.countOf(p.id) ?? 0}`;
    const btn = veil.querySelector<HTMLButtonElement>(`[data-buy="${p.id}"]`);
    if (btn) btn.disabled = run.money < p.price;
  }

  const wallet = veil.querySelector<HTMLElement>('[data-prep-wallet]');
  if (wallet) wallet.textContent = `所持 ${money(run.money)}`;

  const size = bag?.size() ?? { cols: 6, rows: 5 };
  const used = veil.querySelector<HTMLElement>('[data-prep-bag]');
  if (used) used.textContent = `背包 ${size.cols}×${size.rows}`;

  const up = veil.querySelector<HTMLButtonElement>('[data-prep-up]');
  const next = nextUpgrade();
  if (up) {
    if (!next) {
      up.hidden = true;
    } else {
      up.hidden = false;
      up.textContent = `${next.name} · ${next.cols}×${next.rows}（${next.note}）· ${money(next.price)}`;
      up.disabled = run.money < next.price;
    }
  }

  const pn = plan(targetDepth);
  const hint = veil.querySelector<HTMLElement>('[data-prep-hint]');
  if (hint) {
    hint.textContent =
      `下到 ${money(targetDepth)} 米要：干粮 ${pn.ration} · 水 ${pn.water}` +
      (pn.lamp ? ` · 灯 ${pn.lamp}` : '') +
      ` · 医疗 ${pn.medkit}` +
      (pn.rope ? ` · 绳 ${pn.rope}` : '');
  }
}

function open(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage || veil) return;

  veil = document.createElement('div');
  veil.className = 'prep';
  veil.dataset.prep = '';
  veil.innerHTML =
    `<div class="prep-card" role="dialog" aria-label="出发准备">` +
    `<div class="prep-top">` +
    `<div><p class="prep-eyebrow">奥斯 · 出发准备</p><h2 class="prep-title">带什么下去</h2></div>` +
    `<button class="prep-close" type="button" data-prep-close aria-label="关">×</button>` +
    `</div>` +
    `<div class="prep-plan">` +
    `<span class="prep-plan-label">打算下到</span>` +
    PLAN_TARGETS.map(
      (t) => `<button class="prep-chip" type="button" data-plan="${t.depth}">${t.label}</button>`,
    ).join('') +
    `<button class="prep-buyall" type="button" data-buyall>买齐</button>` +
    `</div>` +
    `<p class="prep-hint" data-prep-hint></p>` +
    `<ul class="prep-list">${rowsHtml()}</ul>` +
    `<div class="prep-foot">` +
    `<span class="prep-wallet" data-prep-wallet>所持 0</span>` +
    `<span class="prep-size" data-prep-bag>背包 6×5</span>` +
    `<button class="prep-up" type="button" data-prep-up hidden></button>` +
    `</div>` +
    `</div>`;

  stage.append(veil);
  requestAnimationFrame(() => veil?.classList.add('is-on'));

  veil.addEventListener('click', (event) => {
    const el = event.target as HTMLElement;
    if (el === veil || el.closest('[data-prep-close]')) {
      close();
      return;
    }
    const planBtn = el.closest<HTMLButtonElement>('[data-plan]');
    if (planBtn) {
      targetDepth = Number(planBtn.dataset.plan) || 1350;
      for (const b of veil!.querySelectorAll('[data-plan]')) b.toggleAttribute('data-on', b === planBtn);
      paint();
      return;
    }
    const buyBtn = el.closest<HTMLButtonElement>('[data-buy]');
    if (buyBtn && buyBtn.dataset.buy) {
      const n = buy(buyBtn.dataset.buy, 1);
      if (!n) toast('钱不够，或者放不下了');
      paint();
      return;
    }
    if (el.closest('[data-buyall]')) {
      const pn = plan(targetDepth);
      let total = 0;
      for (const id of ['ration', 'water', 'lamp', 'medkit', 'rope'] as const) {
        const need = pn[id] ?? 0;
        if (!need) continue;
        const have = bag?.countOf(id) ?? 0;
        if (have >= need) continue;
        total += buy(id, need - have);
      }
      toast(total ? `买了 ${total} 份` : '钱不够，或者放不下了');
      paint();
      return;
    }
    if (el.closest('[data-prep-up]')) {
      const next = nextUpgrade();
      if (!next) return;
      if (!spend(next.price)) {
        toast('钱不够');
        return;
      }
      bag?.grow(next.cols, next.rows);
      toast(`${next.name} · ${next.cols}×${next.rows}`);
      paint();
    }
  });

  targetDepth = 1350;
  veil.querySelector('[data-plan="1350"]')?.setAttribute('data-on', '');
  paint();
}

function close(): void {
  if (!veil) return;
  veil.classList.remove('is-on');
  const old = veil;
  veil = null;
  window.setTimeout(() => old.remove(), 220);
}

// ---------------------------------------------------------------- 入口
let prompt: HTMLElement | null = null;

function ensurePrompt(): void {
  if (prompt) return;
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;
  prompt = document.createElement('button');
  prompt.type = 'button';
  prompt.className = 'prep-prompt';
  prompt.textContent = '出发准备';
  prompt.addEventListener('click', open);
  stage.append(prompt);
}

function syncPrompt(): void {
  ensurePrompt();
  if (!prompt) return;
  const near = depthNow() < 80 && run.alive;
  prompt.hidden = !near;
}

window.addEventListener('dive:tick', syncPrompt);
onRun(() => {
  syncPrompt();
  paint();
});
window.addEventListener('dive:surface', () => window.setTimeout(syncPrompt, 200));
window.addEventListener('dive:respawn', () => window.setTimeout(syncPrompt, 200));

ensurePrompt();
syncPrompt();

// 调试用
(window as unknown as { __prep: () => void }).__prep = open;
