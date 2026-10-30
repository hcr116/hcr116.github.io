/**
 * 节点地图
 * ------------------------------------------------------------------
 * 一层 = 8 行，每行 2~3 个节点，只能往下选一个（杀戮尖塔那张图）。
 * 起点在上、楼梯在底；**楼梯是双向的**：下去了还能爬回来，但要吃「上层惩罚」。
 *
 * 氧气是唯一的时钟：进一个节点烧一次，越深越贵；撤离也要付。
 * 地图每局重新生成。
 */

import { ABYSS_LAYERS } from '../../consts';
import { run, burnOxygen, addOxygen, damage, heal, resetRun, earn } from './run';
import { toast, setFloorLabel, initHud } from './hud';
import { meta, visionRows } from './meta';
import { openFight } from './fight';
import { beastsAt } from './beasts';
import { resolveNode, showGround } from './node';
import { showSettle } from './settle';
import { bag } from './bag';
import { sellOf, money, type Loot } from './loot';

export type NodeKind = 'start' | 'fight' | 'elite' | 'treasure' | 'shop' | 'supply' | 'event' | 'stairs';

export type MNode = {
  id: string;
  row: number;
  col: number;
  kind: NodeKind;
  /** 这一格处理完了 */
  done: boolean;
};

export type Edge = { from: string; to: string };

export type FloorMap = {
  floor: number;
  nodes: MNode[];
  edges: Edge[];
  /** 走过的节点 id（先走的在前） */
  path: string[];
  currentId: string;
};

const ROWS = 8;
const COLS = 3;

const KIND_LABEL: Record<NodeKind, string> = {
  start: '入口',
  fight: '战斗',
  elite: '精英',
  treasure: '宝物',
  shop: '商店',
  supply: '补给',
  event: '事件',
  stairs: '楼梯',
};

const KIND_GLYPH: Record<NodeKind, string> = {
  start: '●',
  fight: '✕',
  elite: '☠',
  treasure: '◆',
  shop: '¤',
  supply: '＋',
  event: '✦',
  stairs: '▼',
};

let seq = 0;
const uid = (): string => `n${++seq}`;

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 一行里挑 2~3 个列，保证能连上 */
function rowCols(): number[] {
  const n = Math.random() < 0.3 ? 2 : 3;
  const all = [0, 1, 2];
  if (n === 3) return all;
  return Math.random() < 0.5 ? [0, 2] : Math.random() < 0.5 ? [0, 1] : [1, 2];
}

function pickKind(row: number): NodeKind {
  // 前几行别放狠东西：第一行固定一场普通战斗，四行以下不放大怪
  if (row === 1) return 'fight';
  // 兜里没钱就别给商店：那等于白走一格（第一局开局最容易碰上的坑）
  const broke = money() < 60;
  let kind: NodeKind;
  const roll = Math.random();
  if (row < 4) {
    if (roll < 0.44) kind = 'fight';
    else if (roll < 0.62) kind = 'event';
    else if (roll < 0.78) kind = 'supply';
    else if (roll < 0.92) kind = 'treasure';
    else kind = 'shop';
  } else if (roll < 0.32) kind = 'fight';
  else if (roll < 0.46) kind = 'event';
  else if (roll < 0.58) kind = 'supply';
  else if (roll < 0.7) kind = 'treasure';
  else if (roll < 0.86) kind = 'elite';
  else kind = 'shop';
  if (kind === 'shop' && broke) return row < 4 ? 'treasure' : 'event';
  return kind;
}

export function makeFloor(floor: number): FloorMap {
  const nodes: MNode[] = [];
  const edges: Edge[] = [];

  const start: MNode = { id: uid(), row: 0, col: 1, kind: 'start', done: false };
  nodes.push(start);

  const byRow: MNode[][] = [[start]];
  for (let r = 1; r < ROWS; r++) {
    const cols = rowCols();
    const row = cols.map((c) => ({ id: uid(), row: r, col: c, kind: pickKind(r), done: false }));
    byRow.push(row);
    nodes.push(...row);
  }
  const stairs: MNode = { id: uid(), row: ROWS, col: 1, kind: 'stairs', done: false };
  byRow.push([stairs]);
  nodes.push(stairs);

  // 连线：相邻两行，列差 ≤1 就拉一条；每行至少有一个子节点
  for (let r = 0; r < byRow.length - 1; r++) {
    const from = byRow[r];
    const to = byRow[r + 1];
    for (const a of from) {
      const targets = to.filter((b) => Math.abs(b.col - a.col) <= 1);
      const list = targets.length ? targets : [to.reduce((best, b) => (Math.abs(b.col - a.col) < Math.abs(best.col - a.col) ? b : best), to[0])];
      for (const b of list) edges.push({ from: a.id, to: b.id });
    }
    // 下一行每个节点至少有一条入边
    for (const b of to) {
      if (!edges.some((e) => e.to === b.id)) {
        const parent = from.reduce((best, a) => (Math.abs(a.col - b.col) < Math.abs(best.col - b.col) ? a : best), from[0]);
        edges.push({ from: parent.id, to: b.id });
      }
    }
  }

  return { floor, nodes, edges, path: [start.id], currentId: start.id };
}

// ---------------------------------------------------------------- 状态
const floors: FloorMap[] = [];
let map: FloorMap;
let root: HTMLElement | null = null;

const nodeById = (id: string): MNode | undefined => map.nodes.find((n) => n.id === id);
const current = (): MNode => nodeById(map.currentId) ?? map.nodes[0];

export const floorLayer = (floor: number): string => ABYSS_LAYERS[Math.min(floor - 1, ABYSS_LAYERS.length - 1)].no;

/** 进一个节点要烧多少氧气（越深越贵） */
const nodeCost = (row: number): number => 3 + Math.round(row * 1.4 + (map.floor - 1) * 2);

/** 撤离要烧多少：回程要一层层爬上去，越深越贵 */
const extractCost = (): number => 2 + (run.floor - 1) * 12 + Math.round((map.path.length - 1) * 1.5);

// ---------------------------------------------------------------- 画
const W = 1280;
const ROW_GAP = 66;
const COL_GAP = 132;
const TOP = 40;

function svgPath(): string {
  const w = root?.clientWidth ?? W;
  const cx = w / 2;
  const pos = (n: MNode): [number, number] => [cx + (n.col - 1) * COL_GAP, TOP + n.row * ROW_GAP];
  return map.edges
    .map((e) => {
      const a = nodeById(e.from);
      const b = nodeById(e.to);
      if (!a || !b) return '';
      const [x1, y1] = pos(a);
      const [x2, y2] = pos(b);
      const mid = (y1 + y2) / 2;
      const active = map.path.includes(e.from) && map.path.includes(e.to);
      return `<path d="M${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}" class="map-edge${active ? ' is-active' : ''}"/>`;
    })
    .join('');
}

function render(): void {
  if (!root) return;
  const w = root.clientWidth || W;
  const cx = w / 2;
  const pos = (n: MNode): [number, number] => [cx + (n.col - 1) * COL_GAP, TOP + n.row * ROW_GAP];

  const cur = current();
  const reachable = new Set(map.edges.filter((e) => e.from === cur.id).map((e) => e.to));
  const visibleTo = cur.row + visionRows();

  const nodesHtml = map.nodes
    .map((n) => {
      const [x, y] = pos(n);
      const hidden = n.row > visibleTo;
      const kind: NodeKind | 'unknown' = hidden ? 'unknown' : n.kind;
      const cls = [
        'map-node',
        `map-node--${kind}`,
        hidden ? 'map-node--hidden' : '',
        n.id === cur.id ? 'is-here' : '',
        reachable.has(n.id) ? 'is-next' : '',
        n.done ? 'is-done' : '',
        map.path.includes(n.id) ? 'is-walked' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const label = hidden ? '' : KIND_LABEL[n.kind];
      const glyph = hidden ? '？' : KIND_GLYPH[n.kind];
      return (
        `<button class="${cls}" type="button" data-node="${n.id}" style="left:${x}px;top:${y}px">` +
        `<b class="map-glyph">${glyph}</b>` +
        `<span class="map-label">${label}</span>` +
        `</button>`
      );
    })
    .join('');

  const height = TOP + ROWS * ROW_GAP + 160;
  const poor = run.oxygen < extractCost();

  root.innerHTML =
    `<svg class="map-edges" width="${w}" height="${height}" aria-hidden="true">${svgPath()}</svg>` +
    `<div class="map-nodes">${nodesHtml}</div>` +
    `<div class="map-foot">` +
    `<button class="map-extract" type="button" data-extract${poor ? ' data-off="1"' : ''}>` +
    `撤 · 烧 ${extractCost()} 氧气` +
    `</button>` +
    `<span class="map-note">已走 ${map.path.length - 1} 行${poor ? ' · 氧气不够回去' : ''}</span>` +
    `</div>`;

  root.style.height = `${height}px`;
  setFloorLabel(`${ABYSS_LAYERS[Math.min(run.floor - 1, ABYSS_LAYERS.length - 1)].no} · ${ABYSS_LAYERS[Math.min(run.floor - 1, ABYSS_LAYERS.length - 1)].name}`);
}

// ---------------------------------------------------------------- 走
function startFloor(floor: number): void {
  run.floor = floor;
  map = makeFloor(floor);
  floors[floor - 1] = map;
  render();
}

function enterNode(node: MNode): void {
  if (node.done) return;
  burnOxygen(nodeCost(node.row));
  node.done = true;
  map.path.push(node.id);
  map.currentId = node.id;
  render();

  if (node.kind === 'fight' || node.kind === 'elite') {
    const pool = beastsAt(floorLayer(run.floor));
    const kind = node.kind === 'elite' ? pool[pool.length - 1] : pool[0];
    openFight({ kind, hp: kind.hp, maxHp: kind.hp, uid: node.id }, (out) => {
      if (out.win) {
        node.done = true;
        render();
      }
    });
    return;
  }

  if (node.kind === 'stairs') {
    showStairs();
    return;
  }

  resolveNode(node.kind, run.floor, () => render());
}

function goDown(): void {
  const next = run.floor + 1;
  startFloor(next);
  // 往下是「祝福」：换一层能重新换气，伤口也缓一点 —— 不然深潜永远是自杀
  const refill = Math.round(run.oxygenMax * 0.6);
  if (run.oxygen < refill) {
    addOxygen(refill - run.oxygen);
    heal(Math.round(run.max * 0.25));
    toast(`下了第 ${next} 层 · 换气到 ${run.oxygen}`);
  } else {
    toast(`下了第 ${next} 层`);
  }
}

/** 爬回上一层：吃上层惩罚 */
function goUp(): void {
  if (run.floor <= 1) {
    toast('上面就是地面了');
    return;
  }
  const cost = 6 + run.floor * 5;
  if (run.oxygen < cost) {
    toast(`氧气不够爬上去（要 ${cost}）`);
    return;
  }
  burnOxygen(cost);
  const prev = floors[run.floor - 2];
  run.floor -= 1;
  if (prev) {
    map = prev;
    // 回到上一层的楼梯口
    const stairs = map.nodes.find((n) => n.kind === 'stairs');
    if (stairs) map.currentId = stairs.id;
    render();
  } else {
    startFloor(run.floor);
  }
  toast(`爬回第 ${run.floor} 层 · 烧了 ${cost} 氧气`);
}

// ---------------------------------------------------------------- 撤离
function extract(): void {
  const cost = extractCost();
  if (run.oxygen < cost) {
    // 没气回去：死在回程
    toast('氧气不够回去');
    damage(9999);
    return;
  }
  burnOxygen(cost);

  // 回程掷一次「路上出了什么事」，越深越容易出事
  const risk = 0.16 + (run.floor - 1) * 0.05;
  const roll = Math.random();
  if (roll < risk * 0.6) {
    damage(8 + run.floor * 4);
    toast('回程塌了一段');
  } else if (roll < risk) {
    damage(4 + run.floor * 2);
    toast('被什么东西咬了一口');
  } else {
    toast('一路没出什么事');
  }
  if (!run.alive) return;

  // 结算：把包里的东西卖掉
  const items = bag?.takeAll() ?? [];
  const sellable = items.filter((it) => !it.provision);
  const total = sellable.reduce((sum, it) => sum + sellOf(it), 0);
  if (total > 0) earn(total);
  showSettle(sellable, total, items.length - sellable.length, () => {
    resetRun();
    startFloor(1);
    // 回到地面：这才是花钱升级的地方
    showGround(() => render());
  });
}

// ---------------------------------------------------------------- 入口
export function initMap(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  root = document.createElement('div');
  root.className = 'map';
  root.dataset.abyssMap = '';
  // 挂在页面给的宿主里（那层有 z-index，直接挂 stage 会被它盖住）
  const host = stage.querySelector<HTMLElement>('[data-abyss-map-host]');
  (host ?? stage).append(root);

  startFloor(1);

  root.addEventListener('click', (event) => {
    const el = event.target as HTMLElement;

    if (el.closest('[data-extract]')) {
      extract();
      return;
    }

    const btn = el.closest<HTMLElement>('[data-node]');
    if (!btn) return;
    const node = nodeById(btn.dataset.node ?? '');
    if (!node) return;

    const cur = current();
    if (node.id === cur.id) {
      if (node.kind === 'stairs') showStairs();
      return;
    }
    if (!map.edges.some((e) => e.from === cur.id && e.to === node.id)) {
      toast('这条路不通');
      return;
    }
    enterNode(node);
  });

  window.addEventListener('abyss:respawn', () => {
    startFloor(1);
  });
  window.addEventListener('resize', render);

  // 调试用
  (window as unknown as { __map: () => unknown }).__map = () => ({
    floor: run.floor,
    row: current().row,
    kind: current().kind,
    path: map.path.length - 1,
    nodes: map.nodes.length,
    oxygen: Math.round(run.oxygen),
  });
  (window as unknown as { __mapGo: (row: number, col: number) => void }).__mapGo = (row, col) => {
    const n = map.nodes.find((x) => x.row === row && x.col === col);
    if (n) enterNode(n);
  };
  (window as unknown as { __extract: () => void }).__extract = () => extract();
}

// ---------------------------------------------------------------- 楼梯面板
function showStairs(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;
  document.querySelector('[data-stairs]')?.remove();

  const veil = document.createElement('div');
  veil.className = 'panel';
  veil.dataset.stairs = '';
  veil.innerHTML =
    `<div class="panel-card">` +
    `<p class="panel-eyebrow">第 ${run.floor} 层 · 楼梯</p>` +
    `<h2 class="panel-title">往下，还是往上</h2>` +
    `<p class="panel-text">再往下一层东西更好，回来也更贵。</p>` +
    `<div class="panel-actions">` +
    `<button class="panel-btn panel-btn--ghost" type="button" data-up>爬回上一层（烧 ${6 + run.floor * 5} 氧气）</button>` +
    `<button class="panel-btn" type="button" data-down>继续往下</button>` +
    `</div>` +
    `<button class="panel-close" type="button" data-close>先站这儿</button>` +
    `</div>`;
  stage.append(veil);
  requestAnimationFrame(() => veil.classList.add('is-on'));

  veil.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-close]') || el === veil) {
  veil.remove();
      return;
    }
    if (el.closest('[data-down]')) {
      veil.remove();
      goDown();
      return;
    }
    if (el.closest('[data-up]')) {
      veil.remove();
      goUp();
    }
  });
}

export const mapApi = {
  get map(): FloorMap {
    return map;
  },
  extract,
  goDown,
  goUp,
  meta,
};

// ---------------------------------------------------------------- 起
initHud();
initMap();

// 调试用
(window as unknown as { __bagSize?: unknown }).__bagSize = bag?.size?.();
