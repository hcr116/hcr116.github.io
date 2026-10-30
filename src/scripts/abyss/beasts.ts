/**
 * 原生生物
 * ------------------------------------------------------------------
 * 名字、危险度都照原作（[原生生物一覧(危険度順)](https://wiki3.jp/miabyss-matome/page/20)）。
 * 危险度用的是原作那套 ★：
 *
 *   ☆ 安全 / ★ 軽微 / ★★ 要警戒 / ★★★ 深刻 / ★★★★ 致命的 / ★★★★★ 理不尽
 *   ★6 桁外れ、★7 空前 —— 原作里这两档**标注「未登场」**，所以深处的评级谁也说不准，
 *   我们就写成「未记录」。
 *
 * 体型用背包那套格子：小东西 1×1，巨兽 4×4。
 * **第一次遇到时只看得到体型，看不到危险度**——所以「要不要碰」只能靠命试。
 */

import { ABYSS_LAYERS } from '../../consts';

export type BeastKind = {
  id: string;
  /** 原作名（汉字写法是意译，括号里是日文读法） */
  name: string;
  /** 危险度：1~5 对应 ★，6/7 = 原作未登场 */
  danger: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** 等级字面 */
  rank: string;
  w: 1 | 2 | 3 | 4;
  h: 1 | 2 | 3 | 4;
  hp: number;
  atk: number;
  /** 出现在这一层（原作的层） */
  layer: string;
  /** 一句话 */
  desc: string;
  /** 图标（24×24 path） */
  icon: string;
};

const P = (d: string): string =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

export const BEASTS: BeastKind[] = [
  // ---- 一层：轻的东西
  {
    id: 'tsuchibashi',
    name: '土嘴',
    danger: 1,
    rank: '★ 軽微',
    w: 1,
    h: 1,
    hp: 6,
    atk: 1,
    layer: 'Ⅰ',
    desc: '在土里钻洞的小东西，一群一群的。咬人疼，但不致命。',
    icon: P('M6 14a6 4 0 0 1 12 0zM9 14l-1 4M15 14l1 4M12 10V7'),
  },
  {
    id: 'hamashirama',
    name: '浜白',
    danger: 1,
    rank: '★ 軽微',
    w: 1,
    h: 1,
    hp: 4,
    atk: 1,
    layer: 'Ⅰ',
    desc: '浅水边的一片白，看着像石头，走近才发现会动。',
    icon: P('M4 15c3-6 13-6 16 0zM7 15v3M12 15v4M17 15v3'),
  },
  // ---- 二层
  {
    id: 'gokouge',
    name: '号吼',
    danger: 2,
    rank: '★★ 要警戒',
    w: 2,
    h: 1,
    hp: 14,
    atk: 2,
    layer: 'Ⅱ',
    desc: '先听见声音，才看见它。那一嗓子会让人的方向感乱掉。',
    icon: P('M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4M11 10v4M13 10v4'),
  },
  // ---- 三层
  {
    id: 'ottobasu',
    name: '乙羽',
    danger: 3,
    rank: '★★★ 深刻',
    w: 2,
    h: 2,
    hp: 24,
    atk: 3,
    layer: 'Ⅲ',
    desc: '翅膀收起来的时候像一块破布。展开之后比人还宽。',
    icon: P('M12 4c4 3 6 8 6 12H6c0-4 2-9 6-12zM12 4v14M9 9l-3 4M15 9l3 4'),
  },
  {
    id: 'nakikabane',
    name: '泣骸',
    danger: 3,
    rank: '★★★ 深刻',
    w: 2,
    h: 2,
    hp: 28,
    atk: 4,
    layer: 'Ⅲ',
    desc: '会哭。哭起来像小孩。它哭完就该跑了。',
    icon: P('M12 4a6 6 0 0 1 6 6v6H6v-6a6 6 0 0 1 6-6zM9 11h.01M15 11h.01M10 16c1 1 3 1 4 0'),
  },
  // ---- 四层
  {
    id: 'benikuchinawa',
    name: '紅口縄',
    danger: 4,
    rank: '★★★★ 致命的',
    w: 3,
    h: 2,
    hp: 40,
    atk: 6,
    layer: 'Ⅳ',
    desc: '一条红色的绳，盘在荷叶边上。它不追人，它等。',
    icon: P('M4 16c2-8 6-10 8-4s6 4 8-4M4 16h16M8 16v4M16 16v4'),
  },
  // ---- 五层
  {
    id: 'kuongatari',
    name: '喰怨語',
    danger: 5,
    rank: '★★★★★ 理不尽',
    w: 3,
    h: 3,
    hp: 70,
    atk: 9,
    layer: 'Ⅴ',
    desc: '会说话。说的是你心里那句话。别听。',
    icon: P('M5 6h14v10H9l-4 4zM9 10h6M9 13h4'),
  },
  // ---- 六层
  {
    id: 'tamaugachi',
    name: '魂疑',
    danger: 5,
    rank: '★★★★★ 理不尽',
    w: 4,
    h: 4,
    hp: 110,
    atk: 12,
    layer: 'Ⅵ',
    desc: '一整面墙那么高。它不动的时候，你以为那是废墟的一部分。',
    icon: P('M6 20V6l6-3 6 3v14M9 20v-5h6v5M9 9h.01M15 9h.01'),
  },
  // ---- 七层：原作里没写出来的那两档
  {
    id: 'unrecorded',
    name: '未记录',
    danger: 7,
    rank: '★7 空前',
    w: 4,
    h: 4,
    hp: 150,
    atk: 16,
    layer: 'Ⅶ',
    desc: '没有名字。档案里这一格是空的，连危险度都是空的。',
    icon: P('M12 3l9 18H3zM12 9v5M12 17h.01'),
  },
];

/** 这一层能遇到的（层名字对得上） */
export function beastsAt(layerNo: string): BeastKind[] {
  const hits = BEASTS.filter((b) => b.layer === layerNo);
  return hits.length ? hits : [BEASTS[0]];
}

/** 一只具体的怪：同一个种类，血是自己的 */
export type BeastInstance = {
  kind: BeastKind;
  hp: number;
  maxHp: number;
  uid: string;
};

export const layerNoAt = (depth: number): string => {
  for (const l of ABYSS_LAYERS) if (depth < l.to) return l.no;
  return ABYSS_LAYERS[ABYSS_LAYERS.length - 1].no;
};
