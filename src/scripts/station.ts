/**
 * 站点：堆叠大陆式的小牌桌
 * ------------------------------------------------------------------
 * 设计来自《Stacklands / 堆叠大陆》，核心三条：
 *   1. **一切皆卡**。角色、岩壁、遗物、下潜口都是卡，画面里没有卡以外的控件。
 *   2. **拖卡叠到别的卡上才有事发生**。进度条长在那一摞上面。
 *   3. **动作是卡与卡的组合**：角色 + 岩壁 = 凿开；角色 + 下潜口 = 往下走。
 *
 * 四个站都走同一套逻辑，只是桌上的牌不一样（BOARDS）。
 * 目前只有第一层有东西可做，其余三层先放着，能一路走通。
 *
 * 进出站由虚拟滚动配合：进站 = gate.lockAt(落点)，出站 = gate.open()。
 */

import { STATIONS, scrollYForDepth, type StationDef } from './abyss/stations';
import { sankFromDepth } from './abyss/metrics';
import { gate as scrollGate } from './abyss/virtual-scroll';
import { bag } from './abyss/bag';
import { rollLoot, type Loot } from './abyss/loot';
import { run, onRun, damage, heal } from './abyss/run';

type Tone = 'unit' | 'thing' | 'relic' | 'gate' | 'search' | 'loot' | 'exit';
type RuleKey = 'chisel' | 'take' | 'descend' | 'combine' | 'extract';

/** 别的卡拖到这张卡上时会发生什么 */
type Rule = {
  key: RuleKey;
  label: string;
  ms: number;
  /** 拖上来的那张必须是什么：有力气的（角色）／指定的某件东西 */
  needs?: { atk?: true; item?: string };
  /** 另外还得成立的条件：桌上得有这件东西／身上得有几件遗物 */
  requires?: { item?: string; relic?: number };
  /** 接不住时说的那句话 */
  fail?: string;
};

type Def = {
  id: string;
  name: string;
  sub: string;
  icon: string;
  hp: number;
  atk?: number;
  tone: Tone;
  rule?: Rule;
  /** 搜索点：点一下读多少毫秒 */
  search?: number;
};

type Card = {
  uid: string;
  def: Def;
  x: number;
  y: number;
  hp: number;
  on?: string;
  /** 每张卡可以盖掉定义里的规则——下潜口每层的门禁不一样 */
  rule?: Rule;
  /** 地上那件战利品 */
  loot?: Loot;
};

type Recipe = {
  eyebrow: string;
  title: string;
  hint: string;
  /** x / y 是相对牌桌宽高的比例，进站时再换算成像素 */
  cards: {
    def: string;
    x: number;
    y: number;
    needs?: Rule['needs'];
    requires?: Rule['requires'];
    fail?: string;
  }[];
};

const CARD_W = 104;
const CARD_H = 144;
/** 地上那件战利品的小卡（和 abyss.css 里 .pcard.is-loot 的尺寸对齐） */
const LOOT_W = 78;
const LOOT_H = 96;
const SLIVER = 11;

const SV = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ` +
  `stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICON_HERO = SV(
  '<circle cx="12" cy="5.6" r="2.3"/><path d="M12 8.1v6.2M12 10.6l-3.8 2M12 10.6l3.8 2M12 14.3l-3 5.2M12 14.3l3 5.2"/>',
);
const ICON_ROCK = SV('<path d="M3.5 17.5l3-8.5 5.5-3 5.5 4.2 3 7.3z"/><path d="M8.5 9l3.5 4.2L16 9.6"/>');
const ICON_RELIC = SV(
  '<path d="M5.5 16.5l10-9.2 2.2 2.2-9.2 10H5.5z"/><circle cx="17.4" cy="6" r="1.5"/><path d="M9.3 13.6l1.1 1.1"/>',
);
const ICON_GATE = SV(
  '<path d="M6.5 3.5v17M17.5 3.5v17"/><path d="M9.8 8.2l2.2 2.6 2.2-2.6"/><path d="M9.8 13.2l2.2 2.6 2.2-2.6"/>',
);
const ICON_EXIT = SV(
  '<path d="M6.5 3.5v17M17.5 3.5v17"/><path d="M9.8 15.8l2.2-2.6 2.2 2.6"/><path d="M9.8 10.8l2.2-2.6 2.2 2.6"/>',
);
const ICON_ANVIL = SV(
  '<circle cx="12" cy="4.2" r="1.7"/><path d="M12 6v9.5"/><path d="M8.6 20.5h6.8L12 15.5z"/>',
);
const ICON_ROPE = SV('<path d="M5 9.5c0-2.5 3.1-4.5 7-4.5s7 2 7 4.5-3.1 4.5-7 4.5-7-2-7-4.5z"/><path d="M5 14.5c0 2.5 3.1 4.5 7 4.5s7-2 7-4.5"/><path d="M5 9.5v5M19 9.5v5"/>');
const ICON_LADDER = SV('<path d="M8 3.5v17M16 3.5v17"/><path d="M8 8h8M8 12h8M8 16h8"/>');

// 搜索点：都是「地上有点东西」的样子，不是人也不是物件
const ICON_CRACK = SV('<path d="M7 3.5v6l-2.5 4 3 3-1 4"/><path d="M14 3.5l-2 5 2.5 4-2 8"/><path d="M14 3.5h3.5"/>');
const ICON_ROOT = SV('<path d="M12 3.5v7M12 10.5l-4 5M12 10.5l4 5M8 15.5l-1 5M16 15.5l1 5"/>');
const ICON_FOSSIL = SV('<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M12 6.5a5.5 5.5 0 1 1 0 11"/><path d="M12 9.5a2.5 2.5 0 1 0 0 5"/>');
const ICON_CAMP = SV('<path d="M3.5 19.5h17L12 6.5z"/><path d="M12 6.5v13"/><path d="M8 19.5l4-6 4 6"/>');
const ICON_HOLLOW = SV('<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M12 8a4 4 0 1 0 0 8"/>');
const ICON_VINE = SV('<path d="M8 3.5c6 4-6 8 0 12s0 5 0 5"/><path d="M8 8l4-1M8 13l-4-1M9 17l4 1"/>');
const ICON_EGGS = SV('<path d="M8.5 10a2.6 3.4 0 1 1 0 6.8 2.6 3.4 0 0 1 0-6.8z"/><path d="M15 6.5a2.4 3.2 0 1 1 0 6.4 2.4 3.2 0 0 1 0-6.4z"/><path d="M15.5 14a2 2.6 0 1 1 0 5.2 2 2.6 0 0 1 0-5.2z"/>');
const ICON_WRECK = SV('<path d="M4 15h16l-3 5H7z"/><path d="M12 4v11"/><path d="M12 6l6 4-6 2"/>');
const ICON_LOTUS = SV('<path d="M3.5 14a8.5 8.5 0 0 1 17 0z"/><path d="M12 14v6"/><path d="M8 11.5c1.5-2 6.5-2 8 0"/>');
const ICON_SPRING = SV('<path d="M3.5 9c2-2 4.5-2 6.5 0s4.5 2 6.5 0 3.5-1 4 0"/><path d="M3.5 15c2-2 4.5-2 6.5 0s4.5 2 6.5 0 3.5-1 4 0"/>');
const ICON_BONES = SV('<path d="M6 6a2.2 2.2 0 1 1 3 2v8a2.2 2.2 0 1 1-3 2"/><path d="M18 6a2.2 2.2 0 1 0-3 2v8a2.2 2.2 0 1 0 3 2"/>');
const ICON_RUIN = SV('<path d="M4 20V9l4-3v14"/><path d="M14 20V6l6 4v10"/><path d="M4 13h4M14 11h6"/>');
const ICON_RIFT = SV('<path d="M11 3.5l2 5-3 4 3 4-2 4"/><path d="M4 20h16"/>');

const DEFS: Record<string, Def> = {
  hero: { id: 'hero', name: '探险者', sub: '角色', icon: ICON_HERO, hp: 15, atk: 3, tone: 'unit' },
  rock: {
    id: 'rock',
    name: '岩壁',
    sub: '对象',
    icon: ICON_ROCK,
    hp: 6,
    tone: 'thing',
    rule: { key: 'chisel', label: '凿开', ms: 2400, needs: { atk: true }, fail: '凿不动。得有个人来。' },
  },
  anvil: {
    id: 'anvil',
    name: '铅锤',
    sub: '物件',
    icon: ICON_ANVIL,
    hp: 2,
    tone: 'thing',
    rule: { key: 'combine', label: '绑成', ms: 2000, needs: { item: 'rope' }, fail: '该绑点什么上去。' },
  },
  rope: {
    id: 'rope',
    name: '绳',
    sub: '物件',
    icon: ICON_ROPE,
    hp: 1,
    tone: 'thing',
    rule: { key: 'combine', label: '绑成', ms: 2000, needs: { item: 'anvil' }, fail: '该绑点什么上去。' },
  },
  ladder: { id: 'ladder', name: '绳梯', sub: '物件', icon: ICON_LADDER, hp: 1, tone: 'thing' },
  relic: {
    id: 'relic',
    name: '骨笛',
    sub: '遗物',
    icon: ICON_RELIC,
    hp: 1,
    tone: 'relic',
    rule: { key: 'take', label: '拾取', ms: 1200, needs: { atk: true } },
  },
  gate: {
    id: 'gate',
    name: '下潜口',
    sub: '路',
    icon: ICON_GATE,
    hp: 1,
    tone: 'gate',
    rule: { key: 'descend', label: '下潜', ms: 3000, needs: { atk: true } },
  },
  exit: {
    id: 'exit',
    name: '回程',
    sub: '路',
    icon: ICON_EXIT,
    hp: 1,
    tone: 'exit',
    rule: { key: 'extract', label: '撤离', ms: 2200, needs: { atk: true } },
  },

  // ---- 搜索点（点一下就读秒，读完掉东西）。每层长得不一样
  root: { id: 'root', name: '树根', sub: '搜', icon: ICON_ROOT, hp: 1, tone: 'search', search: 1200 },
  fossil: { id: 'fossil', name: '化石堆', sub: '搜', icon: ICON_FOSSIL, hp: 1, tone: 'search', search: 2400 },
  camp: { id: 'camp', name: '旧营地', sub: '搜', icon: ICON_CAMP, hp: 1, tone: 'search', search: 2400 },
  hollow: { id: 'hollow', name: '树洞', sub: '搜', icon: ICON_HOLLOW, hp: 1, tone: 'search', search: 1200 },
  vine: { id: 'vine', name: '藤蔓', sub: '搜', icon: ICON_VINE, hp: 1, tone: 'search', search: 1200 },
  crack: { id: 'crack', name: '岩缝', sub: '搜', icon: ICON_CRACK, hp: 1, tone: 'search', search: 1200 },
  eggs: { id: 'eggs', name: '卵堆', sub: '搜', icon: ICON_EGGS, hp: 1, tone: 'search', search: 2400 },
  wreck: { id: 'wreck', name: '船骸', sub: '搜', icon: ICON_WRECK, hp: 1, tone: 'search', search: 2400 },
  lotus: { id: 'lotus', name: '荷叶', sub: '搜', icon: ICON_LOTUS, hp: 1, tone: 'search', search: 1200 },
  spring: { id: 'spring', name: '温泉', sub: '搜', icon: ICON_SPRING, hp: 1, tone: 'search', search: 2400 },
  bones: { id: 'bones', name: '骸骨堆', sub: '搜', icon: ICON_BONES, hp: 1, tone: 'search', search: 2400 },
  ruin: { id: 'ruin', name: '废墟', sub: '搜', icon: ICON_RUIN, hp: 1, tone: 'search', search: 2400 },
  rift: { id: 'rift', name: '裂缝', sub: '搜', icon: ICON_RIFT, hp: 1, tone: 'search', search: 2400 },
};

/** 每张桌上摆什么。x/y 是比例，0~1。桌上只剩三人份的东西：人、下潜口、回程 */
const BOARDS: Record<string, Recipe> = {
  s1: {
    eyebrow: '一层 · 阿比斯之渊 · 600 米',
    title: '石之舟',
    hint: '「下潜口」往下，「回程」回奥斯',
    cards: [
      { def: 'hero', x: 0.2, y: 0.54 },
      { def: 'gate', x: 0.52, y: 0.28 },
      { def: 'exit', x: 0.82, y: 0.54 },
    ],
  },
  s2: {
    eyebrow: '二层 · 诱惑的森林 · 2,540 米',
    title: '监视基地',
    hint: '这里有奥森的人守着。能歇一会儿',
    cards: [
      { def: 'hero', x: 0.2, y: 0.54 },
      { def: 'gate', x: 0.52, y: 0.28 },
      { def: 'exit', x: 0.82, y: 0.54 },
    ],
  },
  s3: {
    eyebrow: '三层 · 大断层 · 4,000 米',
    title: '被囚禁的海盗船',
    hint: '船为什么会在这儿',
    cards: [
      { def: 'hero', x: 0.2, y: 0.54 },
      { def: 'gate', x: 0.52, y: 0.28 },
      { def: 'exit', x: 0.82, y: 0.54 },
    ],
  },
  s4: {
    eyebrow: '四层 · 巨人之杯 · 7,500 米',
    title: '娜娜奇的秘密基地',
    hint: '这里几乎没有力场。能睡。',
    cards: [
      { def: 'hero', x: 0.2, y: 0.54 },
      { def: 'gate', x: 0.52, y: 0.28 },
      { def: 'exit', x: 0.82, y: 0.54 },
    ],
  },
  s5: {
    eyebrow: '五层 · 亡骸之海 · 12,800 米',
    title: '前线基地',
    hint: '再往下就是六层了',
    cards: [
      { def: 'hero', x: 0.2, y: 0.54 },
      { def: 'gate', x: 0.52, y: 0.28 },
      { def: 'exit', x: 0.82, y: 0.54 },
    ],
  },
  s6: {
    eyebrow: '六层 · 来无回之都 · 14,000 米',
    title: '生骸村',
    hint: '村里没有力场。出去就没有了。',
    cards: [
      { def: 'hero', x: 0.2, y: 0.54 },
      { def: 'gate', x: 0.52, y: 0.28 },
      { def: 'exit', x: 0.82, y: 0.54 },
    ],
  },
};

type Station = {
  def: StationDef;
  at: number;
  panel: HTMLElement;
  board: HTMLElement;
  hint: HTMLElement;
  relicOut: HTMLElement;
  cards: Card[];
  nodes: Map<string, HTMLElement>;
  opened: boolean;
  armed: boolean;
  /** 第一次进站时按桌子大小摆牌 */
  place: () => void;
  /** 重新算一遍下潜口堵没堵 */
  refresh: () => void;
  /** 回奥斯：清空这张桌子 */
  reset: () => void;
  /** 卡从底下浮上来 */
  reveal: (el: HTMLElement, delay: number) => void;
  enter: () => void;
  leave: () => void;
};

function initStation(): void {
  const track = document.querySelector<HTMLElement>('[data-dive-track]');
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  const tpl = document.querySelector<HTMLTemplateElement>('#station-template');
  if (!track || !stage || !tpl) return;

  let seq = 0;
  const stations: Station[] = [];

  // ---------------------------------------------------------------- 建站
  const makeStation = (def: StationDef): Station => {
    const recipe = BOARDS[def.id];
    const panel = tpl.content.firstElementChild?.cloneNode(true) as HTMLElement;
    panel.dataset.station = def.id;
    stage.append(panel);

    const board = panel.querySelector<HTMLElement>('[data-station-board]') as HTMLElement;
    const hint = panel.querySelector<HTMLElement>('[data-station-hint]') as HTMLElement;
    const relicOut = panel.querySelector<HTMLElement>('[data-relic-count]') as HTMLElement;

    (panel.querySelector('.station-eyebrow') as HTMLElement).textContent = recipe.eyebrow;
    (panel.querySelector('.station-title') as HTMLElement).textContent = recipe.title;
    hint.textContent = recipe.hint;
    relicOut.textContent = String(run.relics);

    const st: Station = {
      def,
      at: sankFromDepth(def.depth),
      panel,
      board,
      hint,
      relicOut,
      cards: [],
      nodes: new Map(),
      opened: false,
      armed: true,
      place: () => {},
      refresh: () => {},
      reset: () => {},
      reveal: () => {},
      enter: () => enter(st),
      leave: () => leave(st),
    };

    // ------------------------------------------------------------ 动作
    let actionTimer = 0;
    let actionBar: HTMLElement | null = null;

    const cancelAction = (): void => {
      window.clearInterval(actionTimer);
      actionTimer = 0;
      if (!actionBar) return;
      actionBar.setAttribute('hidden', '');
      const fill = actionBar.querySelector<HTMLElement>('i');
      if (fill) fill.style.width = '0%';
      actionBar = null;
    };

    const say = (text: string): void => {
      hint.textContent = text;
    };

    // ------------------------------------------------------------ 画卡
    const paint = (card: Card): void => {
      const el = st.nodes.get(card.uid);
      if (!el) return;

      const base = card.on ? st.cards.find((c) => c.uid === card.on) : undefined;
      if (base) {
        const depth = st.cards.filter((c) => c.on === base.uid).indexOf(card) + 1;
        el.style.transform = `translate3d(${base.x}px, ${base.y - depth * SLIVER}px, 0)`;
        el.style.zIndex = String(10 - depth);
        el.classList.add('is-stacked');
      } else {
        el.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
        el.style.zIndex = '20';
        el.classList.remove('is-stacked');
      }

      // 人卡的血跟全局生命走，上限也是全局的
      const maxHp = card.def.id === 'hero' ? run.max : card.def.hp;
      const pct = Math.max(0, Math.min(1, card.hp / maxHp));
      const bar = el.querySelector<HTMLElement>('.pcard-hp > i');
      const num = el.querySelector<HTMLElement>('.pcard-heart');
      if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
      if (num) num.textContent = `♥ ${Math.round(Math.max(0, card.hp))}`;
    };

    const relayout = (): void => {
      for (const card of st.cards) paint(card);
    };

    /** 卡从底下浮上来。进站那一拍是错开的，中途掉出来的卡（遗物）自己浮 */
    const reveal = (el: HTMLElement, delay: number): void => {
      if (el.classList.contains('is-in')) return;
      if (delay > 0) el.style.transitionDelay = `${delay}ms`;
      requestAnimationFrame(() => el.classList.add('is-in'));
      if (delay > 0) {
        window.setTimeout(() => {
          el.style.transitionDelay = '';
        }, delay + 420);
      }
    };

    const spawn = (def: Def, x: number, y: number, override?: Partial<Rule>, loot?: Loot): Card => {
      seq += 1;
      const card: Card = {
        uid: `${def.id}-${seq}`,
        def,
        x,
        y,
        hp: def.id === 'hero' ? Math.max(1, run.hp) : def.hp,
        rule: def.rule ? { ...def.rule, ...(override ?? {}) } : undefined,
        loot,
      };
      const el = document.createElement('div');
      el.className = `pcard pcard--${def.tone}`;
      el.dataset.cardId = card.uid;
      if (loot) {
        el.classList.add('is-loot');
        el.dataset.tier = String(loot.tier);
        el.title = loot.unknown ? '？？？ · 回营地才知道是什么' : loot.name;
      }
      el.innerHTML =
        `<span class="pcard-hp"><i></i></span>` +
        `<span class="pcard-head">${def.name}</span>` +
        `<span class="pcard-sub">${def.sub}</span>` +
        `<span class="pcard-art">${def.icon}</span>` +
        `<span class="pcard-stats">` +
        `<b class="pcard-heart">♥ ${def.hp}</b>` +
        (def.atk === undefined ? '' : `<b class="pcard-atk">⚔ ${def.atk}</b>`) +
        `</span>` +
        `<span class="pcard-progress" hidden><i></i></span>`;

      st.cards.push(card);
      st.nodes.set(card.uid, el);
      board.append(el);
      paint(card);
      bindDrag(card, el);
      if (st.opened) reveal(el, 0);
      return card;
    };

    const makeCard = (id: string, x: number, y: number, override?: Partial<Rule>): Card | undefined => {
      const def = DEFS[id];
      if (!def) return undefined;
      return spawn(def, x, y, override);
    };

    /** 未揭晓时的问号 */
    const Q_ICON =
      '<svg viewBox="0 0 24 24"><path d="M8.8 9.2a3.2 3.2 0 1 1 4.6 2.9c-1 .5-1.4 1.1-1.4 2.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>';

    /** 地上那件东西：小卡，边框按稀有度上色。hidden = 还没揭晓 */
    const makeLoot = (loot: Loot, x: number, y: number, hidden = false): Card => {
      const def: Def = {
        id: loot.id,
        name: hidden || loot.unknown ? '？？？' : loot.name,
        sub: hidden ? '未开' : loot.unknown ? `遗物 ${loot.w}×${loot.h}` : `物品 ${loot.w}×${loot.h}`,
        icon: hidden ? Q_ICON : `<svg viewBox="0 0 24 24">${loot.icon}</svg>`,
        hp: 1,
        tone: 'loot',
      };
      const card = spawn(def, x, y, undefined, loot);
      if (hidden) {
        const el = st.nodes.get(card.uid);
        if (el) {
          el.dataset.hidden = '1';
          el.removeAttribute('data-tier');
        }
      }
      return card;
    };

    /** 揭晓：把问号换成真东西，闪一下 */
    const revealLoot = (card: Card): void => {
      const loot = card.loot;
      const el = st.nodes.get(card.uid);
      if (!loot || !el || !el.dataset.hidden) return;
      const unknown = loot.unknown;
      card.def = {
        ...card.def,
        name: unknown ? '？？？' : loot.name,
        sub: unknown ? `遗物 ${loot.w}×${loot.h}` : `物品 ${loot.w}×${loot.h}`,
        icon: `<svg viewBox="0 0 24 24">${loot.icon}</svg>`,
      };
      el.removeAttribute('data-hidden');
      el.dataset.tier = String(loot.tier);
      const head = el.querySelector<HTMLElement>('.pcard-head');
      const sub = el.querySelector<HTMLElement>('.pcard-sub');
      const art = el.querySelector<HTMLElement>('.pcard-art');
      if (head) head.textContent = card.def.name;
      if (sub) sub.textContent = card.def.sub;
      if (art) art.innerHTML = card.def.icon;
      el.classList.add('is-pop');
      window.setTimeout(() => el.classList.remove('is-pop'), 560);
    };

    const removeCard = (card: Card): void => {
      cancelAction();
      for (const other of st.cards) {
        if (other.on === card.uid) other.on = undefined;
      }
      const i = st.cards.indexOf(card);
      if (i >= 0) st.cards.splice(i, 1);
      st.nodes.get(card.uid)?.remove();
      st.nodes.delete(card.uid);
      relayout();
    };

    // ------------------------------------------------------------ 结算

    /** 这张卡接不接得住拖上来的那张 */
    const accepts = (rule: Rule, src: Card): boolean => {
      const need = rule.needs;
      if (!need) return true;
      if (need.atk && src.def.atk === undefined) return false;
      if (need.item && src.def.id !== need.item) return false;
      return true;
    };

    /** 另外那个条件成不成立：桌上有没有那件东西、身上有没有那点分量 */
    const ready = (rule: Rule): boolean => {
      const req = rule.requires;
      if (!req) return true;
      if (req.item && !st.cards.some((c) => c.def.id === req.item)) return false;
      if (req.relic && run.relics < req.relic) return false;
      return true;
    };

    /** 下潜口堵没堵 */
    const refreshGates = (): void => {
      for (const card of st.cards) {
        if (card.rule?.key !== 'descend') continue;
        const open = ready(card.rule);
        const el = st.nodes.get(card.uid);
        if (!el) continue;
        el.dataset.blocked = open ? '0' : '1';
        const sub = el.querySelector<HTMLElement>('.pcard-sub');
        if (sub) sub.textContent = open ? card.def.sub : '堵着';
      }
    };

    const finish = (src: Card, target: Card, rule: Rule): void => {
      if (rule.key === 'extract') {
        const cost = st.def.extract;
        if (run.hp <= cost) {
          say(`撤离要付 ${cost} 点血，你身上只剩 ${run.hp} 点。爬上去更贵。`);
          return;
        }
        damage(cost);
        say(`付了 ${cost} 点血，回奥斯。`);
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('dive:surface')), 500);
        return;
      }

      if (rule.key === 'descend') {
        leave(st);
        return;
      }

      if (rule.key === 'chisel') {
        const at = { x: target.x, y: target.y };
        removeCard(target);
        damage(2);
        src.x = at.x;
        src.y = at.y;
        paint(src);
        const dropX = Math.min(board.clientWidth - CARD_W, at.x + 130);
        const relic = makeCard('relic', dropX, Math.max(0, at.y - 30));
        if (relic) say(`凿开了，掉出「${relic.def.name}」。${src.def.name} 掉了 2 点血。`);
        refreshGates();
        return;
      }

      if (rule.key === 'combine') {
        const at = { x: target.x, y: target.y };
        removeCard(target);
        removeCard(src);
        makeCard('ladder', at.x, at.y);
        say('「铅锤」和「绳」绑成了「绳梯」。');
        refreshGates();
        return;
      }

      removeCard(target);
      run.relics += 1;
      for (const s of stations) s.relicOut.textContent = String(run.relics);
      say(`收下了「${target.def.name}」。遗物 ${run.relics} 件。`);
      refreshGates();
    };

    /** 拖到哪张卡上，就看那张卡接不接得住 */
    const runStack = (card: Card): void => {
      const target = card.on ? st.cards.find((c) => c.uid === card.on) : undefined;
      if (!target) return;
      const rule = target.rule;
      if (!rule) return;

      const el = st.nodes.get(card.uid);
      const bar = el?.querySelector<HTMLElement>('.pcard-progress');
      if (!bar) return;

      const ok = accepts(rule, card) && ready(rule);

      cancelAction();
      actionBar = bar;
      bar.removeAttribute('hidden');
      bar.classList.remove('is-fail');
      say(
        rule.key === 'descend'
          ? `${card.def.name} 正在往下走…`
          : rule.key === 'extract'
            ? `${card.def.name}：付 ${st.def.extract} 点血就能回奥斯…`
            : rule.key === 'combine'
              ? `把「${card.def.name}」绑到「${target.def.name}」上…`
              : `${card.def.name} · ${rule.label}${target.def.name}…`,
      );

      const fill = bar.querySelector<HTMLElement>('i');
      const start = performance.now();
      actionTimer = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - start) / rule.ms);
        // 接不住：走到一半就顶住，红一下，然后把卡推回旁边
        if (!ok && p >= 0.55) {
          window.clearInterval(actionTimer);
          actionTimer = 0;
          if (fill) fill.style.width = '55%';
          bar.classList.add('is-fail');
          say(rule.fail ?? '弄不开。');
          card.on = undefined;
          card.x = Math.max(0, Math.min(board.clientWidth - CARD_W, target.x + CARD_W + 18));
          card.y = target.y;
          relayout();
          window.setTimeout(() => {
            bar.classList.remove('is-fail');
            cancelAction();
          }, 620);
          return;
        }
        if (fill) fill.style.width = `${Math.round(p * 100)}%`;
        if (p < 1) return;
        cancelAction();
        finish(card, target, rule);
      }, 40);
    };

    // ------------------------------------------------------------ 拖动
    let drag: { card: Card; el: HTMLElement; dx: number; dy: number } | null = null;

    const cardAt = (x: number, y: number, self: Card): Card | undefined => {
      const hit = document.elementFromPoint(x, y)?.closest('.pcard') as HTMLElement | null;
      const id = hit?.dataset.cardId;
      if (!id || id === self.uid) return undefined;
      return st.cards.find((c) => c.uid === id);
    };

    const highlight = (x: number, y: number, self: Card): void => {
      board.querySelectorAll('.pcard.is-target').forEach((n) => n.classList.remove('is-target'));
      const target = cardAt(x, y, self);
      if (target) st.nodes.get(target.uid)?.classList.add('is-target');
    };

    const bindDrag = (card: Card, el: HTMLElement): void => {
      let downX = 0;
      let downY = 0;
      let moved = false;

      el.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        cancelAction();
        card.on = undefined;
        relayout();

        downX = event.clientX;
        downY = event.clientY;
        moved = false;

        const rect = board.getBoundingClientRect();
        drag = {
          card,
          el,
          dx: event.clientX - rect.left - card.x,
          dy: event.clientY - rect.top - card.y,
        };
        el.classList.add('is-lifted');
        // 拖起来的那张不要参与命中判定，否则光标底下永远是自己，永远叠不上去
        el.style.pointerEvents = 'none';
        el.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      el.addEventListener('pointermove', (event) => {
        if (!drag || drag.card !== card) return;
        if (!moved && Math.hypot(event.clientX - downX, event.clientY - downY) > 6) moved = true;
        const rect = board.getBoundingClientRect();
        const px = event.clientX - rect.left - drag.dx;
        const py = event.clientY - rect.top - drag.dy;
        // 战利品可以拖出桌面（要能拖进左边的背包），别的卡还是夹在桌子里
        card.x = card.loot ? Math.min(board.clientWidth - CARD_W, px) : Math.max(0, Math.min(board.clientWidth - CARD_W, px));
        card.y = Math.max(0, Math.min(board.clientHeight - CARD_H, py));
        el.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
        if (moved) highlight(event.clientX, event.clientY, card);
      });

      const drop = (event: PointerEvent): void => {
        if (!drag || drag.card !== card) return;
        el.classList.remove('is-lifted');
        // 先判命中、再把自己放回可命中状态——反过来的话光标底下又是自己
        const target = cardAt(event.clientX, event.clientY, card);
        const overBag = bag?.isOver(event.clientX, event.clientY) ?? false;
        el.style.pointerEvents = '';
        board.querySelectorAll('.pcard.is-target').forEach((n) => n.classList.remove('is-target'));
        drag = null;

        // 没怎么动 = 点了一下
        if (!moved) {
          relayout();
          startSearch(card);
          return;
        }

        // 拖进背包（拖到贴身袋上就塞贴身袋）
        if (card.loot && overBag) {
          if (bag?.add(card.loot, { x: event.clientX, y: event.clientY })) {
            removeCard(card);
            say(`收进背包：${card.def.name}`);
          } else {
            say('背包满了。得先扔点什么。');
            relayout();
          }
          return;
        }

        if (target) {
          card.on = target.uid;
          card.x = target.x;
          card.y = target.y;
        }
        relayout();
        runStack(card);
      };

      el.addEventListener('pointerup', drop);
      el.addEventListener('pointercancel', drop);
    };

    // ------------------------------------------------------------ 搜索
    /** 搜过的点：变灰、副行写「空了」，不能重复搜 */
    const searched = new Set<string>();

    /** 找一块不压到别的卡的地方放战利品 */
    const findSpot = (x: number, y: number): { x: number; y: number } => {
      const w = LOOT_W;
      const h = LOOT_H;
      const tries: [number, number][] = [
        [120, 16],
        [120, 118],
        [0, 132],
        [-128, 60],
        [190, -70],
      ];
      for (const [dx, dy] of tries) {
        const nx = Math.max(0, Math.min(board.clientWidth - w, x + dx));
        const ny = Math.max(0, Math.min(board.clientHeight - h, y + dy));
        // 卡的位置是左上角，所以按矩形相交判，别用中心距离
        const clash = st.cards.some((c) => {
          const cw = c.loot ? LOOT_W : CARD_W;
          const ch = c.loot ? LOOT_H : CARD_H;
          return nx < c.x + cw + 10 && nx + w + 10 > c.x && ny < c.y + ch + 10 && ny + h + 10 > c.y;
        });
        if (!clash) return { x: nx, y: ny };
      }
      return { x: Math.max(0, Math.min(board.clientWidth - w, x + 30)), y: Math.max(0, Math.min(board.clientHeight - h, y + 30)) };
    };

    const startSearch = (card: Card): void => {
      const ms = card.def.search;
      if (ms === undefined || searched.has(card.uid)) return;
      const el = st.nodes.get(card.uid);
      const bar = el?.querySelector<HTMLElement>('.pcard-progress');
      if (!bar) return;

      cancelAction();
      actionBar = bar;
      bar.removeAttribute('hidden');
      bar.classList.remove('is-fail');
      say(`在翻「${card.def.name}」…`);

      const fill = bar.querySelector<HTMLElement>('i');
      const start = performance.now();
      actionTimer = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - start) / ms);
        if (fill) fill.style.width = `${Math.round(p * 100)}%`;
        if (p < 1) return;
        cancelAction();
        searched.add(card.uid);
        el?.classList.add('is-empty');
        const sub = el?.querySelector<HTMLElement>('.pcard-sub');
        if (sub) sub.textContent = '空了';

        // 翻出 2~4 件，先全是问号，再一件件揭
        const count = 2 + Math.floor(Math.random() * 3);
        const spawned: Card[] = [];
        // 每件都从上一件的位置继续找空位，免得叠到别的卡上
        let base = { x: card.x, y: card.y };
        for (let i = 0; i < count; i++) {
          base = findSpot(base.x, base.y);
          spawned.push(makeLoot(rollLoot(st.def.depth), base.x, base.y, true));
        }
        say(`翻出 ${count} 件东西。`);
        spawned.forEach((c, i) => {
          window.setTimeout(() => revealLoot(c), 420 + i * 240);
        });
      }, 40);
    };

    /** 第一次进站时按桌子大小摆牌 */
    let placed = false;
    const place = (): void => {
      if (placed) return;
      const bw = board.clientWidth;
      const bh = board.clientHeight;
      if (!bw || !bh) return;
      placed = true;
      for (const item of recipe.cards) {
        const override: Partial<Rule> = {};
        if (item.needs) override.needs = item.needs;
        if (item.requires) override.requires = item.requires;
        if (item.fail) override.fail = item.fail;
        makeCard(
          item.def,
          Math.round(bw * item.x) - CARD_W / 2,
          Math.round(bh * item.y) - CARD_H / 2,
          override,
        );
      }
      refreshGates();
    };

    st.place = place;
    st.refresh = refreshGates;
    st.reveal = reveal;

    // 生命变了：牌桌上那张人卡跟着变
    onRun(() => {
      const hero = st.cards.find((c) => c.def.id === 'hero');
      if (!hero) return;
      hero.hp = Math.max(1, run.hp);
      paint(hero);
    });

    /** 回奥斯：这张桌子清空，下次下来重新摆 */
    const reset = (): void => {
      cancelAction();
      for (const c of [...st.cards]) {
        st.nodes.get(c.uid)?.remove();
        st.nodes.delete(c.uid);
      }
      st.cards.length = 0;
      placed = false;
      st.armed = true;
    };
    st.reset = reset;

    return st;
  };

  // ---------------------------------------------------------------- 进出站
  /** 同时只允许一块牌桌开着：跳转（End / 外链）有可能一帧跨两站 */
  const closeQuietly = (st: Station): void => {
    st.opened = false;
    st.armed = false;
    st.panel.classList.remove('is-open');
    st.panel.hidden = true;
    st.panel.setAttribute('aria-hidden', 'true');
  };

  const enter = (st: Station): void => {
    if (st.opened) return;
    for (const other of stations) {
      if (other !== st && other.opened) closeQuietly(other);
    }
    st.opened = true;
    showPrompt(null);

    st.panel.hidden = false;
    st.panel.removeAttribute('aria-hidden');
    st.relicOut.textContent = String(run.relics);
    st.place(); // 面板可见之后才量得到桌面大小
    st.refresh();

    // 钉在这层的落点上：不是直接跳过去，让虚拟滚动自己滑过去（那一下就是「落定」）
    scrollGate.lockAt(scrollYForDepth(st.def.depth));
    window.dispatchEvent(new CustomEvent('dive:reset-peak'));

    document.documentElement.classList.add('station-open');
    [...st.nodes.values()].forEach((el, i) => st.reveal(el, i * 80));
    requestAnimationFrame(() => st.panel.classList.add('is-open'));

    // 基地：有人守着，能歇一口气
    if (st.def.base && run.hp < run.max) {
      const before = run.hp;
      heal(8);
      say(`${st.def.name}。歇了一会儿，回了 ${run.hp - before} 点血。`);
    }

    window.dispatchEvent(new CustomEvent('dive:station-open', { detail: { id: st.def.id } }));
  };

  const leave = (st: Station): void => {
    if (!st.opened) return;
    st.opened = false;
    st.armed = false;
    st.panel.classList.remove('is-open');
    scrollGate.open();
    window.setTimeout(() => {
      st.panel.hidden = true;
      st.panel.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('station-open');
      window.dispatchEvent(new CustomEvent('dive:station-close', { detail: { id: st.def.id } }));
    }, 280);
  };

  for (const def of STATIONS) stations.push(makeStation(def));

  /** 回奥斯：清桌、回血、滚回水面 */
  const returnToSurface = (): void => {
    for (const st of stations) {
      closeQuietly(st);
      st.reset();
    }
    document.documentElement.classList.remove('station-open');
    scrollGate.warp(0);
    heal(run.max);
  };

  window.addEventListener('dive:surface', returnToSurface);
  window.addEventListener('dive:respawn', returnToSurface);

  /** 往上爬着离开站：不算"下潜"，也不推一把 */
  const leaveUp = (st: Station): void => {
    if (!st.opened) return;
    st.opened = false;
    st.armed = false;
    st.panel.classList.remove('is-open');
    window.setTimeout(() => {
      st.panel.hidden = true;
      st.panel.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('station-open');
      window.dispatchEvent(new CustomEvent('dive:station-close', { detail: { id: st.def.id } }));
    }, 240);
  };

  // 滚到站附近不再自动进去——给一个「进入」的提示，玩家自己决定
  const prompt = document.createElement('button');
  prompt.type = 'button';
  prompt.className = 'station-prompt';
  prompt.hidden = true;
  stage.append(prompt);

  let promptFor: Station | null = null;
  prompt.addEventListener('click', () => {
    if (promptFor) promptFor.enter();
  });

  const showPrompt = (st: Station | null): void => {
    if (st === promptFor) return;
    promptFor = st;
    if (!st) {
      prompt.hidden = true;
      return;
    }
    prompt.hidden = false;
    prompt.innerHTML = `进入 · <b>${st.def.name}</b>`;
    prompt.dataset.count = String(stations.indexOf(st) + 1);
    requestAnimationFrame(() => prompt.classList.add('is-on'));
  };

  window.addEventListener('dive:tick', (event) => {
    const { sank } = (event as CustomEvent<{ sank: number }>).detail;
    let near: Station | null = null;
    for (const st of stations) {
      if (st.opened) {
        if (sank < st.at - 0.004) leaveUp(st);
        continue;
      }
      if (!st.armed && sank < st.at - 0.012) st.armed = true;
      // 站附近（还没走远）就把提示亮出来
      if (st.armed && sank >= st.at - 0.002 && sank <= st.at + 0.026) near = st;
    }
    showPrompt(near);
  });
}

initStation();
