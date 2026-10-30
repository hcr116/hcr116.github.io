/**
 * 这一局的状态：生命、氧气、钱
 * ------------------------------------------------------------------
 * 氧气是唯一的时钟：进一个节点扣一次，撤离也要扣。
 * 死了**背包清空、钱包清零**（买下来的永久升级留着）。
 */

import { bag } from './bag';
import { meta } from './meta';

export type RunState = {
  hp: number;
  max: number;
  /** 0~100，唯一的时钟 */
  oxygen: number;
  oxygenMax: number;
  /** 这一局的钱（死了清零；卖东西进这里） */
  money: number;
  alive: boolean;
  deaths: number;
  /** 现在在第几层（1 起） */
  floor: number;
};

export const run: RunState = {
  hp: 100,
  max: 100,
  oxygen: 100,
  oxygenMax: 100,
  money: 0,
  alive: true,
  deaths: 0,
  floor: 1,
};

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = (): void => listeners.forEach((fn) => fn());

export const onRun = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** 玩家攻击力（商店里能买） */
export const playerAtk = (): number => 4 + meta.atk;

export function damage(amount: number): void {
  if (!run.alive || amount <= 0) return;
  run.hp = Math.max(0, run.hp - amount);
  emit();
  if (run.hp <= 0) die();
}

export function heal(amount: number): void {
  if (!run.alive) return;
  run.hp = Math.min(run.max, run.hp + amount);
  emit();
}

export function earn(amount: number): void {
  if (!(amount > 0)) return;
  run.money += Math.round(amount);
  emit();
}

export function spend(amount: number): boolean {
  if (!(amount > 0) || run.money < amount) return false;
  run.money -= Math.round(amount);
  emit();
  return true;
}

// ---------------------------------------------------------------- 氧气
/** 烧氧。返回是不是烧到见底了 */
export function burnOxygen(amount: number): boolean {
  if (!run.alive || amount <= 0) return false;
  run.oxygen = Math.max(0, run.oxygen - amount);
  emit();
  if (run.oxygen <= 0) {
    // 没气了：每动一下掉血
    damage(8);
  }
  return run.oxygen <= 0;
}

export function addOxygen(amount: number): void {
  run.oxygen = Math.min(run.oxygenMax, run.oxygen + amount);
  emit();
}

// ---------------------------------------------------------------- 死亡
let dying = false;

function die(): void {
  if (dying) return;
  dying = true;
  run.alive = false;
  run.deaths += 1;
  const lost = bag?.dropAll() ?? 0;
  const lostMoney = run.money;
  // 钱是这一趟的钱：死了就没了（买下来的升级留着）
  run.money = 0;
  emit();
  showDeath(lost, lostMoney);
}

function showDeath(lost: number, lostMoney: number): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  // 死在战斗/商店里的时候，那层面板还盖在上面，会把「从入口重来」压住点不到。
  // 先把它们全撤掉，死亡界面才是唯一能点的东西。
  document.querySelectorAll('[data-fight], [data-panel], [data-stairs], [data-settle], [data-inspect]').forEach((el) => el.remove());

  document.querySelector('[data-death]')?.remove();
  const veil = document.createElement('div');
  veil.className = 'death';
  veil.dataset.death = '';
  veil.innerHTML =
    `<p class="death-eyebrow">ABYSS · 生命归零</p>` +
    `<h2 class="death-title">你没能上去</h2>` +
    `<p class="death-note">` +
    `倒在 ${run.floor} 层。身上掉了 ${lost} 件，钱包里的 ${lostMoney.toLocaleString('en-US')} 也没了。` +
    `<br>买下来的东西还在。` +
    `</p>` +
    `<button class="death-btn" type="button" data-death-back>从入口重来</button>`;
  stage.append(veil);
  veil.querySelector('[data-death-back]')?.addEventListener('click', () => {
  veil.remove();
    respawn();
  });
  requestAnimationFrame(() => veil.classList.add('is-on'));
}

/** 从入口重来：血满、氧气满、回到第 1 层 */
function respawn(): void {
  run.hp = run.max;
  run.oxygen = run.oxygenMax;
  run.alive = true;
  run.floor = 1;
  dying = false;
  emit();
  window.dispatchEvent(new CustomEvent('abyss:respawn'));
}

/** 主动撤离时用：不弹死亡界面，只把状态复位 */
export function resetRun(): void {
  run.hp = run.max;
  run.oxygen = run.oxygenMax;
  run.alive = true;
  run.floor = 1;
  dying = false;
  emit();
}

// 调试用
(window as unknown as { __run?: () => RunState }).__run = () => run;
(window as unknown as { __kill?: () => void }).__kill = () => damage(9999);
