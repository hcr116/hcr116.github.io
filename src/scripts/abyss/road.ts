/**
 * 路上的东西
 * ------------------------------------------------------------------
 * 生物钉在某个深度上，在带子里慢慢横着游。你滚下去就是靠近它。
 *
 *   · 点它 = 开打（魔塔式，见 fight.ts）
 *   · 不理它、直接滚过去 = 挨一口（它的攻击力）
 *
 * 这就是「打还是绕」：绕过去只掉一口血，硬拼可能掉得更多，
 * 但赢了有东西。第一次遇到时**只看得到体型**，危险度是空白的——
 * 因为按原作，深处的评级根本没人写出来过。
 */

import { ABYSS_MAX_DEPTH } from '../../consts';
import { depthFromSank } from './metrics';
import { damage, run } from './run';
import { toast } from './supply';
import { layerNoAt, beastsAt, type BeastInstance, type BeastKind } from './beasts';
import { scrollYForDepth } from './stations';
import { openFight } from './fight';

type RoadBeast = {
  inst: BeastInstance;
  depth: number;
  /** 横向位置（0~1） */
  x: number;
  el: HTMLElement;
  /** 打过了/绕过去了：不再咬人 */
  done: boolean;
  seen: boolean;
};

const SPACING_MIN = 700;
const SPACING_MAX = 1100;
const BITE_FROM = 340; // 从这么深开始有东西

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
let seq = 0;

function makeInstance(kind: BeastKind): BeastInstance {
  seq += 1;
  return { kind, hp: kind.hp, maxHp: kind.hp, uid: `${kind.id}-${seq}` };
}

function spawnList(): RoadBeast[] {
  const out: RoadBeast[] = [];
  let depth = BITE_FROM + rand(0, 260);
  while (depth < ABYSS_MAX_DEPTH - 300) {
    const kinds = beastsAt(layerNoAt(depth));
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    out.push({
      inst: makeInstance(kind),
      depth: Math.round(depth),
      x: rand(0.18, 0.82),
      el: document.createElement('button'),
      done: false,
      seen: false,
    });
    depth += rand(SPACING_MIN, SPACING_MAX);
  }
  return out;
}

function initRoad(): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;

  const layer = document.createElement('div');
  layer.className = 'road';
  layer.setAttribute('aria-hidden', 'false');
  stage.append(layer);

  let beasts = spawnList();

  const paintCard = (b: RoadBeast): void => {
    const k = b.inst.kind;
    b.el.className = 'beast';
    b.el.type = 'button';
    b.el.dataset.size = String(Math.max(k.w, k.h) * 10 + Math.min(k.w, k.h));
    b.el.style.setProperty('--bw', String(k.w));
    b.el.style.setProperty('--bh', String(k.h));
    // 没见过就只给体型；被它咬过、或者跟它打过，才写上名字和危险度
    b.el.innerHTML =
      `<span class="beast-art"><svg viewBox="0 0 24 24">${k.icon}</svg></span>` +
      `<span class="beast-main">` +
      `<b class="beast-name">${b.seen ? k.name : '？？'}</b>` +
      `<span class="beast-meta">${k.w}×${k.h}${b.seen ? ` · ${k.rank}` : ''}</span>` +
      `</span>`;
    b.el.title = b.seen ? `${k.name} · ${k.rank} · 攻 ${k.atk}` : `${k.w}×${k.h} · 不知道是什么`;
    if (!b.el.isConnected) layer.append(b.el);
  };

  const engage = (b: RoadBeast): void => {
    if (b.done) return;
    openFight(b.inst, (out) => {
      b.done = true;
      b.seen = true; // 打过就认得它了
      paintCard(b);
      if (out.win) {
        b.el.classList.add('is-gone');
        window.setTimeout(() => b.el.remove(), 260);
      } else {
        // 退了：这一趟它不会再咬你
        b.el.classList.add('is-passed');
      }
    });
  };

  for (const b of beasts) {
    paintCard(b);
    // 用 pointerdown 而不是 click：卡片每帧都在轻微漂移，
    // 按下和抬起之间它可能已经挪开了，click 会因为「按下/抬起不在同一个元素」而不触发
    b.el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      engage(b);
    });
  }

  // ---------------------------------------------------------------- 每帧摆位置
  let raf = 0;
  const place = (): void => {
    raf = requestAnimationFrame(place);
    const h = window.innerHeight;
    const w = layer.clientWidth;
    const now = window.scrollY;

    for (const b of beasts) {
      if (b.done) continue;
      const dy = scrollYForDepth(b.depth) - now;
      if (Math.abs(dy) > h * 0.9) {
        if (b.el.style.display !== 'none') b.el.style.display = 'none';
        continue;
      }
      if (b.el.style.display === 'none') b.el.style.display = '';
      const sway = Math.sin(performance.now() / 4200 + b.depth) * 0.012;
      b.el.style.left = `${(b.x + sway) * w}px`;
      b.el.style.top = `${h * 0.5 + dy}px`;
      b.el.style.opacity = String((0.55 + 0.45 * Math.max(0, 1 - Math.abs(dy) / (h * 0.9))).toFixed(3));
    }
  };
  raf = requestAnimationFrame(place);

  // ---------------------------------------------------------------- 绕过去就挨一口
  let lastDepth = 0;
  window.addEventListener('dive:tick', (event) => {
    const sank = (event as CustomEvent<{ sank: number }>).detail?.sank ?? 0;
    const depth = depthFromSank(sank);
    const from = lastDepth;
    lastDepth = depth;
    if (!run.alive) return;
    if (depth - from > 900) return; // 瞬移（撤离/复活），不算路过

    for (const b of beasts) {
      if (b.done) continue;
      if (from < b.depth && depth >= b.depth) {
        // 从它旁边过去了：它咬一口
        const atk = b.inst.kind.atk;
        damage(atk);
        b.seen = true; // 被咬过一回，就认得它了
        paintCard(b);
        b.el.classList.add('is-passed');
        b.el.classList.add('is-bite');
        window.setTimeout(() => b.el.classList.remove('is-bite'), 420);
        toast(`被${b.inst.kind.name}咬了一口 · ${atk} 点`);
      }
    }
  });

  function reset(): void {
    for (const b of beasts) b.el.remove();
    beasts = spawnList();
    for (const b of beasts) {
      paintCard(b);
      b.el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        engage(b);
      });
    }
    lastDepth = 0;
  }

  window.addEventListener('dive:surface', () => window.setTimeout(reset, 150));
  window.addEventListener('dive:respawn', () => window.setTimeout(reset, 150));

  // 调试用
  (window as unknown as { __road: () => unknown }).__road = () =>
    beasts.map((b) => ({ name: b.inst.kind.name, depth: b.depth, done: b.done, hp: b.inst.hp }));
}

initRoad();
