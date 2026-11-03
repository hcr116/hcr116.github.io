/**
 * 数据销毁（战策经验那条通道用）
 * ------------------------------------------------------------------
 * 一次完整演出，分四幕：
 *   1. 读取 / 递减：屏上出现一行极小的计数，从真实条数往下掉
 *   2. 崩解：屏被横切成 N 条，随机错位、淡出，中途闪白一帧
 *   3. 收束：碎块塌成一条亮线，随后熄灭
 *   4. 交接：返回 Promise，调用方接着做「权限不足」和左移补位
 *
 * 全部用 setTimeout + 内联样式推进（不用 CSS transition 的 transitionend），
 * 这样无头探针里也能稳定跑完、拿到确定的状态。
 *
 * 节奏参照 site 里已有的锁定条目（定格 420 + 收线 170 + 淡出 320 ≈ 910ms），
 * 这里 1.06s 收完，和它同一个拍子。
 */

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export type DissolveOptions = {
  /** 从多少掉到 0；0 或没给就不显示计数行 */
  count?: number;
  /** 切成几条，默认 7 */
  slices?: number;
  /** 递减一步多少毫秒，默认 60 */
  tick?: number;
};

export async function dissolveTile(tile: HTMLElement, options: DissolveOptions = {}): Promise<void> {
  const { count = 0, slices = 7, tick = 60 } = options;

  /* ---------- 覆盖层：切片 + 闪白 + 计数 ---------- */

  const layer = document.createElement('div');
  layer.className = 'ds-layer';
  layer.setAttribute('aria-hidden', 'true');

  const strips: HTMLElement[] = [];
  for (let i = 0; i < slices; i += 1) {
    const s = document.createElement('i');
    s.className = 'ds-strip';
    s.style.top = `${(i / slices) * 100}%`;
    s.style.height = `${100 / slices}%`;
    layer.append(s);
    strips.push(s);
  }

  const flash = document.createElement('b');
  flash.className = 'ds-flash';
  layer.append(flash);

  let countEl: HTMLElement | null = null;
  if (count > 0) {
    countEl = document.createElement('span');
    countEl.className = 'ds-count';
    countEl.textContent = `${count}`;
    layer.append(countEl);
  }

  tile.append(layer);
  tile.classList.add('is-dissolving');

  /* ---------- 第 1 幕：递减 ---------- */

  if (countElems(countEl, count, tick)) {
    await wait(Math.min(280, Math.max(120, tick * 4)));
  }

  /* ---------- 第 2 幕：切片崩解 ---------- */

  strips.forEach((s, i) => {
    const delay = Math.random() * 260;
    const dx = (Math.random() * 2 - 1) * 18;
    const dy = (Math.random() * 2 - 1) * 6;
    window.setTimeout(() => {
      s.style.transition = `transform ${180 + Math.random() * 120}ms ease, opacity 220ms ease`;
      s.style.transform = `translate(${dx}px, ${dy}px)`;
      s.style.opacity = '0';
    }, i * 18 + delay);
  });

  /* 中途闪白一帧 */
  window.setTimeout(() => {
    flash.classList.add('is-on');
    window.setTimeout(() => flash.classList.remove('is-on'), 70);
  }, 300);

  await wait(520);

  /* ---------- 第 3 幕：收束 ---------- */

  tile.classList.add('is-collapsing');
  layer.classList.add('is-collapse');
  await wait(240);

  tile.classList.remove('is-dissolving');
  layer.remove();
}

/** 计数递减：随机步长，别匀速 */
function countElems(el: HTMLElement | null, from: number, tick: number): boolean {
  if (!el || from <= 0) return false;

  let left = from;
  const timer = window.setInterval(() => {
    const step = Math.max(1, Math.round(left * (0.18 + Math.random() * 0.3)));
    left = Math.max(0, left - step);
    el.textContent = String(left);
    if (left <= 0) window.clearInterval(timer);
  }, tick);

  return true;
}

/* ==========================================================================
   左移补位：FLIP
   --------------------------------------------------------------------------
   先把要移走的元素从 DOM 摘掉，再让剩下的从"旧位置"过渡到"新位置"。
   ========================================================================== */

export async function removeAndShift(target: HTMLElement, siblings: HTMLElement[], ms = 260): Promise<void> {
  const before = new Map<HTMLElement, number>();
  for (const s of siblings) before.set(s, s.getBoundingClientRect().left);

  target.remove();

  const moves: Array<{ el: HTMLElement; dx: number }> = [];
  for (const s of siblings) {
    const now = s.getBoundingClientRect().left;
    const dx = (before.get(s) ?? now) - now;
    if (Math.abs(dx) > 0.5) moves.push({ el: s, dx });
  }

  for (const { el, dx } of moves) {
    el.style.transition = 'none';
    el.style.transform = `translateX(${dx}px)`;
  }

  /* 强制一次布局，让"倒着放回去"的那一帧成立。
     不用 requestAnimationFrame：无头环境下它可能不触发，
     整条 promise 会卡住，后面的清理逻辑就不跑了。定时器更稳。 */
  void target.offsetWidth;

  await wait(16);

  for (const { el } of moves) {
    el.style.transition = `transform ${ms}ms cubic-bezier(0.22, 0.9, 0.2, 1)`;
    el.style.transform = '';
  }

  await wait(ms + 40);

  for (const { el } of moves) {
    el.style.transition = '';
    el.style.transform = '';
  }
}
