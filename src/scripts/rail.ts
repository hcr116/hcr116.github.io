/**
 * 横排频道（rail）的标准逻辑
 * ------------------------------------------------------------------
 * 从 /works/ai/ 抽出来，P1 时扩展到支持「两级轨道」（文章页）。
 *
 * 它负责：
 *   · 方块选中态（.is-on）切换
 *   · 选中开机 / 失去选中关机（crt-tv 的 powerOn / powerOff）
 *   · 悬停 / 聚焦即选中（用事件委托，方块动态增减也行）
 *   · ← → 移动、Enter 触发、Esc 交给页面
 *
 * 它不负责（页面自己决定）：
 *   · 大标题写什么            → onSelect
 *   · 轨道要不要跟着平移        → slide 回调
 *   · Enter 具体做什么          → onEnter
 *   · 锁定条目拦截              → 页面自己接 initLocked
 *
 * 想改交互手感？改这里，所有接入页面一起变。
 * 想给某页特例？传不同的 options，别复制代码。
 */

import { powerOn, powerOff } from './crt-tv';

export type RailOptions = {
  /** 装方块的容器（只用来做事件委托，可以比实际轨道大一层） */
  track?: string | HTMLElement | null;
  /** 方块选择器 */
  tile?: string;
  /** 动态取方块列表（两级页面用这个；不传就用 track 里初次查到的） */
  getTiles?: () => HTMLElement[];
  /** 首尾循环，默认 true */
  wrap?: boolean;
  /** 选中变化时调用（初始化也会调一次） */
  onSelect?: (tile: HTMLElement, index: number, previous: number) => void;
  /** 选中之后跟着跑的副作用，比如轨道平移 */
  slide?: (tile: HTMLElement) => void;
  /** Enter 做什么；不传就点一下当前方块 */
  onEnter?: () => void;
  /** Esc 做什么；不传就不管 */
  onEscape?: () => void;
  /** 键盘开关，默认全开 */
  keys?: false | { enter?: boolean; escape?: boolean };
  /** 初始选第几块；null = 先不选 */
  initial?: number | null;
};

export type RailHandle = {
  readonly index: number;
  readonly tiles: HTMLElement[];
  select: (i: number, force?: boolean) => void;
  selectFirst: () => void;
  /** 换了一层轨道之后调：重新取方块、回到第 0 块 */
  refresh: () => void;
};

export function initRail(options: RailOptions = {}): RailHandle {
  const {
    track = document.querySelector<HTMLElement>('[data-track]'),
    tile: tileSel = '[data-tile]',
    getTiles,
    wrap = true,
    onSelect,
    slide,
    onEnter,
    onEscape,
    keys = {},
    initial = 0,
  } = options;

  const container =
    typeof track === 'string' ? document.querySelector<HTMLElement>(track) : track ?? null;

  const readTiles = (): HTMLElement[] => {
    if (getTiles) return getTiles().filter((t) => t.isConnected);
    return container ? [...container.querySelectorAll<HTMLElement>(tileSel)] : [];
  };

  let tiles = readTiles();
  let current = -1;

  const select = (i: number, force = false): void => {
    tiles = readTiles();
    if (!tiles.length) return;

    const next = wrap
      ? ((i % tiles.length) + tiles.length) % tiles.length
      : Math.max(0, Math.min(tiles.length - 1, i));

    const tile = tiles[next];
    if (!tile || !tile.isConnected) return;
    if (!force && next === current) return;

    const previous = current;
    current = next;

    tiles.forEach((t, k) => {
      const was = t.classList.contains('is-on');
      const now = k === current;
      t.classList.toggle('is-on', now);
      if (was && !now) powerOff(t);
      if (!was && now) powerOn(t);
    });

    onSelect?.(tile, current, previous);
    slide?.(tile);
  };

  const selectFirst = (): void => {
    if (readTiles()[0]) select(0, true);
  };

  /* 事件委托：方块是动态的时候也不用重新绑 */
  if (container) {
    container.addEventListener('mouseover', (event) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(tileSel);
      if (!el || !tiles.includes(el)) return;
      const i = tiles.indexOf(el);
      if (i >= 0) select(i);
    });
    container.addEventListener('focusin', (event) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(tileSel);
      if (!el || !tiles.includes(el)) return;
      const i = tiles.indexOf(el);
      if (i >= 0) select(i);
    });
  }

  if (keys !== false) {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        select(current + 1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        select(current - 1);
      }
      if (keys.enter !== false && event.key === 'Enter') {
        if (onEnter) onEnter();
        else tiles[current]?.click();
      }
      if (keys.escape !== false && event.key === 'Escape' && onEscape) {
        onEscape();
      }
    });
  }

  if (initial !== null) selectFirst();

  return {
    get index() {
      return current;
    },
    get tiles() {
      return tiles;
    },
    select,
    selectFirst,
    refresh: () => {
      current = -1;
      tiles = readTiles();
      if (tiles[0]) select(0, true);
    },
  };
}
