/**
 * 世界线切换（噪声替换）
 * ------------------------------------------------------------------
 * 用于「战策经验」销毁之后：把下方大字区用噪声盖住，
 * 噪声最密的那一下把文字换掉，再抽走噪声 —— 观众的体感不是渐变，是"被替换"。
 *
 * 参考 Steins;Gate 的世界线移动：关键不是渐变，是**用噪声遮住切换**。
 * 这里用垂直噪声条（不是满屏雪花），抽走方向从右往左，形成"扫过"的感觉。
 */

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export type WorldlineOptions = {
  /** 噪声最密时切文本（在这之前调用方看不见） */
  swap: () => void;
  /** 覆盖时长，默认 170ms */
  ms?: number;
};

export function worldlineSwap(host: HTMLElement, options: WorldlineOptions): Promise<void> {
  const { swap, ms = 170 } = options;

  const noise = document.createElement('div');
  noise.className = 'wl-noise';
  noise.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 14; i += 1) {
    const bar = document.createElement('i');
    bar.style.left = `${(i / 14) * 100}%`;
    bar.style.width = `${100 / 14 + 0.4}%`;
    bar.style.animationDelay = `${-Math.random() * 0.4}s`;
    noise.append(bar);
  }
  host.append(noise);

  /* 噪声涨起来 */
  noise.classList.add('is-on');

  return (async () => {
    await wait(Math.round(ms * 0.45));

    /* 最密的一帧：换内容（这一步用户看不见） */
    swap();
    noise.classList.add('is-peak');

    await wait(Math.round(ms * 0.25));
    noise.classList.add('is-sweep');
    await wait(Math.round(ms * 0.5));

    noise.remove();
  })();
}
