/**
 * 区域表：每层切成几块「地貌」，每块下面挂可以搜的点位
 * ==================================================================
 * 这一版**只有数据**，不碰刷点逻辑（密度与节奏等世界规则定了再接 field.ts）。
 * 所以这里不 import 任何运行时模块，纯常量 + 两个查询函数，随便改不会影响手感。
 *
 * 原著依据（8 大层是严格深度区间；层内区域是"该层里的具体地点"）：
 *   Ⅰ 0–1350     阿比斯之渊：城镇旁边，见习探窟家的地方，「遗物多半是小型物品」
 *   Ⅱ 1350–2600  诱惑森林：「经常起雾，相当多会诱惑探窟家的野兽」，下层有倒立森林，
 *                     奥森的「监视基地」在二层（原著：驻扎二层监视基地）
 *   Ⅲ 2600–7000  大断层：笔直峭壁、小生物挖出的地洞、「某处墙壁上卡着一艘小船」
 *   Ⅳ 7000–12000 巨人之杯：力场潮湿、酒杯状巨型食虫植物；「不屈花园」在这一层
 *   Ⅴ 12000–13000 亡骸之海：覆盖着白色的水、与六层相通的空洞；黎明卿的「前线基地」
 *   Ⅵ 13000–15500 来无回之都 / 黄金乡：「所有物品来到那里都能变得非常有价值」；
 *                     生骸村「伊露布露」在六层，六层底部是「诅咒船团」驻扎地
 *   Ⅶ 15500–     尽头的漩涡（最终极之涡）
 *   Ⅷ 19500–20000 奈落之底
 *
 * 字段说明见 Region / RegionDot。约定：
 *   · `from`/`to` 是**深度米数**，落在所属层的区间里，同层内不重叠、按先后排列；
 *   · `band` 是横向位置（0 = 贴左，1 = 贴右）。峭壁贴右、海面铺满、窄带表示"挤在一处"；
 *   · `picks` 全是 `loot.ts` 里已存在的 id —— 不在这里造新物品。
 *     （注意：`crack` 在 loot.ts 里是「石缝菌」，field.ts 里那个 `crack` 是「岩缝」，两回事）
 */

/** 一个可搜的点位。玩家点它 → 读秒 → 从 picks 里掉东西 */
export type RegionDot = {
  id: string;
  /** 点位名。玩家看到的是这个（比如区域叫「入口溪沟」，点位叫「溪流」） */
  name: string;
  /** 能搜到什么：loot.ts 的 id，3 个起步，抽签用 */
  picks: string[];
};

/** 一块地貌 = 一段深度 + 一条横向带 + 若干点位 */
export type Region = {
  id: string;
  /** 所属大层（'Ⅰ' … 'Ⅷ'），和 consts.ts 的 ABYSS_LAYERS[].no 对上 */
  layer: string;
  /** 区域名 */
  name: string;
  /** 深度子区间（米）。同层内按先后排，不重叠 */
  from: number;
  to: number;
  /** 横向范围 0~1 */
  band: [number, number];
  /** 地貌代号，将来给视觉层用（现在只是标签） */
  terrain: string;
  /** 这一段有多显眼：'hint' 表示路过不容易错过（如唯一的小船） */
  hint?: 'normal' | 'hint';
  dots: RegionDot[];
};

export const REGIONS: Region[] = [
  // ================================================================ Ⅰ 阿比斯之渊（0–1350）
  {
    id: 'l1-creek',
    layer: 'Ⅰ',
    name: '入口溪沟',
    from: 0,
    to: 380,
    band: [0.18, 0.62],
    terrain: 'creek',
    dots: [
      { id: 'l1-creek-stream', name: '溪流', picks: ['spring', 'shell', 'shard'] },
      { id: 'l1-creek-moss', name: '苔石', picks: ['seep', 'chalk', 'glass'] },
      { id: 'l1-creek-shallow', name: '浅滩', picks: ['spring', 'weed', 'shell'] },
    ],
  },
  {
    id: 'l1-bridge',
    layer: 'Ⅰ',
    name: '旧栈道',
    from: 380,
    to: 820,
    band: [0.42, 0.72],
    terrain: 'bridge',
    dots: [
      { id: 'l1-bridge-head', name: '断桥头', picks: ['cord', 'nail', 'spear'] },
      { id: 'l1-bridge-crate', name: '货箱', picks: ['jar', 'chalk', 'glass'] },
    ],
  },
  {
    id: 'l1-fossil',
    layer: 'Ⅰ',
    name: '化石层',
    from: 820,
    to: 1350,
    band: [0.55, 0.9],
    terrain: 'fossil',
    dots: [
      { id: 'l1-fossil-pit', name: '化石坑', picks: ['rel-fang', 'compass', 'chalk'] },
      { id: 'l1-fossil-rubble', name: '碎岩堆', picks: ['sand', 'shard', 'sun'] },
    ],
  },

  // ================================================================ Ⅱ 诱惑森林（1350–2600）
  {
    id: 'l2-forest',
    layer: 'Ⅱ',
    name: '倒立森林',
    from: 1350,
    to: 1900,
    band: [0.15, 0.85],
    terrain: 'forest',
    dots: [
      { id: 'l2-forest-root', name: '树根', picks: ['shroom', 'root', 'berry'] },
      { id: 'l2-forest-hollow', name: '树洞', picks: ['fogfruit', 'shroom', 'hide'] },
      { id: 'l2-forest-vine', name: '藤蔓', picks: ['berry', 'cord', 'rel-orb'] },
    ],
  },
  {
    id: 'l2-fog',
    layer: 'Ⅱ',
    name: '雾区',
    from: 1900,
    to: 2280,
    band: [0.3, 0.7],
    terrain: 'fog',
    dots: [
      { id: 'l2-fog-bush', name: '雾中灌木', picks: ['fogfruit', 'berry', 'weed'] },
      { id: 'l2-fog-trail', name: '兽径', picks: ['beastmeat', 'hide', 'spear'] },
    ],
  },
  {
    id: 'l2-nest',
    layer: 'Ⅱ',
    name: '野兽巢',
    from: 2280,
    to: 2600,
    band: [0.6, 0.88],
    terrain: 'nest',
    dots: [
      { id: 'l2-nest-den', name: '巢穴', picks: ['beastmeat', 'hide', 'rel-bell'] },
      { id: 'l2-nest-bone', name: '白骨', picks: ['hide', 'rel-fang', 'spear'] },
    ],
  },

  // ================================================================ Ⅲ 大断层（2600–7000）
  {
    id: 'l3-cliff',
    layer: 'Ⅲ',
    name: '垂直峭壁',
    from: 2600,
    to: 3800,
    band: [0.62, 0.95],
    terrain: 'cliff',
    dots: [
      { id: 'l3-cliff-crack', name: '岩缝', picks: ['sand', 'chalk', 'shard'] },
      { id: 'l3-cliff-ledge', name: '凸台', picks: ['egg', 'nestegg', 'crack'] },
    ],
  },
  {
    id: 'l3-burrow',
    layer: 'Ⅲ',
    name: '地洞群',
    from: 3800,
    to: 5600,
    band: [0.2, 0.6],
    terrain: 'burrow',
    dots: [
      { id: 'l3-burrow-hole', name: '地洞', picks: ['egg', 'nestegg', 'crack'] },
      { id: 'l3-burrow-eggs', name: '卵堆', picks: ['egg', 'crack', 'rel-orb'] },
    ],
  },
  {
    id: 'l3-wreck',
    layer: 'Ⅲ',
    name: '卡住的小船',
    from: 5600,
    to: 6200,
    band: [0.7, 0.95],
    terrain: 'wreck',
    hint: 'hint',
    dots: [
      { id: 'l3-wreck-hull', name: '船骸', picks: ['wedge', 'lens', 'cup'] },
      { id: 'l3-wreck-cabin', name: '船舱', picks: ['jar', 'cord', 'gauze'] },
    ],
  },
  {
    id: 'l3-shaft',
    layer: 'Ⅲ',
    name: '竖井',
    from: 6200,
    to: 7000,
    band: [0.35, 0.7],
    terrain: 'shaft',
    dots: [
      { id: 'l3-shaft-wall', name: '竖井壁', picks: ['vane', 'glass', 'chalk'] },
      { id: 'l3-shaft-drop', name: '坠落物', picks: ['hammer', 'shard', 'rel-bell'] },
    ],
  },

  // ================================================================ Ⅳ 巨人之杯（7000–12000）
  {
    id: 'l4-garden',
    layer: 'Ⅳ',
    name: '酒杯花园',
    from: 7000,
    to: 9200,
    band: [0.12, 0.9],
    terrain: 'garden',
    dots: [
      { id: 'l4-garden-cup', name: '酒杯花', picks: ['nectar', 'digest', 'gauze'] },
      { id: 'l4-garden-bottom', name: '花底', picks: ['nectar', 'umbrella', 'rel-orb'] },
    ],
  },
  {
    id: 'l4-wet',
    layer: 'Ⅳ',
    name: '潮湿力场',
    from: 9200,
    to: 10600,
    band: [0.2, 0.65],
    terrain: 'wet',
    dots: [
      { id: 'l4-wet-pool', name: '水洼', picks: ['nectar', 'digest', 'weed'] },
      { id: 'l4-wet-wall', name: '湿壁', picks: ['gauze', 'sand', 'chalk'] },
    ],
  },
  {
    id: 'l4-cursed',
    layer: 'Ⅳ',
    name: '不屈花园',
    from: 10600,
    to: 11500,
    band: [0.55, 0.9],
    terrain: 'cursed-garden',
    hint: 'hint',
    dots: [
      { id: 'l4-cursed-flower', name: '寄生花丛', picks: ['echo', 'gauze', 'umbrella'] },
      { id: 'l4-cursed-branch', name: '枯枝', picks: ['thread', 'sand', 'chalk'] },
    ],
  },
  {
    id: 'l4-cupbase',
    layer: 'Ⅳ',
    name: '杯底',
    from: 11500,
    to: 12000,
    band: [0.4, 0.75],
    terrain: 'cup-base',
    dots: [
      { id: 'l4-cupbase-silt', name: '杯底淤泥', picks: ['digest', 'basket', 'rel-fang'] },
    ],
  },

  // ================================================================ Ⅴ 亡骸之海（12000–13000）
  {
    id: 'l5-shallow',
    layer: 'Ⅴ',
    name: '白水浅滩',
    from: 12000,
    to: 12400,
    band: [0.15, 0.85],
    terrain: 'bone-sea',
    dots: [
      { id: 'l5-shallow-water', name: '白水', picks: ['whitewater', 'whitewater', 'shell'] },
      { id: 'l5-shallow-drift', name: '漂骸', picks: ['echo', 'rel-orb', 'hide'] },
    ],
  },
  {
    id: 'l5-bones',
    layer: 'Ⅴ',
    name: '骸骨堆',
    from: 12400,
    to: 13000,
    band: [0.35, 0.8],
    terrain: 'bone-pile',
    dots: [
      { id: 'l5-bones-pile', name: '骸骨堆', picks: ['echo', 'basket', 'clock'] },
      { id: 'l5-bones-embed', name: '遗物嵌层', picks: ['cup', 'lens', 'rel-bell'] },
    ],
  },

  // ================================================================ Ⅵ 来无回之都（13000–15500）
  {
    id: 'l6-ruin',
    layer: 'Ⅵ',
    name: '黄金乡废墟',
    from: 13000,
    to: 14000,
    band: [0.15, 0.85],
    terrain: 'ruin',
    dots: [
      { id: 'l6-ruin-shelf', name: '废墟货架', picks: ['offering', 'jar', 'chalk'] },
      { id: 'l6-ruin-arch', name: '倒塌拱门', picks: ['vane', 'gauze', 'thread'] },
      { id: 'l6-ruin-well', name: '干涸井', picks: ['offering', 'jar', 'glass'] },
    ],
  },
  {
    id: 'l6-village',
    layer: 'Ⅵ',
    name: '生骸村·伊露布露',
    from: 14000,
    to: 14900,
    band: [0.25, 0.7],
    terrain: 'village',
    hint: 'hint',
    dots: [
      { id: 'l6-village-stall', name: '集市摊位', picks: ['offering', 'giantmeat', 'rel-orb'] },
      { id: 'l6-village-workshop', name: '工坊', picks: ['lens', 'shears', 'hammer'] },
    ],
  },
  {
    id: 'l6-beastnest',
    layer: 'Ⅵ',
    name: '兽相巢',
    from: 14900,
    to: 15500,
    band: [0.6, 0.95],
    terrain: 'beast-nest',
    dots: [
      { id: 'l6-beastnest-den', name: '巢穴', picks: ['giantmeat', 'falsewater', 'rel-fang'] },
    ],
  },

  // ================================================================ Ⅶ 尽头的漩涡（15500–19500）
  {
    id: 'l7-dark',
    layer: 'Ⅶ',
    name: '无光区',
    from: 15500,
    to: 17500,
    band: [0.2, 0.8],
    terrain: 'dark',
    dots: [
      { id: 'l7-dark-wall', name: '黑暗岩壁', picks: ['sand', 'shard', 'chalk'] },
      { id: 'l7-dark-sunk', name: '沉没物', picks: ['umbrella', 'basket', 'glass'] },
    ],
  },
  {
    id: 'l7-vortex',
    layer: 'Ⅶ',
    name: '涡口',
    from: 17500,
    to: 19500,
    band: [0.35, 0.65],
    terrain: 'vortex',
    hint: 'hint',
    dots: [
      { id: 'l7-vortex-eye', name: '涡眼', picks: ['clock', 'thread', 'echo'] },
      { id: 'l7-vortex-wall', name: '涡壁', picks: ['gauze', 'hide', 'sand'] },
    ],
  },

  // ================================================================ Ⅷ 奈落之底（19500–20000）
  {
    id: 'l8-bottom',
    layer: 'Ⅷ',
    name: '奈落之底',
    from: 19500,
    to: 20000,
    band: [0.3, 0.7],
    terrain: 'bottom',
    hint: 'hint',
    dots: [
      { id: 'l8-bottom-door', name: '底层的门', picks: ['chair', 'clock', 'basket'] },
      { id: 'l8-bottom-silt', name: '沉底之物', picks: ['sarcophagus', 'liquor', 'echo'] },
    ],
  },
];

/** 某一层的所有区域（按深度先后） */
export const regionsOfLayer = (layer: string): Region[] =>
  REGIONS.filter((r) => r.layer === layer).sort((a, b) => a.from - b.from);

/** 某一米落在哪个区域（找不到就返回该层最后一个） */
export function regionAt(depth: number): Region | null {
  const 命中 = REGIONS.filter((r) => depth >= r.from && depth < r.to);
  if (命中.length) return 命中[0];
  // 层与层之间的缝（比如 1350 正好是二层开头）：退到最近的前一块
  const 前 = REGIONS.filter((r) => r.to <= depth).sort((a, b) => b.to - a.to);
  return 前[0] ?? REGIONS[0] ?? null;
}

/** 全部点位（将来刷点逻辑按区域分组用） */
export const allDots = (): { region: Region; dot: RegionDot }[] =>
  REGIONS.flatMap((region) => region.dots.map((dot) => ({ region, dot })));
