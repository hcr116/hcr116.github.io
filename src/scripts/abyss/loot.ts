/**
 * 战利品
 * ------------------------------------------------------------------
 * 越深越值钱，也越占地方。但这两件事都**不改变一件东西本身值多少**：
 * 星之罗盘第 1 米捡到和第 19,000 米捡到，卖的都是 180。
 *
 * 价格按原著的遗物等级来（`rank`），不按我们自己的颜色：
 *   特級 > 一級 > 二級 > 三級 > 四級 > 杂物（杂物不是遗物）
 * 所以会出现「鳞伞占地 2×3 却只值 150，千人楔巴掌大却 4,500」——
 * 这正是原著里那套等级，也是这游戏要你学的东西：
 * **占地方的不值钱，值钱的不占地方。**
 *
 * 未鉴定的遗物在深渊里只显示「？？？」，但**颜色保留**——
 * 颜色是它渗出来的东西，名字和价钱要带回奥斯才弄得清楚。
 */

export type Tier = 1 | 2 | 3 | 4 | 5 | 6;

/** 三角洲那套分法：东西是什么，决定它被归到哪一栏 */
export type LootKindName = '遗物' | '材料' | '工具' | '食物' | '补给';

export type LootKind = {
  id: string;
  name: string;
  /** 颜色档（出现得多难）：杂物 → 四級 → 三級 → 二級 → 一級 → 特級 */
  tier: Tier;
  /** 原著里的等级，会原样印在物品上 */
  rank: string;
  /** 一件卖多少钱。固定值，不随深度变 */
  price: number;
  /** 占几格：宽高各 1~4。尺寸和价钱**解耦** */
  w: 1 | 2 | 3 | 4;
  h: 1 | 2 | 3 | 4;
  /** 图标（24×24 的 path） */
  icon: string;
  /** 品类：遗物 / 材料 / 工具 / 食物 */
  kind: LootKindName;
  /** 一句话描述，检视面板里看 */
  desc: string;
  /** 可以用：回血 / 顶饿 / 解渴 */
  use?: { label: string; heal?: number; hunger?: number; thirst?: number };
  /**
   * 第二种吃法：背包里有 need 那件东西时才出现。
   * 现在只有白海水用——五层的水泡着遗骸，直接喝解渴最高但掉血；
   * 带着灯火就能烧开再喝，变成正常的水。
   */
  purify?: { label: string; need: string; heal?: number; hunger?: number; thirst?: number };
  /** 遗物：深渊里看不出来是什么，要带回奥斯才知道 */
  relic?: boolean;
  /** 补给：在奥斯买来的消耗品，卖不回去 */
  provision?: boolean;
  /** 卖价。没有就是 price（遗物原价卖）；补给是 0 */
  sell?: number;
};

export type Loot = LootKind & {
  uid: string;
  /** 没鉴定过的遗物：名字显示成 ？？？ */
  unknown: boolean;
  /** 在哪一米捡的。原著「所有物品来到六层都能变得非常有价值」，结算按这个加成 */
  foundDepth?: number;
};

const P = (d: string): string =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

/** 杂物：不是遗物，卖不了几个钱 */
const JUNK = '杂物';

/**
 * 物品池。先按**占格**分组，组内按等级排。
 * 大小和等级是两回事，价格是按等级查的。
 */
const POOL: (LootKind & { minDepth?: number })[] = [
  // ---- 1×1：塞缝用的
  { id: 'shard', name: '碎瓷片', tier: 1, rank: JUNK, price: 1, w: 1, h: 1, kind: '材料', desc: '不知道是谁摔的，断口还挂着釉。', icon: P('M4 18l6-9 4 5 3-3 3 7z') },
  { id: 'nail', name: '锈铁钉', tier: 1, rank: JUNK, price: 2, w: 1, h: 1, kind: '材料', desc: '从旧栈道上拔的。带回去只能论斤卖。', icon: P('M12 4v12M9 13l3 5 3-5') },
  { id: 'shell', name: '贝壳', tier: 1, rank: JUNK, price: 3, w: 1, h: 1, kind: '材料', desc: '一层浅水里捡的，还没被水压碎。', icon: P('M4 16a8 8 0 0 1 16 0zM7 16l2.5-6M12 16V9M17 16l-2.5-6') },
  { id: 'chalk', name: '白垩块', tier: 1, rank: JUNK, price: 5, w: 1, h: 1, kind: '工具', desc: '能在岩壁上划记号。划一次少一块。', icon: P('M6 17l7-11 5 3-7 11z') },
  { id: 'glass', name: '玻璃珠', tier: 1, rank: JUNK, price: 6, w: 1, h: 1, kind: '材料', desc: '里面有一道裂纹，像有人指了个方向。', icon: P('M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM9 10a3 3 0 0 1 3-3') },
  // 四級遗物：最常见的一档，值几个钱
  { id: 'compass', name: '星之罗盘', tier: 2, rank: '四級遺物', relic: true, price: 180, w: 1, h: 1, kind: '遗物', desc: '指针不指北，指持有者最想见的人。所以它值不了多少钱——但没人肯卖。', icon: P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 5-4 2 2-5z') },
  { id: 'sun', name: '太阳玉', tier: 2, rank: '四級遺物', relic: true, price: 220, w: 1, h: 1, kind: '遗物', desc: '白天亮一点，夜里暗一点。捂着它睡会觉得暖。', icon: P('M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19') },
  // 一級
  { id: 'wedge', name: '千人楔', tier: 5, rank: '一級遺物', relic: true, price: 4500, minDepth: 1350, w: 1, h: 1, kind: '遗物', desc: '插进石缝里就再也拔不出来，一千个人也拔不出来。', icon: P('M12 3l4 6-4 12-4-12zM8 9h8') },
  { id: 'lens', name: '观测不可见光的眼镜', tier: 5, rank: '一級遺物', relic: true, price: 3200, minDepth: 1350, w: 1, h: 1, kind: '工具', desc: '戴上能看见看不见的光。代价是看得见的东西都变淡了。', icon: P('M3 12a3 3 0 1 1 6 0M15 12a3 3 0 1 1 6 0M9 12h6M2 9l1 3M22 9l-1 3') },

  // ---- 1×2：长的、立着的
  { id: 'weed', name: '海藻', tier: 1, rank: JUNK, price: 2, w: 1, h: 2, kind: '食物', desc: '能吃。嚼起来像湿绳子，咽下去胃里会暖一会儿。', use: { label: '吃下去', heal: 6 }, icon: P('M12 20c-4-3-4-8 0-11M12 20c4-3 4-8 0-11M8 4c2 3 2 5 4 6') },
  { id: 'jar', name: '密封罐', tier: 1, rank: JUNK, price: 8, w: 1, h: 2, kind: '材料', desc: '罐口封着。摇一摇，里面有东西在响。', icon: P('M8 6h8v13H8zM8 6a4 3 0 0 1 8 0M10 10h4') },
  // 一級 / 特級：小件，值大钱
  { id: 'cup', name: '制造水的杯子', tier: 5, rank: '一級遺物', relic: true, price: 2800, minDepth: 1350, w: 1, h: 2, kind: '工具', desc: '放一夜，杯里就有水。水是凉的，喝不出从哪来的。', icon: P('M6 8h12l-1.5 12h-9zM9 8c0-3 6-3 6 0M12 11v6') },
  { id: 'shears', name: '切割钢铁的剪刀', tier: 5, rank: '一級遺物', relic: true, price: 2600, minDepth: 1350, w: 1, h: 2, kind: '工具', desc: '剪铁像剪纸。剪完刀刃会自己合上。', icon: P('M7 3l9 14M17 3L8 17M6 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z') },
  { id: 'liquor', name: '延长寿命的酒', tier: 6, rank: '特級遺物', price: 12000, minDepth: 4000, w: 1, h: 2, kind: '食物', desc: '喝一口，身体会以为自己还年轻。第二口就没那么灵了。', use: { label: '喝一口', heal: 30 }, icon: P('M10 3h4v5l3 3v10H7V11l3-3zM7 14h10') },

  // ---- 1×3 / 2×2
  { id: 'cord', name: '断绳', tier: 1, rank: JUNK, price: 4, w: 1, h: 3, kind: '工具', desc: '断了三分之一，剩下那截还能撑个人。', icon: P('M12 2c-4 5 4 8 0 12s4 6 0 10') },
  { id: 'spear', name: '断裂的长矛', tier: 1, rank: JUNK, price: 6, w: 1, h: 3, kind: '材料', desc: '矛头还是铁的，杆子已经朽了。', icon: P('M12 21V6M12 6l-2 4h4zM9 12h6') },
  { id: 'thread', name: '绝对无法切断的线', tier: 6, rank: '特級遺物', relic: true, price: 8500, minDepth: 7000, w: 1, h: 3, kind: '材料', desc: '找不到断口，也烧不断。整根线只有一头，另一头不知道在哪。', icon: P('M12 2c-5 4 5 7 0 11s5 5 0 9') },
  { id: 'sand', name: '墨砂', tier: 3, rank: '三級遺物', relic: true, price: 380, w: 2, h: 2, kind: '材料', desc: '碰到水就化开，能把一整条路染黑。', icon: P('M12 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM18 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z') },
  { id: 'vane', name: '风信鸡', tier: 4, rank: '二級遺物', relic: true, price: 900, w: 2, h: 2, kind: '遗物', desc: '会自己转向，指的方向总有风。深渊里没人信风。', icon: P('M4 20h16M12 20V8M12 8l5 2-5 2z') },
  { id: 'hammer', name: '无尽锤', tier: 5, rank: '一級遺物', relic: true, price: 5200, minDepth: 2600, w: 2, h: 2, kind: '工具', desc: '挥出去的力不会用完，所以叫无尽。谁挥的，力气就算谁的。', icon: P('M5 4h9v5H5zM9 9v11M4 20h10') },

  // ---- 2×3：占半个背包
  { id: 'hide', name: '兽皮', tier: 1, rank: JUNK, price: 24, w: 2, h: 3, kind: '材料', desc: '带毛，没鞣过。又大又腥，值不了几个钱。', icon: P('M4 5c6 2 10-2 16 0v14c-6-2-10 2-16 0z') },
  { id: 'umbrella', name: '鳞伞', tier: 2, rank: '四級遺物', relic: true, price: 150, w: 2, h: 3, kind: '工具', desc: '撑开是一把全是鳞片的伞，能挡一层落石。占地方，不值钱。', icon: P('M3 11a9 9 0 0 1 18 0zM12 11v7a2 2 0 0 0 4 0') },
  { id: 'gauze', name: '雾织纱', tier: 3, rank: '三級遺物', relic: true, price: 420, w: 2, h: 3, kind: '遗物', desc: '薄得看不见织法。隔着它看东西，会慢半拍。', icon: P('M4 6c4 2 8-2 12 0M4 11c4 2 8-2 12 0M4 16c4 2 8-2 12 0') },

  // ---- 3×2 / 3×3：要专门腾块地方
  { id: 'echo', name: '生命回响之石', tier: 4, rank: '二級遺物', relic: true, price: 1400, minDepth: 2600, w: 3, h: 2, kind: '遗物', desc: '贴在耳朵上，能听见很远的地方有心跳。数得清的都还是活的。', icon: P('M12 3l7 4v8l-7 4-7-4V7zM8 11h3l1-2 1 4 1-2h2') },
  { id: 'basket', name: '免除诅咒的篮子', tier: 5, rank: '一級遺物', relic: true, price: 6000, minDepth: 2600, w: 3, h: 3, kind: '工具', desc: '躲进去，上升的诅咒就落不到身上。只装得下一个人。', icon: P('M4 9h16l-2 11H6zM4 9l3-5h10l3 5M9 9v11M15 9v11M4 14h16') },
  { id: 'clock', name: '停止时间的钟', tier: 6, rank: '特級遺物', relic: true, price: 9000, minDepth: 4000, w: 3, h: 3, kind: '遗物', desc: '钟停了以后，钟里的那点地方就不动了。谁也不知道为什么。', icon: P('M12 4a6 6 0 0 1 6 6v5l2 3H4l2-3v-5a6 6 0 0 1 6-6zM12 21v-3M12 8v4l3 2') },

  // ---- 4×4：一趟只背得动一件
  { id: 'sarcophagus', name: '小石棺', tier: 6, rank: '不明遺物', price: 18000, minDepth: 7000, w: 4, h: 4, relic: true, kind: '遗物', desc: '石头的棺，小得只装得下一个孩子。盖子上有一排刻痕，数不清。', icon: P('M5 4h14v16H5zM5 9h14M12 4v16') },
  { id: 'chair', name: '精神隶属机', tier: 6, rank: '特級遺物', relic: true, price: 40000, minDepth: 12000, w: 4, h: 4, kind: '遗物', desc: '能把一个人的意识塞进另一个身体里。谁用过这件事，谁就不肯说。', icon: P('M4 8h16v10H4zM7 8V5h10v3M8 12h2M14 12h2M8 15h8') },

  // ---- 遗物（未鉴定）：深渊里只看得见形状
  { id: 'rel-fang', name: '不知名的牙', tier: 3, rank: '不明遺物', price: 600, w: 1, h: 1, relic: true, kind: '遗物', desc: '一串牙，属于什么东西不知道。摸着还是温的。', icon: P('M8 5c3 2 5 8 4 15-2-4-4-6-6-7 0-4 1-6 2-8z') },
  { id: 'rel-orb', name: '雾球', tier: 4, rank: '不明遺物', price: 1200, w: 1, h: 1, relic: true, kind: '遗物', desc: '里面有雾在慢慢转，摇不散，也倒不出来。', icon: P('M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8 12h8M12 8v8') },
  { id: 'rel-bell', name: '无声铃', tier: 4, rank: '不明遺物', price: 2000, w: 2, h: 2, relic: true, kind: '遗物', desc: '摇它没有声音，但耳朵里会响一下。响的那一下，周围会安静。', icon: P('M12 4a5 5 0 0 1 5 5v6l2 3H5l2-3V9a5 5 0 0 1 5-5zM12 21v-3') },
];

/**
 * 采集物
 * ------------------------------------------------------------------
 * 路上捡的**水、果子、菌、肉、蛋**——不是遗物，认得出来，当场就能吃喝。
 *
 * 为什么单开一栏：原来的池子 31 件里 21 件是遗物（抽到就是钱），一层只有 58%
 * 落在杂物以外，走两步就捡到遗物，「稀有」这两个字就不成立了。现在采集轨和
 * 遗物轨分开抽（见 RELIC_SHARE）：浅层主要是**活着**，不是发财。
 *
 * 三值 = 饱食 / 解渴 / 回血，负数就是代价。依据是原著各层的生态：
 *   一层「接近表层的城镇，遗物多半是小型物品」→ 只有水和最普通的东西
 *   二层「经常起雾，相当多诱惑野兽；下层有倒立森林」→ 菌、雾果、兽肉
 *   三层「有不少小生物挖出的地洞」→ 鸟蛋、巢卵、石缝菌
 *   四层「有许多酒杯状的巨型食虫植物」→ 花蜜、被消化的猎物
 *   五层「覆盖着白色的水，水中有许多遗骸堆积」→ 白海水（解渴最高，但掉血）
 *   六层「巨大生物」+ 黄金乡废墟 → 巨型生物肉、贡品、假水
 *
 * 采集物**不能标 relic**：未鉴定的东西在检视面板里是禁止吃的（见 inspect.ts）。
 */
const FORAGE: (LootKind & { minDepth?: number; maxDepth?: number })[] = [
  // ---- 一层：阿比斯之渊。只有水和最普通的东西
  { id: 'spring', name: '溪水', tier: 1, rank: '采集', price: 3, minDepth: 0, maxDepth: 2600, w: 1, h: 1, kind: '食物', desc: '表层溪沟里的活水。这一层唯一能放心直接喝的东西。', use: { label: '喝一口', thirst: 18 }, icon: P('M12 3c4 6 6 8 6 11a6 6 0 0 1-12 0c0-3 2-5 6-11z') },
  { id: 'seep', name: '岩壁渗水', tier: 1, rank: '采集', price: 2, minDepth: 0, maxDepth: 2600, w: 1, h: 1, kind: '食物', desc: '顺着石缝渗出来的，接半天才够一口。聊胜于无。', use: { label: '接一口', thirst: 12 }, icon: P('M8 4c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6zM17 9c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z') },
  { id: 'root', name: '根茎', tier: 1, rank: '采集', price: 5, minDepth: 0, maxDepth: 2600, w: 1, h: 1, kind: '食物', desc: '从岩缝里撬出来的。难嚼，但顶一会儿饿。', use: { label: '啃了', hunger: 8, thirst: 2 }, icon: P('M12 21V9M12 12l-4-3M12 15l4-3M9 8c0-2 6-2 6 0') },
  { id: 'berry', name: '层间果', tier: 1, rank: '采集', price: 8, minDepth: 0, maxDepth: 2600, w: 1, h: 1, kind: '食物', desc: '灌木上的小果子，酸甜都有一点。这一层最像「食物」的东西。', use: { label: '吃了', hunger: 10, thirst: 8 }, icon: P('M12 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 8V5M12 5c2-2 4-1 4-1') },
  // ---- 二层：诱惑森林（倒立森林 + 野兽）
  { id: 'shroom', name: '倒立森林的菌', tier: 1, rank: '采集', price: 14, minDepth: 1350, maxDepth: 7000, w: 1, h: 2, kind: '食物', desc: '长在倒着长的树根上，挖出来还是凉的。最顶饿的素东西。', use: { label: '吃了', hunger: 18, heal: 3 }, icon: P('M5 12a7 5 0 0 1 14 0zM12 12v6M9 18h6') },
  { id: 'fogfruit', name: '雾果', tier: 1, rank: '采集', price: 16, minDepth: 1350, maxDepth: 7000, w: 1, h: 1, kind: '食物', desc: '雾里结的，皮上一层水汽，咬开会出水。这一层最解渴的。', use: { label: '吃了', hunger: 8, thirst: 10 }, icon: P('M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM6 20h12') },
  { id: 'beastmeat', name: '兽肉', tier: 2, rank: '采集', price: 30, minDepth: 1350, maxDepth: 7000, w: 2, h: 2, kind: '食物', desc: '被雾里那些东西追过之后，反过来的那一半。生肉顶饿，但越吃越渴。', use: { label: '生吃', hunger: 28, thirst: -6 }, icon: P('M6 8c4-3 9-3 12 0 2 2 2 6 0 8-4 3-9 3-12 0-2-2-2-6 0-8zM10 11h4') },
  // ---- 三层：大断层（小生物的地洞）
  { id: 'egg', name: '地洞鸟蛋', tier: 2, rank: '采集', price: 40, minDepth: 2600, maxDepth: 12000, w: 1, h: 2, kind: '食物', desc: '从峭壁的洞里摸出来的，还是温的。好东西，得先爬上去。', use: { label: '生吞', hunger: 20, thirst: 4, heal: 2 }, icon: P('M12 5c4 0 6 4 6 8s-3 6-6 6-6-2-6-6 2-8 6-8zM9 12c1 2 5 2 6 0') },
  { id: 'nestegg', name: '巢卵', tier: 2, rank: '采集', price: 36, minDepth: 2600, maxDepth: 12000, w: 1, h: 2, kind: '食物', desc: '一串小的，运气好一窝能掏七八个。', use: { label: '嚼了', hunger: 18, thirst: 2, heal: 1 }, icon: P('M8 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM16 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z') },
  { id: 'crack', name: '石缝菌', tier: 2, rank: '采集', price: 22, minDepth: 2600, maxDepth: 12000, w: 1, h: 1, kind: '食物', desc: '贴着一整面墙长。刮下来是一团，比根茎好吃一点。', use: { label: '刮下来吃', hunger: 15, heal: 2 }, icon: P('M4 14h16M8 14V9M16 14V9M8 9h8') },
  // ---- 四层：巨人之杯（酒杯状食虫植物）
  { id: 'nectar', name: '酒杯花蜜', tier: 3, rank: '采集', price: 220, minDepth: 7000, maxDepth: 13000, w: 1, h: 2, kind: '食物', desc: '那朵杯子底部积的一点。甜得发苦，喝完身上会暖一阵——这一层最好的回血品。', use: { label: '喝掉', hunger: 8, thirst: 14, heal: 12 }, icon: P('M6 5h12l-2 6H8zM12 11v7M9 18h6') },
  { id: 'digest', name: '被消化的猎物', tier: 3, rank: '采集', price: 180, minDepth: 7000, maxDepth: 13000, w: 2, h: 2, kind: '食物', desc: '杯子底下还没化完的东西。想活着爬上四层，很多人靠的就是它。', use: { label: '吃下去', hunger: 40, heal: 6 }, icon: P('M5 9c3-4 9-4 12 0M5 9v6c3 4 9 4 12 0V9M9 13h.01M15 13h.01') },
  // ---- 五层：亡骸之海（白色的水）
  { id: 'whitewater', name: '白海水', tier: 2, rank: '采集', price: 60, minDepth: 12000, maxDepth: 13000, w: 1, h: 1, kind: '食物', desc: '这一层的海是白的，因为水里有太多没化完的东西。解渴最厉害，代价是掉血——带灯火就烧开再喝。', use: { label: '就着喝', thirst: 30, heal: -12 }, purify: { label: '烧开再喝', need: 'lamp', thirst: 26, heal: 4 }, icon: P('M4 8c4 2 12 2 16 0M4 13c4 2 12 2 16 0M4 18c4 2 12 2 16 0') },
  // ---- 六层：来无回之都（黄金乡）
  { id: 'giantmeat', name: '巨型生物肉', tier: 4, rank: '采集', price: 400, minDepth: 13000, maxDepth: 99999, w: 2, h: 3, kind: '食物', desc: '从六层那些东西身上割下来的。一块够吃很久，代价是咽下去之后特别渴。', use: { label: '生吃', hunger: 45, thirst: -10, heal: 5 }, icon: P('M5 7c4-3 10-3 14 0v10c-4 3-10 3-14 0zM8 12h8') },
  { id: 'falsewater', name: '假水', tier: 4, rank: '危险', price: 500, minDepth: 13000, maxDepth: 99999, w: 1, h: 1, kind: '食物', desc: '看着是水，舀起来也是水。喝下去能顶一阵，然后人就该倒下了——敢死队就是这么没的。', use: { label: '当水喝', hunger: 40, thirst: 40, heal: -35 }, icon: P('M12 3c4 6 6 8 6 11a6 6 0 0 1-12 0c0-3 2-5 6-11zM9 14l3 2 3-2') },
  { id: 'offering', name: '废墟贡品', tier: 3, rank: '采集', price: 300, minDepth: 13000, maxDepth: 99999, w: 1, h: 1, kind: '食物', desc: '摆在空城某张桌子上的东西，几千年没坏。吃下去心里有点过意不去。', use: { label: '吃了', hunger: 25, thirst: 15, heal: 5 }, icon: P('M6 8h12l-2 11H8zM9 8V6h6v2M10 12h4') },
];

/** 各深度的档位权重：杂物 四級 三級 二級 一級 特級。越深越往右偏 */
const WEIGHTS: { until: number; w: [number, number, number, number, number, number] }[] = [
  { until: 1350, w: [58, 27, 11, 3, 1, 0] }, // 一层
  { until: 2600, w: [46, 30, 16, 6, 2, 0] }, // 二层
  { until: 7000, w: [33, 26, 22, 13, 5, 1] }, // 三层
  { until: 12000, w: [24, 20, 25, 18, 10, 3] }, // 四层
  { until: 13000, w: [18, 16, 23, 21, 15, 7] }, // 五层
  { until: 15500, w: [13, 13, 20, 22, 20, 12] }, // 六层
  { until: 99999, w: [9, 10, 17, 20, 24, 20] }, // 七层往下
];

let seq = 0;
const rand = (n: number): number => Math.floor(Math.random() * n);

/**
 * 这一米捡到的是**遗物**的概率（其余全是采集物/杂物）。
 *
 * 原来是"一个池子抽档次"，一层就有 42% 是遗物、27% 是四級遗物——
 * 走两步捡一件，捡到紫色也只值 150，稀有感就没法建立。
 * 现在先掷这一下：浅层主要是活着，越往下遗物才越密。
 */
const RELIC_SHARE: { until: number; p: number }[] = [
  { until: 1350, p: 0.08 }, // 一层
  { until: 2600, p: 0.14 }, // 二层
  { until: 7000, p: 0.22 }, // 三层
  { until: 12000, p: 0.32 }, // 四层
  { until: 13000, p: 0.4 }, // 五层
  { until: 15500, p: 0.48 }, // 六层
  { until: 99999, p: 0.55 }, // 七层往下
];

/**
 * 遗物品级封顶：这一层**最贵只能出到 tier 几**。
 * 特級 = 原著里"足以改变世界"的东西，一层土里刨出来就不值钱了。
 */
const RELIC_CAP: { until: number; max: Tier }[] = [
  { until: 1350, max: 3 }, // 一层最多三級
  { until: 2600, max: 4 }, // 二层最多二級
  { until: 7000, max: 5 }, // 三层才可能见一級
  { until: 99999, max: 6 }, // 四层起才可能有特級
];

/** 原著：一层「遗物多半是小型物品」。这里按占格算，一层只出 2×2 以内 */
const SHALLOW_SMALL_UNTIL = 1350;
const SHALLOW_MAX_CELLS = 4;

/** 采集轨的候选：杂物 + 采集物（都不是遗物，认得出来） */
const GROUND: (LootKind & { minDepth?: number; maxDepth?: number })[] = [
  ...POOL.filter((p) => p.rank === JUNK),
  ...FORAGE,
];

/** 遗物轨的候选：POOL 里标了 relic 的那些 */
const RELICS: (LootKind & { minDepth?: number })[] = POOL.filter((p) => p.relic === true);

/** 遗物轨里按深度抽档次：只在本层封顶以内的档位之间按权重掷 */
const pickRelicTier = (depth: number, cap: Tier): Tier => {
  const row = WEIGHTS.find((r) => depth < r.until) ?? WEIGHTS[WEIGHTS.length - 1];
  const 候选: { tier: Tier; w: number }[] = [];
  for (let t = 2; t <= cap; t++) 候选.push({ tier: t as Tier, w: row.w[t - 1] });
  const total = 候选.reduce((a, x) => a + x.w, 0) || 1;
  let roll = Math.random() * total;
  for (const x of 候选) {
    roll -= x.w;
    if (roll <= 0) return x.tier;
  }
  return 候选[候选.length - 1].tier;
};

/** 抽一件采集物（地面上的东西）：只受出现深度限制，不分档次 */
function pickGround(depth: number): LootKind {
  const 可 = GROUND.filter(
    (p) => (!p.minDepth || depth >= p.minDepth) && (!p.maxDepth || depth < p.maxDepth),
  );
  const pool = 可.length ? 可 : GROUND;
  return pool[rand(pool.length)] as LootKind;
}

/** 抽一件遗物：封顶 + 出现深度 + 浅层只出小件 */
function pickRelic(depth: number): LootKind {
  const cap = (RELIC_CAP.find((r) => depth < r.until) ?? RELIC_CAP[RELIC_CAP.length - 1]).max;
  const 可 = RELICS.filter(
    (p) =>
      p.tier <= cap &&
      (!p.minDepth || depth >= p.minDepth) &&
      (depth >= SHALLOW_SMALL_UNTIL || p.w * p.h <= SHALLOW_MAX_CELLS),
  );
  // 兜底：万一这一层什么都没筛出来，退回"只要不超封顶"的那批，绝不返回 undefined
  const pool = 可.length ? 可 : RELICS.filter((p) => p.tier <= cap);
  const tier = pickRelicTier(depth, cap);
  const sameTier = pool.filter((p) => p.tier === tier);
  const 最后 = sameTier.length ? sameTier : pool;
  return 最后[rand(最后.length)] as LootKind;
}

/**
 * 按深度抽一件：先掷「遗物 / 采集物」，再各自抽。
 * 采集物当场可吃可喝；遗物一律未鉴定（名字是 ？？？，回奥斯才揭晓）。
 */
export function rollLoot(depth: number): Loot {
  const share = (RELIC_SHARE.find((r) => depth < r.until) ?? RELIC_SHARE[RELIC_SHARE.length - 1]).p;
  const kind = Math.random() < share ? pickRelic(depth) : pickGround(depth);
  seq += 1;
  return { ...kind, uid: `${kind.id}-${seq}`, unknown: kind.relic === true, foundDepth: depth };
}

/** 颜色：白 → 绿 → 蓝 → 紫 → 金 → 红（特級） */
export const TIER_COLOR: Record<Tier, string> = {
  1: '#9d978c',
  2: '#8fbf5a',
  3: '#5aa8e0',
  4: '#b07ce8',
  5: '#e8b23c',
  6: '#e0523c',
};

/** 价格印成 1,240 这样 */
export const money = (n: number): string => Math.round(n).toLocaleString('en-US');

/**
 * 补给
 * ------------------------------------------------------------------
 * 暗黑地牢那套：每一样都对着一种「可预见的麻烦」，
 * 而且每一样都占你背战利品的格子。
 *
 * 补给**不能卖**（sell: 0），所以结算时它们不换钱——买多了就是白扔。
 */
export const PROVISIONS: LootKind[] = [
  { id: 'ration', name: '干粮', tier: 1, rank: '补给', price: 120, sell: 0, provision: true, w: 1, h: 1, kind: '补给', desc: '压得很硬的一小块。吃一份顶 25 点饿。自己按，不按就一直饿着。', use: { label: '吃一份', hunger: 25 }, icon: P('M6 8h12l-1 10H7zM6 8c0-2 12-2 12 0M9 12h6') },
  { id: 'water', name: '水', tier: 1, rank: '补给', price: 60, sell: 0, provision: true, w: 1, h: 1, kind: '补给', desc: '一袋水。喝一份顶 25 点渴。深渊里的水不能就地取。', use: { label: '喝一份', thirst: 25 }, icon: P('M10 4h4v3l2 3v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10l2-3z') },
  { id: 'medkit', name: '医疗包', tier: 1, rank: '补给', price: 400, sell: 0, provision: true, w: 1, h: 2, kind: '补给', desc: '绷带、针、一点止痛药。自己按，回 15。', use: { label: '包扎', heal: 15 }, icon: P('M4 8h16v10H4zM9 8V6h6v2M12 11v4M10 13h4') },
  { id: 'lamp', name: '灯火', tier: 1, rank: '补给', price: 300, sell: 0, provision: true, w: 1, h: 1, kind: '补给', desc: '一支能烧一层的东西。三层以下没它就是在黑里走。', icon: P('M12 3v2M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0zM12 16v4M6 8l1.5 1.5M18 8l-1.5 1.5') },
  { id: 'rope', name: '绳索', tier: 1, rank: '补给', price: 250, sell: 0, provision: true, w: 1, h: 2, kind: '补给', desc: '够垂下一段断层的长度。没带也能下，代价另算。', icon: P('M6 4c6 3-6 6 0 8s-6 5 0 8') },
  { id: 'hardtack', name: '硬口粮', tier: 1, rank: '补给', price: 800, sell: 0, provision: true, w: 1, h: 1, kind: '补给', desc: '难吃，但顶饿。一份顶 45 点饿。', use: { label: '啃一块', hunger: 45 }, icon: P('M5 9h14v8H5zM8 9V6h8v3M8 13h8') },
];

let pseq = 0;

/** 从货架上拿一份补给（还没付钱） */
export function makeProvision(id: string): Loot | null {
  const kind = PROVISIONS.find((p) => p.id === id);
  if (!kind) return null;
  pseq += 1;
  return { ...kind, uid: `${kind.id}-p${pseq}`, unknown: false };
}

/**
 * 深层加成：原著六层「凡是所有物品来到那里都能变得非常有价值」。
 * 按**捡到的深度**算，不按卖的时候在哪 —— 值钱的是"从那么深带回来"这件事本身。
 */
const DEEP_BONUS: { from: number; mult: number }[] = [
  { from: 15500, mult: 2 },
  { from: 13000, mult: 1.5 },
];

/** 卖价：补给是 0，其余按 price × 深层加成 */
export const sellOf = (loot: Loot): number => {
  const base = loot.sell ?? loot.price;
  if (!base || loot.provision) return 0;
  const mult = DEEP_BONUS.find((b) => (loot.foundDepth ?? 0) >= b.from)?.mult ?? 1;
  return Math.round(base * mult);
};

/**
 * 鉴定费：带回奥斯的遗物要花钱让人看。档次越高看得越贵。
 * 未鉴定是**赌**，不是白捡——捡到一級遗物的那一刻，账已经欠下了。
 */
const APPRAISE_RATE: Record<Tier, number> = { 1: 0, 2: 0.05, 3: 0.08, 4: 0.1, 5: 0.15, 6: 0.2 };

export const appraiseFee = (loot: Loot): number =>
  loot.unknown ? Math.round(sellOf(loot) * APPRAISE_RATE[loot.tier]) : 0;

export const provisionOf = (loot: Loot): LootKind | undefined =>
  loot.provision ? PROVISIONS.find((p) => p.id === loot.id) : undefined;

// 调试用：控制台里 __loot(14000) 抽一件看看
(window as unknown as { __loot: unknown }).__loot = rollLoot;
