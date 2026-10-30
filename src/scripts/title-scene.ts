/*
 * 标题画面里"活着"的两样东西
 * ------------------------------------------------------------------
 * 1) 星空：canvas 画，200+ 颗。视频里星星是大小不一 + 带光晕的，
 *    纯 DOM 点做不到光晕，所以换成一张画布，亮的几颗多画一圈径向渐变。
 * 2) 像素腐蚀：标题旁边常驻的那层"字被打碎成方块"的效果。
 *    做法是给第二份文字套一张随机块状遮罩（SVG 生成 data URI），
 *    再盖几块实心白方块，每隔 1~2 秒换一次图案。
 */

type Star = {
  x: number;
  y: number;
  r: number;
  base: number;
  tw: number;
  ph: number;
  glow: number;
};

const POOL = 'ΑΒΓΔΘΛΞΠΣΦΨΩαβγδθλξπσφψω▓▒░█▌▐▄▀¦‖‡†ø×÷≡≈≥≤∅∈∑√∂';

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 屏幕上的星空：只画地平线以上，星星慢慢往左上飘 */
export function initSky(canvas: HTMLCanvasElement, horizon = 0.503): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars: Star[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;

  const build = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(w < 700 ? 120 : 240);
    const skyH = h * horizon;
    stars = Array.from({ length: count }, () => {
      const glow = Math.random();
      return {
        x: rnd(-0.02, 1.02) * w,
        y: Math.pow(Math.random(), 1.25) * skyH,
        r: glow > 0.94 ? rnd(1.5, 2.6) : rnd(0.35, 1.05),
        base: glow > 0.94 ? rnd(0.9, 1) : rnd(0.2, 0.8),
        tw: rnd(2.4, 7.5),
        ph: rnd(0, Math.PI * 2),
        glow: glow > 0.94 ? rnd(0.5, 1) : 0,
      };
    });

    // 地平线附近那层薄雾，让分割线不至于是硬切
    const g = ctx.createLinearGradient(0, skyH - h * 0.12, 0, skyH);
    g.addColorStop(0, 'rgba(120,145,190,0)');
    g.addColorStop(1, 'rgba(130,155,200,0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(0, skyH - h * 0.12, w, h * 0.12);
  };

  const draw = (t: number) => {
    ctx.clearRect(0, 0, w, h);
    const speed = reduce ? 0 : 0.0007;
    const dx = Math.sin(t * speed) * 16;
    const dy = Math.cos(t * speed * 0.75) * 5;

    for (const s of stars) {
      const blink = reduce ? 1 : 0.62 + 0.38 * Math.sin(t * 0.001 * (6.28 / s.tw) + s.ph);
      const alpha = Math.max(0, s.base * blink);
      const x = s.x + dx;
      const y = s.y - dy;

      if (s.glow > 0) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 5);
        g.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
        g.addColorStop(0.24, `rgba(226,238,255,${(alpha * 0.3).toFixed(3)})`);
        g.addColorStop(1, 'rgba(210,228,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  build();

  let raf = 0;
  const loop = (t: number) => {
    if (!document.hidden) draw(t);
    raf = window.requestAnimationFrame(loop);
  };

  if (reduce) {
    draw(0);
  } else {
    raf = window.requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      if (reduce) draw(0);
    }, 180);
  });

  window.addEventListener('pagehide', () => window.cancelAnimationFrame(raf), { once: true });
}

/** 一张随机块状遮罩，叠在文字上就得到"字被切成方块"的样子 */
function maskUri(seed = Math.random()): string {
  const cols = 26;
  const rows = 9;
  const rects: string[] = [];
  // 覆盖率要小：视频里只有零星几处被切碎，铺满了字就变成条纹
  const clusters = 2 + Math.floor(seed * 2);

  for (let c = 0; c < clusters; c += 1) {
    const cx = Math.floor(rnd(0, cols));
    const cy = Math.floor(rnd(0, rows));
    const n = 1 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i += 1) {
      const width = 1 + Math.floor(rnd(0, 2));
      const height = 1 + Math.floor(rnd(0, 2));
      const x = Math.min(cols - 1, Math.max(0, cx + Math.floor(rnd(-2, 2))));
      const y = Math.min(rows - 1, Math.max(0, cy + Math.floor(rnd(-1, 2))));
      rects.push(
        `<rect x="${(x / cols) * 100}%" y="${(y / rows) * 100}%" width="${(width / cols) * 100}%" height="${(height / rows) * 100}%" fill="#fff"/>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${rects.join('')}</svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/**
 * 常驻腐蚀：换遮罩 + 挪白方块。
 * calmer 的间隔留给"已经看过很多次"的访客，别一直闪。
 */
export function initCorruption(word: HTMLElement, host: HTMLElement): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const blocks = [...word.querySelectorAll<HTMLElement>('.w-blocks i')];
  if (!blocks.length) return;

  let burst = 0;

  const tick = () => {
    word.style.setProperty('--corrupt-mask', maskUri());
    // 反白块从哪一刀切：每次换一个位置，像是扫描线在扫过标题
    word.style.setProperty('--slab', `${rnd(82, 89).toFixed(1)}%`);
    // 只换掉一半方块，看起来是"随机断"，不是整屏刷新
    for (const block of blocks) {
      const alive = Math.random() < 0.55;
      if (!alive) {
        block.classList.remove('on');
        continue;
      }
      const bw = rnd(4, 26);
      const bh = rnd(2.5, 10);
      block.style.left = `${rnd(0, 96)}%`;
      block.style.top = `${rnd(16, 74)}%`;
      block.style.width = `${bw}px`;
      block.style.height = `${bh}px`;
      block.style.opacity = String(rnd(0.7, 1));
      block.classList.add('on');
    }
    host.classList.toggle('is-glitch', Math.random() < 0.8);
  };

  // 刚出来那会儿密一点，之后慢下来
  const schedule = () => {
    const wait = burst < 6 ? rnd(160, 320) : rnd(900, 2000);
    burst += 1;
    window.setTimeout(() => {
      tick();
      schedule();
    }, wait);
  };

  schedule();
  window.addEventListener('pagehide', () => {
    burst = 1e9;
  }, { once: true });
}

/** 乱码行：每隔几十毫秒换掉一批字 */
export function startFault(el: HTMLElement, text: string): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    el.textContent = text;
    return () => {};
  }

  let stop = false;
  const base = [...text];

  const tick = () => {
    if (stop) return;
    const chars = base.map((ch) => {
      if (ch === ' ') return ch;
      return Math.random() < 0.42 ? POOL[Math.floor(Math.random() * POOL.length)] : ch;
    });
    el.textContent = chars.join('');
    window.setTimeout(tick, 55 + Math.random() * 70);
  };

  tick();
  return () => {
    stop = true;
  };
}


