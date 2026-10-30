/**
 * 路上的搜索点
 * ------------------------------------------------------------------
 * 不再挂在站点上。搜索点按「深度」钉在路线上：
 * 你往下滚，它从下面浮上来；点它读秒，东西掉在旁边；
 * 滚过去了它就沉回黑里——想回头搜，得往上爬，而往上爬要掉血。
 *
 * 坐标：屏幕坐标。每个点的 y = 它所在深度的滚动位置 − 当前滚动位置，
 * 所以它天然跟页面同速往上走，不需要另算速度。
 */

import { ABYSS_LAYERS } from '../../consts';
import { scrollYForDepth } from './stations';
import { rollLoot, TIER_COLOR, money, type Loot } from './loot';
import { bag } from './bag';

type Kind = { id: string; name: string; ms: number; icon: string };

const P = (d: string): string =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

/** 各层能搜的东西（名字 + 图案 + 读秒） */
const KINDS: (Kind & { layers: string[] })[] = [
  { id: 'root', name: '树根', ms: 1200, layers: ['Ⅰ'], icon: P('M12 3.5v7M12 10.5l-4 5M12 10.5l4 5M8 15.5l-1 5M16 15.5l1 5') },
  { id: 'fossil', name: '化石堆', ms: 2400, layers: ['Ⅰ'], icon: P('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 6.5a5.5 5.5 0 1 1 0 11M12 9.5a2.5 2.5 0 1 0 0 5') },
  { id: 'hollow', name: '树洞', ms: 1200, layers: ['Ⅱ'], icon: P('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8a4 4 0 1 0 0 8') },
  { id: 'vine', name: '藤蔓', ms: 1200, layers: ['Ⅱ'], icon: P('M8 3.5c6 4-6 8 0 12s0 5 0 5M8 8l4-1M8 13l-4-1M9 17l4 1') },
  { id: 'crack', name: '岩缝', ms: 1200, layers: ['Ⅲ'], icon: P('M7 3.5v6l-2.5 4 3 3-1 4M14 3.5l-2 5 2.5 4-2 8') },
  { id: 'eggs', name: '卵堆', ms: 2400, layers: ['Ⅲ'], icon: P('M8.5 10a2.6 3.4 0 1 1 0 6.8 2.6 3.4 0 0 1 0-6.8zM15 6.5a2.4 3.2 0 1 1 0 6.4 2.4 3.2 0 0 1 0-6.4z') },
  { id: 'wreck', name: '船骸', ms: 2400, layers: ['Ⅲ'], icon: P('M4 15h16l-3 5H7zM12 4v11M12 6l6 4-6 2') },
  { id: 'lotus', name: '荷叶', ms: 1200, layers: ['Ⅳ'], icon: P('M3.5 14a8.5 8.5 0 0 1 17 0zM12 14v6') },
  { id: 'spring', name: '温泉', ms: 2400, layers: ['Ⅳ'], icon: P('M3.5 9c2-2 4.5-2 6.5 0s4.5 2 6.5 0 3.5-1 4 0M3.5 15c2-2 4.5-2 6.5 0s4.5 2 6.5 0') },
  { id: 'bones', name: '骸骨堆', ms: 2400, layers: ['Ⅴ'], icon: P('M6 6a2.2 2.2 0 1 1 3 2v8a2.2 2.2 0 1 1-3 2M18 6a2.2 2.2 0 1 0-3 2v8a2.2 2.2 0 1 0 3 2') },
  { id: 'ruin', name: '废墟', ms: 2400, layers: ['Ⅵ'], icon: P('M4 20V9l4-3v14M14 20V6l6 4v10') },
  { id: 'rift', name: '裂缝', ms: 2400, layers: ['Ⅶ', 'Ⅷ'], icon: P('M11 3.5l2 5-3 4 3 4-2 4M4 20h16') },
];

type Point = {
  depth: number;
  kind: Kind;
  el: HTMLElement;
  x: number;
  looted: boolean;
  busy: boolean;
};

type Chip = {
  depth: number;
  x: number;
  loot: Loot;
  el: HTMLElement;
  revealed: boolean;
};

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

function initField(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  const layer = document.createElement('div');
  layer.className = 'field';
  layer.setAttribute('aria-hidden', 'true');
  stage.append(layer);

  const points: Point[] = [];
  const chips: Chip[] = [];

  // 按层顺着铺：每层每 400~700 米一个点
  for (const info of ABYSS_LAYERS) {
    const kinds = KINDS.filter((k) => k.layers.includes(info.no));
    if (!kinds.length) continue;
    let d = info.from + rand(160, 380);
    while (d < Math.min(info.to, info.to - 80)) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'field-point';
      el.dataset.kind = kind.id;
      el.innerHTML = `<span class="field-point-name">${kind.name}</span><span class="field-point-art">${kind.icon}</span><span class="field-point-bar"><i></i></span>`;
      el.style.left = `${rand(0.4, 0.66) * 100}%`;
      layer.append(el);

      const p: Point = { depth: d, kind, el, x: 0, looted: false, busy: false };
      points.push(p);
      el.addEventListener('click', () => search(p, el));
      d += rand(400, 700);
    }
  }

  /** 点一下：读秒 → 掉东西 */
  function search(p: Point, el: HTMLElement): void {
    if (p.looted || p.busy) return;
    p.busy = true;
    const bar = el.querySelector<HTMLElement>('.field-point-bar > i');
    el.classList.add('is-searching');

    const start = performance.now();
    const tick = (): void => {
      const r = Math.min(1, (performance.now() - start) / p.kind.ms);
      if (bar) bar.style.width = `${Math.round(r * 100)}%`;
      if (r < 1) {
        requestAnimationFrame(tick);
        return;
      }
      p.busy = false;
      p.looted = true;
      el.classList.remove('is-searching');
      el.classList.add('is-empty');
      el.querySelector('.field-point-name')!.textContent = '空了';

      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        spawnChip(p.depth, p.x + (i - (n - 1) / 2) * 116, rollLoot(p.depth));
      }
    };
    requestAnimationFrame(tick);
  }

  /** 地上那件东西：先是个问号，过一会儿自己揭 */
  function spawnChip(depth: number, x: number, loot: Loot): void {
    const el = document.createElement('div');
    el.className = 'field-loot';
    el.dataset.hidden = '1';
    el.style.left = `${x}px`;
    el.innerHTML = `<span class="field-loot-art">？</span>`;
    layer.append(el);

    const chip: Chip = { depth, x, loot, el, revealed: false };
    chips.push(chip);

    window.setTimeout(() => {
      chip.revealed = true;
      el.removeAttribute('data-hidden');
      el.dataset.tier = String(loot.tier);
      el.style.setProperty('--tier', TIER_COLOR[loot.tier]);
      el.title = loot.unknown ? `？？？（${loot.w}×${loot.h}）` : `${loot.name}（${loot.rank}）· ${money(loot.price)}`;
      // 名字 + 占几格 + 值多少：拖之前就该看得见，不然只能瞎背
      el.innerHTML =
        `<span class="field-loot-art"><svg viewBox="0 0 24 24">${loot.icon}</svg></span>` +
        `<span class="field-loot-main">` +
        `<b class="field-loot-name">${loot.unknown ? '？？？' : loot.name}</b>` +
        `<span class="field-loot-meta"><i>${loot.w}×${loot.h}</i><b>${loot.unknown ? '？' : money(loot.price)}</b></span>` +
        `</span>`;
      // 大件稍微长一点，一眼看出是件大东西
      el.style.setProperty('--bulk', String(loot.w * loot.h));
      el.classList.add('is-pop');
      window.setTimeout(() => el.classList.remove('is-pop'), 520);
    }, 380 + Math.random() * 240);

    bindDrag(chip);
  }

  /** 拖进背包；拖到别处就放回去 */
  function bindDrag(chip: Chip): void {
    let dragging = false;
    let sx = 0;
    let sy = 0;
    let moved = false;

    chip.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      chip.el.setPointerCapture(e.pointerId);
      chip.el.classList.add('is-dragging');
      sx = e.clientX;
      sy = e.clientY;
      dragging = true;
      moved = false;
    });

    chip.el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 5) return;
      moved = true;
      chip.el.style.transform = `translate3d(${e.clientX - sx}px, ${e.clientY - sy}px, 0)`;
    });

    const up = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      chip.el.classList.remove('is-dragging');
      chip.el.style.transform = '';

      // 点一下（没拖动）= 看这件东西是什么
      if (!moved) {
        window.dispatchEvent(new CustomEvent('loot:inspect', { detail: { loot: chip.loot } }));
        return;
      }

      if (bag?.isOver(e.clientX, e.clientY)) {
        if (bag.add(chip.loot, { x: e.clientX, y: e.clientY })) {
          chip.el.remove();
          chips.splice(chips.indexOf(chip), 1);
        }
        return;
      }
      // 没扔进背包：放回原处
    };

    chip.el.addEventListener('pointerup', up);
    chip.el.addEventListener('pointercancel', up);
  }

  // ---------------------------------------------------------------- 每帧跟着滚
  let raf = 0;
  let inStation = false;
  const place = (): void => {
    raf = requestAnimationFrame(place);
    const h = window.innerHeight;
    const w = layer.clientWidth;
    const now = window.scrollY;

    // 进站了就把路上的东西收起来——站里那几张牌才是要点的东西
    const open = !!document.querySelector('.station.is-open');
    if (open !== inStation) {
      inStation = open;
      layer.classList.toggle('field--hidden', open);
    }

    for (const p of points) {
      const dy = scrollYForDepth(p.depth) - now;
      const visible = Math.abs(dy) < h * 0.75;
      if (!visible) {
        if (p.el.style.display !== 'none') p.el.style.display = 'none';
        continue;
      }
      if (p.el.style.display === 'none') p.el.style.display = '';
      p.el.style.top = `${h * 0.5 + dy}px`;
      // 远处淡、近处实，但别淡到看不见
      p.el.style.opacity = String((0.42 + 0.58 * Math.max(0, 1 - Math.abs(dy) / (h * 0.7))).toFixed(3));
      if (!p.x) p.x = (parseFloat(p.el.style.left) / 100) * w;
    }

    for (const c of chips) {
      const dy = scrollYForDepth(c.depth) - now;
      // 往下让一点：别正好压在已经空了的搜索点上
      c.el.style.top = `${h * 0.5 + dy + 38}px`;
    }
  };
  raf = requestAnimationFrame(place);

  // 回奥斯：清空地上的东西和搜过的点
  window.addEventListener('dive:surface', reset);
  window.addEventListener('dive:respawn', reset);
  function reset(): void {
    for (const c of chips) c.el.remove();
    chips.length = 0;
    for (const p of points) {
      if (!p.looted) continue;
      p.looted = false;
      p.busy = false;
      p.el.classList.remove('is-empty', 'is-searching');
      p.el.querySelector('.field-point-name')!.textContent = p.kind.name;
      const bar = p.el.querySelector<HTMLElement>('.field-point-bar > i');
      if (bar) bar.style.width = '0%';
      // 深度重新洗一次，别让每次都是同一批位置
      p.depth = p.depth;
    }
  }
}

initField();
