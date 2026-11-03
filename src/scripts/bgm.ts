/**
 * 背景音乐（只在标题画面响）
 * ------------------------------------------------------------------
 * 规则（2026-11-02）：
 *   · 只有首页的标题画面有音乐，加载/自检那段**不响**，内页一律静音
 *   · 用户第一次交互（点击/按键）之后才允许出声 —— 浏览器的硬规则
 *   · 起播不渐入（音频开头本身是静的）；离开首页时 0.35 秒渐出，不留硬切
 *   · 全站没有音量 UI（开关按钮已撤），音量写死在 DEFAULT_VOLUME
 *
 * 节拍检测（bgm-beat.ts）挂在同一个 <audio> 上，标题呼吸靠它。
 */

import { attachBgmBeat } from './bgm-beat';

/** 目标音量：0–1。氛围音乐，别压过人声。 */
const DEFAULT_VOLUME = 0.22;

/* 起播渐入：0 = 不渐入，直接到目标音量。
   这条音频开头本来就是静音，再渐入等于白等 2.4 秒（用户要求关掉）。 */
const FADE_IN_MS = 0;

let el: HTMLAudioElement | null = null;
let target = DEFAULT_VOLUME;
let fadeTimer = 0;
let started = false;
let armed = false;

/** 拿到底层 <audio>（节拍检测用） */
export function bgmEl(): HTMLAudioElement | null {
  return el;
}

function clearFade(): void {
  if (fadeTimer) window.clearInterval(fadeTimer);
  fadeTimer = 0;
}

/** 线性淡到某个音量；ms=0 直接跳 */
function fadeTo(value: number, ms: number): void {
  if (!el) return;
  clearFade();
  const to = Math.max(0, Math.min(1, value));
  if (ms <= 0) {
    el.volume = to;
    return;
  }
  const from = el.volume;
  const t0 = performance.now();
  fadeTimer = window.setInterval(() => {
    if (!el) return clearFade();
    const p = Math.min(1, (performance.now() - t0) / ms);
    el.volume = from + (to - from) * p;
    if (p >= 1) clearFade();
  }, 40);
}

/** 建 <audio>（不播放）。只应在首页调用。 */
export function initBgm(src: string, volume = DEFAULT_VOLUME): HTMLAudioElement | null {
  if (!src) return null;
  if (el) return el;
  target = volume;

  const audio = new Audio();
  audio.src = src;
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0; // 从 0 开始，交给 fadeTo 渐入
  audio.crossOrigin = 'anonymous';
  el = audio;

  (window as unknown as { __bgm?: HTMLAudioElement }).__bgm = audio;
  attachBgmBeat(audio);

  audio.addEventListener('pause', () => {
    started = false;
  });

  return audio;
}

/** 真的开始放：渐入 */
export function startBgm(fadeMs = FADE_IN_MS): void {
  if (!el || started) return;
  started = true;
  /* 不渐入时先给到目标音量，避免起播那一帧是 0 */
  el.volume = fadeMs > 0 ? 0 : Math.max(0, Math.min(1, target));
  void el
    .play()
    .then(() => fadeTo(target, fadeMs))
    .catch(() => {
      // 还没有手势：退回未开始状态，等下一次交互
      started = false;
    });
}

/** 离开首页前渐出（调用方紧接着就会导航） */
export function fadeOutBgm(ms = 350): void {
  if (!el) return;
  fadeTo(0, ms);
  window.setTimeout(() => {
    el?.pause();
  }, ms + 40);
}

/**
 * 标题画面就位之后调用：
 *   · 已经有过交互 → 直接渐入
 *   · 没有交互 → 挂一次性监听，等下一个点击/按键
 * 加载（自检）阶段不要调这个，否则音乐会在开机时响。
 */
export function startBgmWhenReady(fadeMs = FADE_IN_MS): void {
  if (!el) return;
  const active = navigator.userActivation?.hasBeenActive ?? true;
  if (active) {
    startBgm(fadeMs);
    return;
  }
  if (armed) return;
  armed = true;
  const once = (): void => {
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
    window.removeEventListener('touchstart', once);
    startBgm(fadeMs);
  };
  window.addEventListener('pointerdown', once, { passive: true });
  window.addEventListener('keydown', once);
  window.addEventListener('touchstart', once, { passive: true });
}
