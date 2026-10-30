/**
 * 节点里的内容：宝物 / 补给 / 事件 / 商店
 * ------------------------------------------------------------------
 * 战斗节点走 fight.ts，楼梯在 map.ts 里，这一层管剩下四种。
 * 所有面板都是同一个骨架（标题 + 说明 + 一行行东西 + 按钮），
 * 关掉就算这一格处理完了。
 */

import { rollLoot, money, sellOf, type Loot } from './loot';
import { bag } from './bag';
import { run, addOxygen, damage, heal, spend } from './run';
import { meta, buyAtk, buyBag, buyLamp, bagSize } from './meta';
import { toast } from './hud';
import type { NodeKind } from './map';

type Row = {
  glyph: string;
  name: string;
  note: string | (() => string);
  price?: number;
  /** 买了/点了之后做什么，返回 false 表示没成功 */
  act?: () => boolean;
  /** 不能买：定值，或者每次重画时再算（等级上限、氧气已满这类） */
  disabled?: boolean | (() => boolean);
};

type PanelSpec = {
  eyebrow: string;
  title: string;
  text: string;
  rows: Row[];
  /** 关掉面板时回调 */
  onDone: () => void;
  closeLabel?: string;
};

let open: HTMLElement | null = null;

/** 这一行现在能不能点 */
const rowOff = (r: Row): boolean =>
  (typeof r.disabled === 'function' ? r.disabled() : Boolean(r.disabled)) ||
  (r.price !== undefined && run.money < r.price);

function close(): void {
  if (!open) return;
  const el = open;
  open = null;
  el.remove();
}

function paint(spec: PanelSpec): void {
  if (!open) return;
  const list = open.querySelector<HTMLElement>('[data-rows]');
  if (!list) return;
  list.innerHTML = spec.rows
    .map((r, i) => {
      const price = r.price !== undefined ? `<b class="panel-price">${money(r.price)}</b>` : '';
      const dis = rowOff(r);
      const note = typeof r.note === 'function' ? r.note() : r.note;
      return (
        `<button class="panel-row${dis ? ' is-off' : ''}" type="button" data-row="${i}"${dis ? ' disabled' : ''}>` +
        `<span class="panel-glyph">${r.glyph}</span>` +
        `<span class="panel-name">${r.name}<i>${note}</i></span>` +
        price +
        `<span class="panel-go">${r.price !== undefined ? '买' : '选'}</span>` +
        `</button>`
      );
    })
    .join('');
}

function openPanel(spec: PanelSpec): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage) return;
  close();

  const veil = document.createElement('div');
  veil.className = 'panel';
  veil.dataset.panel = '';
  veil.innerHTML =
    `<div class="panel-card">` +
    `<p class="panel-eyebrow">${spec.eyebrow}</p>` +
    `<h2 class="panel-title">${spec.title}</h2>` +
    `<p class="panel-text">${spec.text}</p>` +
    `<div class="panel-rows" data-rows></div>` +
    `<div class="panel-actions"><button class="panel-btn panel-btn--ghost" type="button" data-close>${spec.closeLabel ?? '走开'}</button></div>` +
    `</div>`;
  stage.append(veil);
  requestAnimationFrame(() => veil.classList.add('is-on'));
  open = veil;
  paint(spec);

  veil.addEventListener('click', (event) => {
    const el = event.target as HTMLElement;
    if (el === veil || el.closest('[data-close]')) {
      close();
      spec.onDone();
      return;
    }
    const row = el.closest<HTMLElement>('[data-row]');
    if (!row) return;
    const idx = Number(row.dataset.row);
    const spec2 = spec.rows[idx];
    if (!spec2?.act) return;
    // 上一笔买完可能就到上限了（磨手满级、氧气已满），再点一次不能白扣钱
    if (rowOff(spec2)) return;
    if (spec2.price !== undefined && !spend(spec2.price)) {
      toast('钱不够');
      return;
    }
    const ok = spec2.act();
    if (!ok) return;
    paint(spec);
  });
}

/** 拿一件东西进包，放不下就提示 */
function give(loot: Loot): boolean {
  if (bag?.add(loot)) {
    toast(`拿到了 ${loot.unknown ? '？？？' : loot.name}`);
    return true;
  }
  toast('背包放不下了');
  return false;
}

export function resolveNode(kind: NodeKind, floor: number, onDone: () => void): void {
  const depth = (floor - 1) * 2600 + 2400;

  if (kind === 'treasure') {
    const loot = rollLoot(depth + 2000);
    openPanel({
      eyebrow: `第 ${floor} 层 · 宝物`,
      title: '有个东西压在这儿',
      text: '看着像是有人特意放下的。',
      onDone,
      rows: [
        {
          glyph: '◆',
          name: loot.unknown ? '？？？' : loot.name,
          note: `${loot.rank} · ${loot.w}×${loot.h}`,
          act: () => {
            if (!give(loot)) return false;
            close();
            onDone();
            return false;
          },
        },
      ],
    });
    return;
  }

  if (kind === 'supply') {
    openPanel({
      eyebrow: `第 ${floor} 层 · 补给`,
      title: '一个背包，扣在石头缝里',
      text: '里面还有气。',
      onDone,
      rows: [
        {
          glyph: '＋',
          name: '氧气罐',
          note: '氧气 +35',
          act: () => {
            addOxygen(35);
            toast('氧气 +35');
            close();
            onDone();
            return false;
          },
        },
        {
          glyph: '＋',
          name: '急救包',
          note: '生命 +20',
          act: () => {
            heal(20);
            toast('生命 +20');
            close();
            onDone();
            return false;
          },
        },
      ],
    });
    return;
  }

  if (kind === 'event') {
    openPanel({
      eyebrow: `第 ${floor} 层 · 事件`,
      title: '前面有动静',
      text: '贴着墙，能听见一点声音。',
      onDone,
      rows: [
        {
          glyph: '？',
          name: '摸过去看看',
          note: '可能捡到东西，也可能挨一下（掉 10 血 + 一件遗物）',
          act: () => {
            damage(10);
            const loot = rollLoot(depth);
            give(loot);
            close();
            onDone();
            return false;
          },
        },
        {
          glyph: '·',
          name: '坐下歇一会儿',
          note: '氧气 +18',
          act: () => {
            addOxygen(18);
            toast('氧气 +18');
            close();
            onDone();
            return false;
          },
        },
        {
          glyph: '·',
          name: '不惹它，往下走',
          note: '什么也不发生',
          act: () => {
            close();
            onDone();
            return false;
          },
        },
      ],
    });
    return;
  }

  if (kind === 'shop') {
    openPanel({
      eyebrow: `第 ${floor} 层 · 商店`,
      title: '一个还活着的商人',
      text: '他不问你从哪来，只问你带了多少。',
      onDone,
      closeLabel: '不买了',
      rows: [
        {
          glyph: '＋',
          name: '氧气罐',
          note: '氧气 +35',
          price: 60 + floor * 20,
          disabled: () => run.oxygen >= run.oxygenMax,
          act: () => {
            addOxygen(35);
            toast('氧气 +35');
            return true;
          },
        },
        {
          glyph: '＋',
          name: '急救包',
          note: '生命 +20',
          price: 120 + floor * 30,
          disabled: () => run.hp >= run.max,
          act: () => {
            heal(20);
            toast('生命 +20');
            return true;
          },
        },
        {
          glyph: '⚔',
          name: '磨一磨手',
          note: () => `攻击 +1（现在 ${4 + meta.atk}）`,
          price: 1400,
          disabled: () => meta.atk >= 4,
          act: () => {
            buyAtk();
            toast('攻击 +1');
            return true;
          },
        },
        {
          glyph: '▣',
          name: '换个大背筐',
          note: () => `${bagSize().cols}×${bagSize().rows} → ${bagSize().cols + 1}×${bagSize().rows}`,
          price: 1500,
          disabled: () => meta.bag >= 3,
          act: () => {
            buyBag();
            const now = bagSize();
            bag?.grow(now.cols, now.rows);
            toast('背筐大了一格');
            return true;
          },
        },
        {
          glyph: '灯',
          name: '更好的灯',
          note: () => `多看一行（现在 ${1 + meta.lamp} 行）`,
          price: 1400,
          disabled: () => meta.lamp >= 2,
          act: () => {
            buyLamp();
            toast('看得更远了');
            return true;
          },
        },
      ],
    });
    return;
  }

  // 别的类型（战斗/楼梯）不在这里处理
  onDone();
}

// ---------------------------------------------------------------- 地面
/**
 * 撤回来以后落脚的地方：这里买的都是**永久**的，死了也不掉。
 * 局内的商店也能买，但贵一截 —— 那是「半路救命」的价钱。
 */
export function showGround(onStart: () => void): void {
  openPanel({
    eyebrow: '地面 · 补给站',
    title: '活着回来了',
    text: `包里的东西换成了 ${money()} 。花掉的钱会变成能一直带下去的东西。<br>下次下去，还是从第 1 层走。`,
    onDone: onStart,
    closeLabel: '下潜',
    rows: [
      {
        glyph: '⚔',
        name: '磨一磨手',
        note: () => `攻击 +1（现在 ${4 + meta.atk}）`,
        price: 900,
        disabled: () => meta.atk >= 4,
        act: () => {
          buyAtk();
          toast('攻击 +1');
          return true;
        },
      },
      {
        glyph: '▣',
        name: '换个大背筐',
        note: () => `${bagSize().cols}×${bagSize().rows} → ${bagSize().cols + 1}×${bagSize().rows}`,
        price: 1000,
        disabled: () => meta.bag >= 3,
        act: () => {
          buyBag();
          const now = bagSize();
          bag?.grow(now.cols, now.rows);
          toast('背筐大了一格');
          return true;
        },
      },
      {
        glyph: '灯',
        name: '更好的灯',
        note: () => `多看一行（现在 ${1 + meta.lamp} 行）`,
        price: 900,
        disabled: () => meta.lamp >= 2,
        act: () => {
          buyLamp();
          toast('看得更远了');
          return true;
        },
      },
    ],
  });
}

window.addEventListener('keydown', (event) => {
  if ((event as KeyboardEvent).key === 'Escape') close();
});

// 调试用
(window as unknown as { __sellOf?: unknown }).__sellOf = sellOf;
