/**
 * 竖井
 * ------------------------------------------------------------------
 * 世界从「一条滚动带」变成「一条往下的格子走廊」：
 *
 *   · 走廊 3 格宽，左右是空的（崖外）
 *   · 每 6 行左右掉一块石头，逼你左右挪一下
 *   · 走到哨站那一段，走廊张开成 7 格宽的「厅」
 *
 * 一格 = 20 米，所以 20,000 米 = 1,000 行。一行 60px，一屏大约看得见 14 行。
 *
 * **深度这条线没变**：走一格就把页面滚到「这一格对应的深度」，
 * 于是饥渴、上浮扣血、哨站、结算全都不用改，照旧吃 dive:tick。
 * 换句话说：这一层只换「世界怎么表现」，换掉的是滚动那张皮。
 *
 * 视野和活物还没接（第二步、第三步）。
 */

import { ABYSS_MAX_DEPTH } from '../../consts';
import { STATIONS, scrollYForDepth } from './stations';
import { gate } from './virtual-scroll';
import { depthFromSank } from './metrics';
import { toast } from './supply';

const CELL = 60;
/** 一格多少米 */
const METERS_PER_ROW = 20;
const MAX_ROW = Math.floor(ABYSS_MAX_DEPTH / METERS_PER_ROW);
const LANES = 7;
const CENTER_LANE = 3;
/** 常态走廊住在哪几号格道 */
const CORRIDOR_LANES = [2, 3, 4];
/** 厅：以哨站那一行为中心，上下各张开几行 */
const HALL_RADIUS = 4;
/** 玩家落在屏幕高度的哪一档 */
const ANCHOR = 0.58;

const RENDER_BACK = 9;
const RENDER_AHEAD = 13;

/** 确定性的伪随机：同一行永远同一个结果，刷新也不会变 */
const hash = (n: number): number => {
  let x = Math.imul(n | 0, 374761393) + 668265263;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

const stationRows = new Set(STATIONS.map((s) => Math.round(s.depth / METERS_PER_ROW)));

function isHall(row: number): boolean {
  for (const r of stationRows) if (Math.abs(row - r) <= HALL_RADIUS) return true;
  return false;
}

function lanesOf(row: number): number[] {
  if (isHall(row)) return Array.from({ length: LANES }, (_, i) => i);
  return CORRIDOR_LANES;
}

// ---------------------------------------------------------------- 走廊长什么样
const blocked = new Map<number, Set<number>>();

const isBlocked = (row: number, lane: number): boolean => !!blocked.get(row)?.has(lane);

const blockAt = (row: number, lane: number): void => {
  const set = blocked.get(row) ?? new Set<number>();
  set.add(lane);
  blocked.set(row, set);
};

/** 这一行还剩几条能走的道（只在走廊那三条里数） */
const openCorridor = (row: number): number => CORRIDOR_LANES.filter((l) => !isBlocked(row, l)).length;

for (let r = 12; r < MAX_ROW - 6; r++) {
  if (hash(r * 1.7) > 0.17) continue;
  if (isHall(r)) continue; // 厅里不堆石头，那里留着放东西
  const lanes = lanesOf(r);
  const lane = lanes[Math.floor(hash(r * 9.13) * lanes.length)];
  const tall = hash(r * 4.31) < 0.28 ? 2 : 1;
  for (let i = 0; i < tall; i++) {
    const row = r + i;
    // 走廊里任何一行都要留得下一条缝
    if (openCorridor(row) <= 1 && isBlocked(row, lane) === false) break;
    blockAt(row, lane);
  }
}

const walkable = (row: number, lane: number): boolean => {
  if (row < 0 || row > MAX_ROW) return false;
  if (!lanesOf(row).includes(lane)) return false;
  return !isBlocked(row, lane);
};

/**
 * 保证「一路走得下去」。
 *
 * 石头是逐行随机撒的，单看每一行都留了缝，但连起来可能凑出死胡同
 * （比如 12 行只剩 2 号道、13 行只剩 4 号道，中间 3 号是石头，横着过不去）。
 * 这里从头往下走一遍：只要某一行从上面哪条道都够不着，就拆掉挡在跟前的那块石头。
 */
{
  const near = (reach: Set<number>, l: number): boolean =>
    reach.has(l) || reach.has(l - 1) || reach.has(l + 1);

  let reach = new Set(lanesOf(0).filter((l) => !isBlocked(0, l)));
  for (let r = 1; r <= MAX_ROW; r++) {
    const open = lanesOf(r).filter((l) => !isBlocked(r, l));
    const next = new Set(open.filter((l) => near(reach, l)));
    if (next.size === 0) {
      // 拆掉一块离上面最近、又挡在道上的石头
      const cand = lanesOf(r).filter((l) => near(reach, l) && isBlocked(r, l));
      for (const l of cand) {
        blocked.get(r)?.delete(l);
        next.add(l);
        break;
      }
    }
    reach = next;
  }
}

// ---------------------------------------------------------------- 画
function initShaft(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  const world = document.createElement('div');
  world.className = 'shaft';
  world.innerHTML =
    `<div class="shaft-world">` +
    `<div class="shaft-cells"></div>` +
    `<div class="shaft-self" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">` +
    `<circle cx="12" cy="6.5" r="2.6"/><path d="M12 9.4v5.2M12 14.6l-2.6 4M12 14.6l2.6 4M7.6 11h8.8"/>` +
    `</svg>` +
    `<b class="shaft-self-label">你</b>` +
    `</div>` +
    `</div>`;
  stage.append(world);

  const worldEl = world.querySelector<HTMLElement>('.shaft-world') as HTMLElement;
  const cells = world.querySelector<HTMLElement>('.shaft-cells') as HTMLElement;
  const me = world.querySelector<HTMLElement>('.shaft-self') as HTMLElement;

  let row = 0;
  let lane = CENTER_LANE;

  const cellX = (l: number): number => (l - CENTER_LANE) * CELL;
  const cellY = (r: number): number => r * CELL;

  const render = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const originX = w / 2 - CELL / 2;
    const originY = h * ANCHOR - CELL / 2;

    const from = Math.max(0, row - RENDER_BACK);
    const to = Math.min(MAX_ROW, row + RENDER_AHEAD);

    let html = '';
    for (let r = from; r <= to; r++) {
      for (const l of lanesOf(r)) {
        const wall = isBlocked(r, l);
        html +=
          `<span class="shaft-cell${wall ? ' is-rock' : ''}" style="left:${cellX(l)}px;top:${cellY(r)}px"></span>`;
      }
    }
    cells.innerHTML = html;
    worldEl.style.transform = `translate3d(${originX}px, ${originY - row * CELL}px, 0)`;

    me.style.transform = `translate3d(${cellX(lane)}px, ${cellY(row)}px, 0)`;
    me.dataset.hall = isHall(row) ? '1' : '0';

    // 一开始那几块记录文字压在这条走廊上很碍事，走起来就收掉
    stage.dataset.walked = row > 2 ? '1' : '0';
  };

  // ---------------------------------------------------------------- 走
  const overlays = (): boolean =>
    !!document.querySelector(
      '.station.is-open, [data-inspect], [data-prep], [data-settle], [data-fight], [data-death]',
    );

  const syncDepth = (): void => {
    gate.warp(scrollYForDepth(row * METERS_PER_ROW));
  };

  const step = (dRow: number, dLane: number): void => {
    // 上下走：正前方是石头就自动往旁边让一格（读起来像绕过一块石头）
    if (dRow !== 0) {
      const nr = row + dRow;
      if (walkable(nr, lane)) {
        row = nr;
        render();
        syncDepth();
        return;
      }
      for (const d of [-1, 1]) {
        if (walkable(nr, lane + d)) {
          row = nr;
          lane += d;
          render();
          syncDepth();
          return;
        }
      }
      render();
      toast(dRow > 0 ? '前面堵死了' : '后面堵死了');
      return;
    }

    const nl = lane + dLane;
    if (!walkable(row, nl)) {
      render();
      toast('旁边是岩壁');
      return;
    }
    lane = nl;
    render();
    syncDepth();
  };

  window.addEventListener(
    'wheel',
    (event) => {
      if (overlays()) return;
      const dy = (event as WheelEvent).deltaY;
      if (Math.abs(dy) < 3) return;
      event.preventDefault();
      event.stopPropagation();
      step(dy > 0 ? 1 : -1, 0);
    },
    { passive: false, capture: true },
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (overlays()) return;
      const k = (event as KeyboardEvent).key.toLowerCase();
      const map: Record<string, [number, number]> = {
        arrowdown: [1, 0],
        s: [1, 0],
        arrowup: [-1, 0],
        w: [-1, 0],
        arrowleft: [0, -1],
        a: [0, -1],
        arrowright: [0, 1],
        d: [0, 1],
      };
      const move = map[k];
      if (!move) return;
      event.preventDefault();
      event.stopPropagation();
      step(move[0], move[1]);
    },
    { capture: true },
  );

  // 别处把深度改了（下潜口蹬离、撤离、复活）——竖井跟着挪过去
  window.addEventListener('dive:tick', (event) => {
    const sank = (event as CustomEvent<{ sank: number }>).detail?.sank ?? 0;
    const depth = depthFromSank(sank);
    if (Math.abs(depth - row * METERS_PER_ROW) < 30) return;
    row = Math.max(0, Math.min(MAX_ROW, Math.round(depth / METERS_PER_ROW)));
    if (!walkable(row, lane)) {
      const tryLanes = [lane, lane - 1, lane + 1, lane - 2, lane + 2, CENTER_LANE];
      lane = tryLanes.find((l) => walkable(row, l)) ?? CENTER_LANE;
    }
    render();
  });

  // 从站里出来：往前蹬四步（对应原来的「多推一截」），免得一出站又站在站门口
  window.addEventListener('dive:station-close', () => {
    window.setTimeout(() => {
      for (let i = 0; i < 4; i++) step(1, 0);
    }, 120);
  });

  window.addEventListener('resize', render);

  // 回奥斯：回到水面那一格
  const reset = (): void => {
    row = 0;
    lane = CENTER_LANE;
    render();
  };
  window.addEventListener('dive:surface', () => window.setTimeout(reset, 120));
  window.addEventListener('dive:respawn', () => window.setTimeout(reset, 120));

  render();

  // 调试用
  (window as unknown as { __shaft: () => unknown }).__shaft = () => ({
    row,
    lane,
    depth: row * METERS_PER_ROW,
    hall: isHall(row),
    lanes: lanesOf(row),
    here: walkable(row, lane),
  });
  (window as unknown as { __shaftRows: (a: number, b: number) => unknown }).__shaftRows = (a, b) => {
    const out: { row: number; open: number[] }[] = [];
    for (let r = Math.max(0, a); r <= Math.min(MAX_ROW, b); r++) {
      out.push({ row: r, open: lanesOf(r).filter((l) => !isBlocked(r, l)) });
    }
    return out;
  };
}

initShaft();
