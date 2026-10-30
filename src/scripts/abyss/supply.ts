/**
 * 饥与渴
 * ------------------------------------------------------------------
 * 两条值，各 0~100，**走多少掉多少**（下潜和上浮都算）。
 * 吃不吃、喝不喝是玩家自己的事——不自动，也不啰嗦。
 *
 *   · 走 100 米：饥 -2、渴 -2   （100 点 = 5,000 米的路）
 *   · 归零以后还走：饿掉 2 血 / 100 米，渴掉 3 血 / 100 米
 *
 * 灯火不在这条线上：三层起每进一层烧一支，没灯就摸黑（掉 6 血）。
 * 医疗包、硬口粮也是手动用。
 */

import { ABYSS_LAYERS } from '../../consts';
import { bag } from './bag';
import { damage, heal, run } from './run';
import { depthFromSank } from './metrics';
import { PROVISIONS, type Loot } from './loot';

const HUNGER_PER_100M = 2;
const THIRST_PER_100M = 2;
const STARVE_HP_PER_100M = 2;
const THIRST_HP_PER_100M = 3;
/** 从这一层开始要灯 */
const NEED_LIGHT_FROM = 2600;
/** 一帧里跳这么远，肯定是瞬移（撤离/回城），不算走路 */
const WARP_GUARD = 1200;

const LAYERS_NEEDING_LIGHT = ABYSS_LAYERS.filter((l) => l.from >= NEED_LIGHT_FROM).length;

let hunger = 100;
let thirst = 100;
let lastDepth = 0;
let litLayers = 0;
let warnedHunger = false;
let warnedThirst = false;

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

// ---------------------------------------------------------------- 对外：吃 / 喝 / 用
export const needs = () => ({ hunger: Math.round(hunger), thirst: Math.round(thirst) });

/** 按 id 找一件在手边的，用掉它 */
export function useProvision(id: string): boolean {
  const loot = bag?.find((it) => it.id === id);
  if (!loot) return false;
  return consume(loot);
}

/** 用掉一件带 use 的东西（吃的、喝的、药） */
export function consume(loot: Loot): boolean {
  const use = loot.use;
  if (!use) return false;
  if (use.heal) heal(use.heal);
  if (use.hunger) hunger = clamp(hunger + use.hunger);
  if (use.thirst) thirst = clamp(thirst + use.thirst);
  bag?.remove(loot.uid);
  paint();
  return true;
}

/**
 * 用掉一件东西的「第二种吃法」（`purify`）。
 * 现在只有白海水走到这儿：背包里有灯火 → 烧开 → 从"解渴最多但掉血"变成正常的水。
 * 注意灯火**不消耗**：它是一支能烧一层的东西，不是一根火柴。
 */
export function consumeAlt(loot: Loot): boolean {
  const alt = loot.purify;
  if (!alt) return false;
  if (bag && bag.countOf(alt.need) <= 0) return false;
  if (alt.heal) heal(alt.heal);
  if (alt.hunger) hunger = clamp(hunger + alt.hunger);
  if (alt.thirst) thirst = clamp(thirst + alt.thirst);
  bag?.remove(loot.uid);
  paint();
  return true;
}

// ---------------------------------------------------------------- HUD
let hud: HTMLElement | null = null;
let sig = '';

function ensureHud(): void {
  if (hud) return;
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;
  hud = document.createElement('div');
  hud.className = 'vitals';
  hud.innerHTML =
    `<div class="vital" data-vital="hunger"><span class="vital-label">饥</span>` +
    `<span class="vital-bar"><i></i></span><b class="vital-num">100</b></div>` +
    `<div class="vital" data-vital="thirst"><span class="vital-label">渴</span>` +
    `<span class="vital-bar"><i></i></span><b class="vital-num">100</b></div>` +
    `<div class="vital-tools">` +
    PROVISIONS.filter((p) => p.use)
      .map(
        (p) =>
          `<button class="vital-tool" type="button" data-use="${p.id}" title="${p.use!.label}">` +
          `<i>${p.name}</i><b data-have="${p.id}">0</b></button>`,
      )
      .join('') +
    `</div>`;
  stage.append(hud);

  hud.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-use]');
    const id = btn?.dataset.use;
    if (!id) return;
    const def = PROVISIONS.find((p) => p.id === id);
    if (!useProvision(id)) {
      toast('身上没有');
      return;
    }
    toast(def ? def.use!.label : '用了');
  });

  paint();
}

function paint(): void {
  ensureHud();
  if (!hud) return;
  const counts = Object.fromEntries(PROVISIONS.filter((p) => p.use).map((p) => [p.id, bag?.countOf(p.id) ?? 0]));
  const next = `${hunger}|${thirst}|${JSON.stringify(counts)}`;
  if (next === sig) return;
  sig = next;

  for (const key of ['hunger', 'thirst'] as const) {
    const val = key === 'hunger' ? hunger : thirst;
    const row = hud.querySelector<HTMLElement>(`[data-vital="${key}"]`);
    if (!row) continue;
    row.dataset.low = val < 25 ? '1' : '0';
    const bar = row.querySelector<HTMLElement>('i');
    if (bar) bar.style.width = `${val}%`;
    const num = row.querySelector<HTMLElement>('.vital-num');
    if (num) num.textContent = String(Math.round(val));
  }

  for (const [id, n] of Object.entries(counts)) {
    const el = hud.querySelector<HTMLElement>(`[data-have="${id}"]`);
    if (el) el.textContent = String(n);
    el?.parentElement?.setAttribute('data-empty', n === 0 ? '1' : '0');
  }
}

// ---------------------------------------------------------------- 提示条
let toastEl: HTMLElement | null = null;
let toastTimer = 0;

export function toast(text: string): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    stage.append(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('is-on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('is-on'), 2000);
}

// ---------------------------------------------------------------- 走路就会掉
function reset(): void {
  hunger = 100;
  thirst = 100;
  lastDepth = 0;
  litLayers = 0;
  warnedHunger = false;
  warnedThirst = false;
  paint();
}

window.addEventListener('dive:tick', (event) => {
  const sank = (event as CustomEvent<{ sank: number }>).detail?.sank ?? 0;
  const depth = depthFromSank(sank);
  if (!run.alive) {
    lastDepth = depth;
    return;
  }

  // 走的路：上下都算，抖几米不算
  const step = Math.abs(depth - lastDepth);
  lastDepth = depth;

  // 撤离/回城会把位置直接搬回水面——那不是「走」，是瞬移，不能按距离扣
  if (step > WARP_GUARD || step < 0.5) {
    paint();
    return;
  }

  // step 米 = step/100 个「一百米」
  const k = step / 100;
  const wasStarving = hunger <= 0;
  const wasParched = thirst <= 0;

  hunger = Math.max(0, hunger - k * HUNGER_PER_100M);
  thirst = Math.max(0, thirst - k * THIRST_PER_100M);

  // 饿着/渴着还走，就掉血
  const hpLoss = k * ((wasStarving ? STARVE_HP_PER_100M : 0) + (wasParched ? THIRST_HP_PER_100M : 0));
  if (hpLoss > 0.05) damage(hpLoss);

  // 灯火：三层起每进一层烧一支
  const needed = Math.min(
    LAYERS_NEEDING_LIGHT,
    ABYSS_LAYERS.filter((l) => l.from >= NEED_LIGHT_FROM && depth >= l.from).length,
  );
  while (litLayers < needed) {
    litLayers += 1;
    if (!bag?.takeOne('lamp')) {
      damage(6);
      toast('没有灯 · 摸黑下了一层 · 掉了 6 点血');
    }
  }

  if (hunger < 25 && !warnedHunger) {
    warnedHunger = true;
    toast('饿了');
  }
  if (hunger > 35) warnedHunger = false;
  if (thirst < 25 && !warnedThirst) {
    warnedThirst = true;
    toast('渴了');
  }
  if (thirst > 35) warnedThirst = false;

  paint();
});

window.addEventListener('dive:surface', () => window.setTimeout(reset, 100));
window.addEventListener('dive:respawn', () => window.setTimeout(reset, 100));
window.addEventListener('bag:changed', paint);

ensureHud();
paint();

// 调试用
(window as unknown as { __supply: () => unknown }).__supply = () => ({
  hunger: Math.round(hunger),
  thirst: Math.round(thirst),
  litLayers,
  counts: Object.fromEntries(PROVISIONS.filter((p) => p.use).map((p) => [p.id, bag?.countOf(p.id) ?? 0])),
});
