/**
 * HUD：层数 / 生命 / 氧气 / 钱，外加一条提示条
 * ------------------------------------------------------------------
 * 氧气是唯一会自己往下掉的东西，所以它单独一行、颜色最扎眼。
 */

import { run, onRun, playerAtk } from './run';

// ---------------------------------------------------------------- 提示条
let toastEl: HTMLElement | null = null;
let toastTimer = 0;

export function toast(text: string): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;
  if (!toastEl || !toastEl.isConnected) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    stage.append(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('is-on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('is-on'), 2000);
}

// ---------------------------------------------------------------- 面板
let hud: HTMLElement | null = null;

export function initHud(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML =
    `<div class="hud-row hud-floor"><span class="hud-label">层</span><b data-floor>1</b>` +
    `<i class="hud-sub" data-floor-name></i></div>` +
    `<div class="hud-row"><span class="hud-label">生命</span><span class="hud-bar hud-bar--hp"><i></i></span><b data-hp>100</b></div>` +
    `<div class="hud-row hud-oxy"><span class="hud-label">氧气</span><span class="hud-bar hud-bar--oxy"><i></i></span><b data-oxy>100</b></div>` +
    `<div class="hud-row hud-money"><span class="hud-label">所持</span><b data-money>0</b>` +
    `<i class="hud-sub">枚 · 攻 <span data-atk>${playerAtk()}</span></i></div>`;
  stage.append(hud);

  const hpBar = hud.querySelector<HTMLElement>('.hud-bar--hp > i');
  const oxyBar = hud.querySelector<HTMLElement>('.hud-bar--oxy > i');
  const hp = hud.querySelector<HTMLElement>('[data-hp]');
  const oxy = hud.querySelector<HTMLElement>('[data-oxy]');
  const cash = hud.querySelector<HTMLElement>('[data-money]');
  const floor = hud.querySelector<HTMLElement>('[data-floor]');
  const atk = hud.querySelector<HTMLElement>('[data-atk]');

  const sync = (): void => {
    if (hpBar) hpBar.style.width = `${Math.max(0, (run.hp / run.max) * 100).toFixed(1)}%`;
    if (oxyBar) oxyBar.style.width = `${Math.max(0, (run.oxygen / run.oxygenMax) * 100).toFixed(1)}%`;
    if (hp) hp.textContent = String(Math.round(run.hp));
    if (oxy) oxy.textContent = String(Math.round(run.oxygen));
    if (cash) cash.textContent = run.money.toLocaleString('en-US');
    if (floor) floor.textContent = String(run.floor);
    if (atk) atk.textContent = String(playerAtk());
    if (hud) {
      hud.dataset.lowHp = run.hp / run.max < 0.34 ? '1' : '0';
      hud.dataset.lowOxy = run.oxygen / run.oxygenMax < 0.25 ? '1' : '0';
    }
  };

  onRun(sync);
  sync();
}

/** 层名（Ⅰ · 阿比斯之渊） */
export function setFloorLabel(text: string): void {
  const el = document.querySelector<HTMLElement>('[data-floor-name]');
  if (el) el.textContent = text;
}
