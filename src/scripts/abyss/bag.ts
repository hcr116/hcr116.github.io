/**
 * 背包
 * ------------------------------------------------------------------
 * 左边一块常驻面板：网格 + 贴身袋。
 *
 *   · 物品占地：1×1 到 4×4 都有，地图上一趟背不了几件
 *   · 从地上把东西拖进来 = 收；从格子里拖出去 = 扔
 *   · 贴身袋 2 格，死了也不掉（死亡逻辑还没接，格子先留着）
 *
 * 主格 6×5 = 30 格，可以在奥斯买「背筐」扩容（7×5 / 8×5 / 8×6）。
 * 一件 4×4 就要掉 16 格，装不下第二件大东西。
 * 这是有意的——整理背包本身就该是这段路上要做的决定。
 */

import { TIER_COLOR, money, sellOf, type Loot } from './loot';
import { bagSize } from './meta';

const BASE_COLS = 6;
const BASE_ROWS = 5;
const CELL = 34;
const GAP = 2;
const STEP = CELL + GAP;
const SAFE_SLOTS = 2;
const SIZE_KEY = 'abyss.bag';

/** 背筐：越买越大 */
export const BAG_UPGRADES = [
  { id: 'bag-7x5', name: '背筐', cols: 7, rows: 5, price: 6000, note: '+5 格' },
  { id: 'bag-8x5', name: '加固背筐', cols: 8, rows: 5, price: 14000, note: '+5 格' },
  { id: 'bag-8x6', name: '探窟家的大背筐', cols: 8, rows: 6, price: 30000, note: '+8 格' },
];

type Placed = {
  loot: Loot;
  col: number;
  row: number;
  el: HTMLElement;
  /** 在贴身袋里时的槽位下标 */
  safe?: number;
};

type Bag = {
  el: HTMLElement;
  grid: HTMLElement;
  root: HTMLElement;
  /** 指针在不在面板上（拖拽时用） */
  isOver: (x: number, y: number) => boolean;
  isOverGrid: (x: number, y: number) => boolean;
  /** 从地上收进来：给了坐标就先看贴身袋，否则找第一个空位 */
  add: (loot: Loot, at?: { x: number; y: number }) => boolean;
  /** 面板内部占格 → 像素（给外部画落点高亮用） */
  cellRect: (col: number, row: number, w: number, h: number) => { x: number; y: number; w: number; h: number };
  /** 死在深渊：主格全掉，贴身袋留下。返回掉了几件 */
  dropAll: () => number;
  /** 回到奥斯：整包交出去（结算用），返回所有东西 */
  takeAll: () => Loot[];
  /** 用掉了 / 扔掉了某一件 */
  remove: (uid: string) => void;
  /** 身上有几件这种东西（按 id） */
  countOf: (id: string) => number;
  /** 找一件符合条件的（贴身袋也在内） */
  find: (match: (loot: Loot) => boolean) => Loot | null;
  /** 吃掉/喝掉/用掉一件：先找贴身袋，再找主格 */
  takeOne: (id: string) => boolean;
  /** 扩容（只增不减） */
  grow: (cols: number, rows: number) => void;
  size: () => { cols: number; rows: number };
};

function initBag(): Bag | null {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return null;

  let cols = BASE_COLS;
  let rows = BASE_ROWS;
  // 买了背筐就从大号开始
  {
    const want = bagSize();
    cols = Math.max(cols, want.cols);
    rows = Math.max(rows, want.rows);
  }

  const root = document.createElement('aside');
  root.className = 'bag';
  root.setAttribute('aria-label', '背包');
  // 窄屏默认收起：手机上一块 200px 的背包会把左边那列格子压住
  root.dataset.open = window.innerWidth <= 900 ? '0' : '1';
  root.innerHTML =
    `<div class="bag-head"><span>背包</span><b data-bag-count>0/${cols * rows}</b><b class="bag-value" data-bag-value>0</b></div>` +
    `<div class="bag-safe"><span class="bag-safe-label">贴身袋</span><i class="bag-safe-cell" data-safe="0"></i><i class="bag-safe-cell" data-safe="1"></i></div>` +
    `<div class="bag-grid"></div>`;
  stage.append(root);

  // 点标题栏收起 / 展开
  root.querySelector('.bag-head')?.addEventListener('click', () => {
    root.dataset.open = root.dataset.open === '1' ? '0' : '1';
  });

  const grid = root.querySelector<HTMLElement>('.bag-grid') as HTMLElement;
  const countOut = root.querySelector<HTMLElement>('[data-bag-count]') as HTMLElement;
  const valueOut = root.querySelector<HTMLElement>('[data-bag-value]') as HTMLElement;
  const safeCells = [...root.querySelectorAll<HTMLElement>('.bag-safe-cell')];

  // CSS 里画网格线、画贴身袋要用同一套尺寸，从这传过去
  root.style.setProperty('--bag-cell', `${CELL}px`);
  root.style.setProperty('--bag-step', `${STEP}px`);

  let cells: (string | null)[][] = Array.from({ length: rows }, () => new Array<string>(cols).fill(null));
  const placed = new Map<string, Placed>();
  const safeItems: (Loot | null)[] = new Array(SAFE_SLOTS).fill(null);

  const paintSize = (): void => {
    grid.style.width = `${cols * STEP - GAP}px`;
    grid.style.height = `${rows * STEP - GAP}px`;
    // 面板跟着格子长：7×5 之后 15rem 装不下了
    root.style.width = `${cols * STEP - GAP + 26}px`;
  };

  const fits = (col: number, row: number, w: number, h: number, skip?: string): boolean => {
    if (col < 0 || row < 0 || col + w > cols || row + h > rows) return false;
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        const owner = cells[r][c];
        if (owner && owner !== skip) return false;
      }
    }
    return true;
  };

  const fill = (uid: string, col: number, row: number, w: number, h: number): void => {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) cells[r][c] = uid;
  };

  const clear = (uid: string): void => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (cells[r][c] === uid) cells[r][c] = null;
  };

  const used = (): number => cells.flat().filter(Boolean).length;

  const updateCount = (): void => {
    countOut.textContent = `${used()}/${cols * rows}`;
    // 这一包大概值多少（补给卖不回去，不算）。没鉴定的算不出来，用「+」提醒
    let value = 0;
    let unknown = 0;
    for (const p of placed.values()) {
      if (p.loot.unknown) unknown += 1;
      else value += sellOf(p.loot);
    }
    valueOut.textContent = value > 0 ? `≈${money(value)}${unknown ? '+' : ''}` : unknown ? '≈?' : '';
    // 背包一变就广播：补给 HUD、出发准备面板都靠这个刷新
    window.dispatchEvent(new CustomEvent('bag:changed'));
  };

  const paintItem = (p: Placed): void => {
    const { loot, el } = p;
    const w = loot.w * STEP - GAP;
    const h = loot.h * STEP - GAP;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (p.safe !== undefined) {
      el.style.left = '';
      el.style.top = '';
      el.style.transform = '';
      return;
    }
    el.style.left = '0';
    el.style.top = '0';
    el.style.transform = `translate3d(${p.col * STEP}px, ${p.row * STEP}px, 0)`;
  };

  const makeEl = (loot: Loot): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'bag-item';
    el.dataset.tier = String(loot.tier);
    el.dataset.uid = loot.uid;
    el.title = loot.unknown
      ? `？？？（${loot.w}×${loot.h}）· 带回奥斯才知道是什么`
      : `${loot.name}（${loot.rank}）· ${money(loot.price)}`;
    const hex = loot.provision ? '#7fb2bb' : TIER_COLOR[loot.tier];
    el.style.setProperty('--tier', hex);
    el.style.setProperty('--tier-line', rgba(hex, 0.62));
    el.style.setProperty('--tier-bg', rgba(hex, 0.15));
    el.innerHTML =
      `<span class="bag-item-art"><svg viewBox="0 0 24 24">${loot.icon}</svg></span>` +
      (loot.unknown ? '<span class="bag-item-q">？</span>' : '');
    return el;
  };

  const bindDrag = (p: Placed): void => {
    let dragging = false;
    let moved = false;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;

    p.el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      p.el.setPointerCapture(event.pointerId);
      p.el.classList.add('is-dragging');
      const rect = p.el.getBoundingClientRect();
      sx = event.clientX;
      sy = event.clientY;
      ox = event.clientX - rect.left;
      oy = event.clientY - rect.top;
      dragging = true;
      moved = false;
    });

    /** 从贴身袋里拖出来：第一次真的移动时才把东西挪回主格 */
    const pullOutOfSafe = (): void => {
      if (p.safe === undefined) return;
      safeItems[p.safe] = null;
      p.safe = undefined;
      const spot = firstFit(p.loot.w, p.loot.h);
      if (spot) {
        p.col = spot.col;
        p.row = spot.row;
        fill(p.loot.uid, p.col, p.row, p.loot.w, p.loot.h);
        p.el.remove();
        grid.append(p.el);
        paintItem(p);
      }
    };

    p.el.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const dx = event.clientX - sx;
      const dy = event.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      if (!moved) {
        moved = true;
        pullOutOfSafe();
      }
      const baseX = p.col * STEP;
      const baseY = p.row * STEP;
      p.el.style.transform = `translate3d(${baseX + dx}px, ${baseY + dy}px, 0)`;
      highlight(ox, oy, event.clientX, event.clientY, p);
    });

    const up = (event: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      p.el.classList.remove('is-dragging');
      clearHighlight();

      // 只是点了一下：打开检视面板，别当拖拽处理
      if (!moved) {
        paintItem(p);
        window.dispatchEvent(new CustomEvent('loot:inspect', { detail: { loot: p.loot } }));
        return;
      }

      const px = event.clientX - ox + p.loot.w * STEP * 0.5;
      const py = event.clientY - oy + p.loot.h * STEP * 0.5;

      // 1) 拖进贴身袋
      const safeIdx = safeIndexAt(event.clientX, event.clientY);
      if (safeIdx >= 0 && p.loot.w === 1 && p.loot.h === 1 && !safeItems[safeIdx]) {
        clear(p.loot.uid);
        safeItems[safeIdx] = p.loot;
        p.safe = safeIdx;
        p.el.remove();
        safeCells[safeIdx].append(p.el);
        paintItem(p);
        updateCount();
        return;
      }

      // 2) 拖到网格里：吸附到最近的合法格（但必须真的落在网格上）
      if (isOverGrid(event.clientX, event.clientY)) {
        const cell = cellAt(
          event.clientX - ox + (p.loot.w * STEP) / 2,
          event.clientY - oy + (p.loot.h * STEP) / 2,
          p.loot,
        );
        if (cell && fits(cell.col, cell.row, p.loot.w, p.loot.h, p.loot.uid)) {
          clear(p.loot.uid);
          p.col = cell.col;
          p.row = cell.row;
          fill(p.loot.uid, p.col, p.row, p.loot.w, p.loot.h);
          paintItem(p);
          updateCount();
          return;
        }
        paintItem(p);
        return;
      }

      // 3) 拖出面板 = 扔了（按坐标判断，不能按元素——光标底下就是自己）
      if (!isOver(event.clientX, event.clientY)) {
        clear(p.loot.uid);
        p.el.remove();
        placed.delete(p.loot.uid);
        updateCount();
        return;
      }

      // 4) 放不下：弹回原位
      paintItem(p);
    };

    p.el.addEventListener('pointerup', up);
    p.el.addEventListener('pointercancel', up);
  };

  const cellAt = (px: number, py: number, loot: Loot): { col: number; row: number } | null => {
    const rect = grid.getBoundingClientRect();
    const col = Math.round((px - loot.w * STEP * 0.5 - rect.left) / STEP);
    const row = Math.round((py - loot.h * STEP * 0.5 - rect.top) / STEP);
    return { col: Math.max(0, Math.min(cols - loot.w, col)), row: Math.max(0, Math.min(rows - loot.h, row)) };
  };

  // 落点预览
  const ghost = document.createElement('div');
  ghost.className = 'bag-ghost';
  ghost.hidden = true;
  grid.append(ghost);

  const highlight = (ox: number, oy: number, cx: number, cy: number, p: Placed): void => {
    const ghostX = cx - ox;
    const ghostY = cy - oy;
    const cell = cellAt(ghostX + p.loot.w * STEP * 0.5, ghostY + p.loot.h * STEP * 0.5, p.loot);
    if (!cell) {
      ghost.hidden = true;
      return;
    }
    const ok = fits(cell.col, cell.row, p.loot.w, p.loot.h, p.loot.uid);
    ghost.hidden = false;
    ghost.dataset.ok = ok ? '1' : '0';
    ghost.style.width = `${p.loot.w * STEP - GAP}px`;
    ghost.style.height = `${p.loot.h * STEP - GAP}px`;
    ghost.style.transform = `translate3d(${cell.col * STEP}px, ${cell.row * STEP}px, 0)`;
  };

  const clearHighlight = (): void => {
    ghost.hidden = true;
  };

  const firstFit = (w: number, h: number): { col: number; row: number } | null => {
    for (let r = 0; r <= rows - h; r++) {
      for (let c = 0; c <= cols - w; c++) {
        if (fits(c, r, w, h)) return { col: c, row: r };
      }
    }
    return null;
  };

  const safeIndexAt = (x: number, y: number): number =>
    safeCells.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });

  const add = (loot: Loot, at?: { x: number; y: number }): boolean => {
    if (placed.has(loot.uid)) return true;

    // 先看是不是往贴身袋里塞（1×1 才塞得下）
    if (at && loot.w === 1 && loot.h === 1) {
      const si = safeIndexAt(at.x, at.y);
      if (si >= 0 && !safeItems[si]) {
        const el = makeEl(loot);
        safeCells[si].append(el);
        safeItems[si] = loot;
        const p: Placed = { loot, col: 0, row: 0, el, safe: si };
        placed.set(loot.uid, p);
        paintItem(p);
        bindDrag(p);
        updateCount();
        return true;
      }
    }

    const spot = firstFit(loot.w, loot.h);
    if (!spot) return false;
    const el = makeEl(loot);
    grid.append(el);
    const p: Placed = { loot, col: spot.col, row: spot.row, el };
    placed.set(loot.uid, p);
    fill(loot.uid, spot.col, spot.row, loot.w, loot.h);
    paintItem(p);
    bindDrag(p);
    updateCount();
    return true;
  };

  const isOver = (x: number, y: number): boolean => {
    const r = root.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const isOverGrid = (x: number, y: number): boolean => {
    const r = grid.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const cellRect = (col: number, row: number, w: number, h: number) => {
    const r = grid.getBoundingClientRect();
    return {
      x: r.left + col * STEP,
      y: r.top + row * STEP,
      w: w * STEP - GAP,
      h: h * STEP - GAP,
    };
  };

  updateCount();

  const dropAll = (): number => {
    let n = 0;
    for (const [uid, p] of [...placed]) {
      if (p.safe !== undefined) continue; // 贴身袋不丢
      clear(uid);
      p.el.remove();
      placed.delete(uid);
      n += 1;
    }
    updateCount();
    return n;
  };

  /** 回奥斯：整包交出去。返回的数组按价钱从高到低排 */
  const takeAll = (): Loot[] => {
    const out: Loot[] = [];
    for (const [uid, p] of [...placed]) {
      out.push(p.loot);
      clear(uid);
      p.el.remove();
      placed.delete(uid);
    }
    for (let i = 0; i < safeItems.length; i++) {
      const it = safeItems[i];
      if (it) out.push(it);
      safeItems[i] = null;
    }
    for (const cell of safeCells) cell.replaceChildren();
    updateCount();
    return out.sort((a, b) => b.price - a.price);
  };

  /** 用掉了／扔掉了 */
  const remove = (uid: string): void => {
    const p = placed.get(uid);
    if (!p) return;
    if (p.safe !== undefined) safeItems[p.safe] = null;
    clear(uid);
    p.el.remove();
    placed.delete(uid);
    updateCount();
  };

  /** 身上有几件（按 id） */
  const countOf = (id: string): number => {
    let n = 0;
    for (const p of placed.values()) if (p.loot.id === id) n += 1;
    return n;
  };

  /** 找一件符合条件的（贴身袋也在内） */
  const find = (match: (loot: Loot) => boolean): Loot | null => {
    for (const p of placed.values()) if (match(p.loot)) return p.loot;
    return null;
  };

  /** 消耗一件：先贴身袋，再主格（先找贴身的，那是你留着保命的） */
  const takeOne = (id: string): boolean => {
    for (const p of placed.values()) {
      if (p.loot.id !== id) continue;
      remove(p.loot.uid);
      return true;
    }
    return false;
  };

  /** 扩容：只增不减，已有的东西原地不动 */
  const grow = (nc: number, nr: number): void => {
    const wantCols = Math.min(8, Math.max(BASE_COLS, nc));
    const wantRows = Math.min(6, Math.max(BASE_ROWS, nr));
    if (wantCols <= cols && wantRows <= rows) return;
    cols = Math.max(cols, wantCols);
    rows = Math.max(rows, wantRows);
    const next: (string | null)[][] = Array.from({ length: rows }, (_, r) => {
      const row = new Array<string | null>(cols).fill(null);
      const old = cells[r];
      if (old) for (let c = 0; c < Math.min(cols, old.length); c++) row[c] = old[c];
      return row;
    });
    cells = next;
    paintSize();
    updateCount();
    try {
      localStorage.setItem(SIZE_KEY, `${cols}x${rows}`);
    } catch {
      /* 存不了就只影响这一次 */
    }
  };

  const size = () => ({ cols, rows });

  paintSize();
  updateCount();

  return { el: root, grid, root, isOver, isOverGrid, add, cellRect, dropAll, takeAll, remove, countOf, find, takeOne, grow, size };
}

/** #rrggbb → rgba()。档位只当底色和描边，图标还是石头色 */
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const bag = initBag();

// 调试用：控制台里 __bag() 看背包
if (bag) (window as unknown as { __bag: unknown }).__bag = bag;
