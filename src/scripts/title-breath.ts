/**
 * 标题的「呼吸」（方案 C）
 * ------------------------------------------------------------------
 * 不是跟着拍子踏步，是整行字随乐句轻轻浮一下：
 *   · 竖直位移 ≤ 1.8px（--breath 0~1 → 0~-1.8px）
 *   · 缩放 1 → 1.006（几乎看不出，但眼睛能感觉到"活"）
 *   · 色散层跟着稍微糊一点
 *
 * 数据来源：bgm-beat.ts 抛的 `bgm:level`（0~1 连续值）。
 * 没在放音乐、或者浏览器不给分析频谱时，`bgm:idle` 会把值收回 0，字就静止。
 *
 * 演示模式（?breath=demo）：不听音乐，用一个慢正弦假装在呼吸，
 * 方便没声/没手势的时候看动效。
 *
 * 参数：
 *   ?breath=1      跟音乐
 *   ?breath=demo   假呼吸（看效果用）
 *   &amp=2.5       放大振幅（调试/截图用）
 */

export type BreathMode = 'audio' | 'demo';

export function initTitleBreath(mode: BreathMode): void {
  const tp = document.querySelector<HTMLElement>('[data-tp]');
  if (!tp) return;

  const params = new URLSearchParams(location.search);
  const amp = Number(params.get('amp'));
  if (Number.isFinite(amp) && amp > 0) tp.style.setProperty('--breath-amp', `${amp}px`);

  tp.setAttribute('data-breath', '1');

  let cur = 0;
  let target = 0;
  let raf = 0;

  const tick = (): void => {
    raf = requestAnimationFrame(tick);
    // 平滑：升得快一点、落得慢一点，像吸气/呼气
    const k = target > cur ? 0.18 : 0.07;
    cur += (target - cur) * k;
    if (Math.abs(cur - target) < 0.002) cur = target;
    tp.style.setProperty('--breath', cur.toFixed(3));
  };
  raf = requestAnimationFrame(tick);

  if (mode === 'demo') {
    const t0 = performance.now();
    window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      // 0.22Hz 的慢呼吸 + 一点点更快的起伏，别太规律
      const slow = 0.5 + 0.5 * Math.sin(t * 1.4);
      const fast = 0.5 + 0.5 * Math.sin(t * 3.7 + 1.1);
      target = 0.15 + 0.62 * slow + 0.23 * fast;
    }, 60);
    return;
  }

  window.addEventListener('bgm:level', (event) => {
    const level = (event as CustomEvent<{ level: number }>).detail?.level ?? 0;
    target = Math.max(0, Math.min(1, level));
  });
  window.addEventListener('bgm:idle', () => {
    target = 0;
  });

  window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
}
