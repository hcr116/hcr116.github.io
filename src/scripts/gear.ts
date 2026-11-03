/**
 * 标题页齿轮（示意用，?gear=a|b|c 开启，默认关闭）
 * ------------------------------------------------------------------
 * 位置：压在 "HuangChenRui" 里最后三个字母 **Rui** 的背后。
 * 为什么不在字中间：字是衬线大字，重心在右，齿轮放 Rui 背后刚好托住尾巴。
 *
 * 三种反应：
 *   a 齿比传动：主齿轮 + 左右两个小齿轮反向咬合，悬停菜单项 → 转到该格
 *   b 刻度环：24 格刻度环，悬停 → 把第 N 格转到顶部标记
 *   c 可变结构：悬停时换齿数再转（12 / 24 / 30 / 16）
 *
 * 静止时不是匀速自转，而是**一格一格地嗒**（钟表擒纵机构的手感）。
 */

export type GearVariant = 'a' | 'b' | 'c';

const NS = 'http://www.w3.org/2000/svg';
const TICK_MS = 2200;
const STEP_MS = 260;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag);
}

/** 细线齿轮（齿根圆内收，齿顶圆外凸，1.1px 描边） */
function gearSvg(teeth: number, r: number, alpha: number): SVGSVGElement {
  const svg = svgEl('svg');
  const size = r * 2.3;
  svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');

  const root = r * 0.88;
  const tip = r;
  const step = (Math.PI * 2) / teeth;

  const pts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    for (const [rr, aa] of [
      [root, a - step * 0.3],
      [tip, a - step * 0.16],
      [tip, a + step * 0.16],
      [root, a + step * 0.3],
    ] as Array<[number, number]>) {
      pts.push(`${(Math.cos(aa) * rr).toFixed(2)},${(Math.sin(aa) * rr).toFixed(2)}`);
    }
  }

  const path = svgEl('path');
  path.setAttribute('d', `M${pts.join(' L')} Z`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', `rgba(198, 231, 243, ${alpha})`);
  path.setAttribute('stroke-width', '1.1');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);

  const hub = svgEl('circle');
  hub.setAttribute('r', String(root * 0.42));
  hub.setAttribute('fill', 'none');
  hub.setAttribute('stroke', `rgba(198, 231, 243, ${alpha * 0.9})`);
  hub.setAttribute('stroke-width', '1');
  svg.append(hub);

  const count = Math.max(4, Math.round(teeth / 6));
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const line = svgEl('line');
    line.setAttribute('x1', String(Math.cos(a) * root * 0.42));
    line.setAttribute('y1', String(Math.sin(a) * root * 0.42));
    line.setAttribute('x2', String(Math.cos(a) * root * 0.92));
    line.setAttribute('y2', String(Math.sin(a) * root * 0.92));
    line.setAttribute('stroke', `rgba(198, 231, 243, ${alpha * 0.55})`);
    line.setAttribute('stroke-width', '1');
    svg.append(line);
  }

  return svg;
}

/** 刻度环（b 用） */
function ringSvg(r: number, alpha: number): SVGSVGElement {
  const svg = svgEl('svg');
  const size = r * 2.3;
  svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');

  const circle = svgEl('circle');
  circle.setAttribute('r', String(r));
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', `rgba(198, 231, 243, ${alpha})`);
  circle.setAttribute('stroke-width', '1.1');
  svg.append(circle);

  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const long = i % 6 === 0;
    const line = svgEl('line');
    line.setAttribute('x1', String(Math.cos(a) * r * (long ? 0.9 : 0.95)));
    line.setAttribute('y1', String(Math.sin(a) * r * (long ? 0.9 : 0.95)));
    line.setAttribute('x2', String(Math.cos(a) * r));
    line.setAttribute('y2', String(Math.sin(a) * r));
    line.setAttribute('stroke', `rgba(198, 231, 243, ${alpha * (long ? 1.6 : 0.9)})`);
    line.setAttribute('stroke-width', long ? '1.6' : '1');
    svg.append(line);
  }

  return svg;
}

/**
 * 量出 "Rui" 这三个字母在字里的位置（用 Range 取子串矩形，最准）
 * 找不到就退回整字的右三分之一。
 */
function measureRui(word: HTMLElement): { cx: number; cy: number; size: number } {
  const host = word.querySelector<HTMLElement>('.w-a') ?? word;
  const text = host.textContent ?? '';
  const at = text.toLowerCase().lastIndexOf('rui');

  const box = word.getBoundingClientRect();

  if (at > 0 && host.firstChild?.nodeType === Node.TEXT_NODE) {
    const node = host.firstChild;
    const range = document.createRange();
    try {
      range.setStart(node, at);
      range.setEnd(node, Math.min(text.length, at + 3));
      const rect = range.getBoundingClientRect();
      if (rect.width > 0) {
        return {
          cx: rect.left + rect.width / 2 - box.left,
          cy: rect.top + rect.height / 2 - box.top,
          size: Math.max(rect.width, rect.height),
        };
      }
    } catch {
      /* 落到下面兜底 */
    }
  }

  return { cx: box.width * 0.82, cy: box.height * 0.5, size: box.height * 0.6 };
}

export function initGear(variant: GearVariant): void {
  const word = document.querySelector<HTMLElement>('.tp-word');
  if (!word) return;

  const layer = document.createElement('div');
  layer.className = 'tp-gear';
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.variant = variant;
  word.append(layer);

  word.classList.add('has-gear');

  const state = { angle: 0, target: 0, locked: false, teeth: 20 };
  const ALPHA = 0.14;
  let stage: HTMLElement | null = null;
  let smalls: HTMLElement[] = [];

  const place = (): void => {
    const { cx, cy, size } = measureRui(word);
    const r = Math.max(34, Math.min(96, size * 0.92));
    layer.style.left = `${cx}px`;
    layer.style.top = `${cy}px`;
    layer.dataset.radius = String(r);
    draw(r);
  };

  const draw = (r: number): void => {
    layer.textContent = '';
    smalls = [];

    if (variant === 'b') {
      stage = document.createElement('div');
      stage.className = 'tp-gear-stage';
      stage.append(ringSvg(r * 1.5, ALPHA));
    } else {
      stage = document.createElement('div');
      stage.className = 'tp-gear-stage';
      stage.append(gearSvg(state.teeth, r, ALPHA));

      if (variant === 'a') {
        const half = Math.round(state.teeth / 2);
        const sr = r * 0.44;
        for (const dir of [-1, 1]) {
          const small = document.createElement('div');
          small.className = 'tp-gear-small';
          small.style.setProperty('--dx', `${dir * (r + sr) * 0.86}px`);
          small.style.setProperty('--dy', `${dir * (r + sr) * 0.5}px`);
          small.append(gearSvg(half, sr, ALPHA));
          layer.append(small);
          smalls.push(small);
        }
      }
    }

    layer.append(stage);
    applyAngle(state.angle, 0);
  };

  const applyAngle = (deg: number, ms: number): void => {
    state.angle = deg;
    if (stage) {
      stage.style.transition = ms ? `transform ${ms}ms cubic-bezier(.22,.9,.2,1)` : 'none';
      stage.style.transform = `rotate(${deg}deg)`;
    }
    smalls.forEach((s, i) => {
      s.style.transition = ms ? `transform ${ms}ms cubic-bezier(.22,.9,.2,1)` : 'none';
      s.style.transform = `translate(var(--dx), var(--dy)) rotate(${-deg * 2}deg)`;
    });
  };

  /* 静止：一格一格地嗒 */
  const step = () => 360 / (variant === 'c' ? state.teeth : state.teeth);
  window.setInterval(() => {
    if (state.locked) return;
    state.target += step();
    applyAngle(state.target, STEP_MS);
  }, TICK_MS);

  /* 悬停菜单 → 转到对应格 */
  const onEnter = (index: number): void => {
    state.locked = true;

    if (variant === 'b') {
      applyAngle(-(index * 90), 520);
      return;
    }

    if (variant === 'c') {
      const shape = [12, 24, 30, 16][index] ?? 20;
      state.teeth = shape;
      place();
      applyAngle(state.angle + 30, 420);
      return;
    }

    state.target = index * 45;
    applyAngle(state.target, 420);
  };

  document.addEventListener('pointerenter', () => {}, true);
  document.addEventListener(
    'pointerover',
    (event) => {
      const link = (event.target as Element | null)?.closest?.('.tp-menu a');
      if (!(link instanceof HTMLElement)) return;
      const all = [...document.querySelectorAll('.tp-menu a')];
      onEnter(Math.max(0, all.indexOf(link)));
    },
    { passive: true },
  );

  document.querySelector('.tp-menu')?.addEventListener('mouseleave', () => {
    state.locked = false;
  });

  /* 字会随窗口变化（clamp 字号），重新量 */
  window.addEventListener('resize', () => place());
  if (document.fonts) void document.fonts.ready.then(() => place());

  place();
  window.requestAnimationFrame(() => layer.classList.add('is-ready'));
  /* 字会随启动序列的缩放变化，多量几次对齐 */
  window.setTimeout(place, 1200);
  window.setTimeout(place, 2600);
  window.setTimeout(() => place(), 4200);
}
