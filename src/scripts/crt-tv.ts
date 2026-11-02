/**
 * 方块「老电视」交互
 * ------------------------------------------------------------------
 * 语义（2026-11-02 修订）：
 *   · 鼠标移到哪块，哪块就是"选中"：变大 + 开机，其余立刻关掉变黑
 *   · 选中项常开；离开整排也不会熄（它还是选中项）
 *   · 开机 140ms、关机 110ms —— 加起来 0.25s，扫一排不会拖泥带水
 *   · 方块本身不换台、不轮播，画面永远是同一个内容
 *
 * 页面负责"谁是选中"（切 is-on），这里负责开关机的动画和音效。
 * 用法：import { attachCrt } from '../scripts/crt-tv'; attachCrt();
 */

import { sfx } from './sfx';

const POWER_OFF_MS = 200; // 关机动画 110ms，留点余量再摘类
const SOUND_GAP = 110;

/** 开机：亮起来 + 白闪 + 撑开（140ms） */
export function powerOn(tile: HTMLElement): void {
  tile.classList.remove('is-power-off');
  tile.classList.add('is-live');
  tile.classList.remove('is-power-on');
  void tile.offsetWidth; // 强制重排，让动画能重放
  tile.classList.add('is-power-on');
  window.setTimeout(() => tile.classList.remove('is-power-on'), 200);
}

/** 关机：CRT 收成一条亮线（110ms） */
export function powerOff(tile: HTMLElement): void {
  tile.classList.remove('is-live', 'is-power-on');
  tile.classList.add('is-power-off');
  window.setTimeout(() => tile.classList.remove('is-power-off'), POWER_OFF_MS);
}

export function attachCrt(selector = '.crt-tile'): void {
  const tiles = [...document.querySelectorAll<HTMLElement>(selector)];
  if (!tiles.length) return;

  const timers = new WeakMap<HTMLElement, number>();
  let lastAt = 0;

  const playSound = () => {
    const now = performance.now();
    if (now - lastAt < SOUND_GAP) return;
    lastAt = now;
    sfx.tv();
  };

  for (const tile of tiles) {
    tile.addEventListener('pointerenter', () => {
      window.clearTimeout(timers.get(tile) ?? 0);
      // 页面通常已经通过「悬停即选中」把 is-on 切过来了；
      // 这里只补开机视觉（已经亮着就不重放）
      if (!tile.classList.contains('is-live')) {
        powerOn(tile);
        timers.set(tile, window.setTimeout(() => {}, 0));
      }
      playSound();
    });

    tile.addEventListener('pointerleave', () => {
      window.clearTimeout(timers.get(tile) ?? 0);
      // 选中项常开：离开整排也不熄灭
      if (tile.classList.contains('is-on')) {
        tile.classList.remove('is-power-on');
        return;
      }
      powerOff(tile);
    });
  }
}
