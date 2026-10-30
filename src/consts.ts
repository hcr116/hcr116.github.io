/**
 * 访问统计（可选）。
 *
 * 用 GoatCounter：免费、不弹 cookie 同意、后台直接看每页浏览量。
 * 拿到站点 code 之后填进来就会自动生效，留空则完全不加载任何脚本。
 *
 * 开通步骤：
 *   1. https://www.goatcounter.com/signup 注册，code 就是子域名前缀
 *   2. 把 code 填到下面（也可以填完整子域名，如 'hcr' → hcr.goatcounter.com）
 *   3. 后台 Settings → Tracking → Ignore IPs，填上你自己的常用出口 IP
 *
 * 它默认就会忽略 localhost 和内网地址，所以本地预览不会计入。
 * 临时屏蔽自己的浏览器：在网址后面加 #toggle-goatcounter
 */
export const GOATCOUNTER = '';

/**
 * 阿比斯入口的版本信息。
 * 每次改深渊那块，把 iteration 加一、updated 改成当天，version 跟着走。
 */
export const ABYSS_META = {
  version: 'v0.6',
  iteration: 6,
  updated: '2026-10-29',
};

/**
 * 阿比斯的深度分层：直接照《来自深渊》原作。
 *
 * 原作里一到七层 + 奈落之底，深度和上升负荷都是设定的一部分，这里原样抄过来：
 *   · from / to   这一层的深度区间（米）
 *   · ascent      每上浮 100 米扣的血——负荷越深越重，就是原作里逐层加码的「诅咒」
 *   · screens     这一层在页面上占几屏（决定「走多久」，见 abyss/metrics.ts）
 *   · drift       这层飘着什么（给行进段的上浮物用，每层不一样）
 *
 * 深度上限 20,000 米：原作里七层到 15,500 米，奈落之底推测 20,000 以上。
 * 也就是说这条路线是真的能一路潜到「底」的。
 */
export type AbyssLayer = {
  /** 罗马数字，HUD 里显示用 */
  no: string;
  name: string;
  /** 通称（原作里每层都有一个） */
  alias: string;
  from: number;
  to: number;
  /** 每上浮 100 米扣多少血 */
  ascent: number;
  /**
   * 这一层在页面上占几屏。
   *
   * 老的做法是把 20,000 米平均铺在整条路上，结果一层只占一屏多一点，
   * 滚两下就到底了。现在每层自己定长：占的屏数 / 总屏数 = 它在这条路上占的比例。
   * 改这里就是改「这一层要走多久」，别的都不用动。
   */
  screens: number;
  /** 这层飘着的东西 */
  drift: ('mote' | 'leaf' | 'vine' | 'shard' | 'egg' | 'bubble' | 'bone' | 'ash')[];
  /** 一句环境描述，给站点/记录用 */
  note: string;
};

export const ABYSS_MAX_DEPTH = 20000;

export const ABYSS_LAYERS: AbyssLayer[] = [
  {
    no: 'Ⅰ',
    name: '阿比斯之渊',
    alias: '一层',
    from: 0,
    to: 1350,
    ascent: 0.3,
    screens: 5,
    drift: ['mote', 'leaf'],
    note: '阳光还能落到底。头晕，恶心。',
  },
  {
    no: 'Ⅱ',
    name: '诱惑的森林',
    alias: '二层',
    from: 1350,
    to: 2600,
    ascent: 0.7,
    screens: 5,
    drift: ['leaf', 'vine'],
    note: '树根朝上，人朝下。头痛，指尖发麻。',
  },
  {
    no: 'Ⅲ',
    name: '大断层',
    alias: '三层',
    from: 2600,
    to: 7000,
    ascent: 1.1,
    screens: 8,
    drift: ['shard', 'egg', 'mote'],
    note: '四千米的圆壁。开始听见不存在的声音。',
  },
  {
    no: 'Ⅳ',
    name: '巨人之杯',
    alias: '四层',
    from: 7000,
    to: 12000,
    ascent: 1.8,
    screens: 8,
    drift: ['bubble', 'ash'],
    note: '荷叶上盛着热水。全身疼，血从缝里出来。',
  },
  {
    no: 'Ⅴ',
    name: '亡骸之海',
    alias: '五层',
    from: 12000,
    to: 13000,
    ascent: 3,
    screens: 4,
    drift: ['bone', 'mote'],
    note: '最短的一层，最空的一层。五感在退。',
  },
  {
    no: 'Ⅵ',
    name: '来无回之都',
    alias: '六层',
    from: 13000,
    to: 15500,
    ascent: 5,
    screens: 6,
    drift: ['ash', 'shard'],
    note: '金色的废墟。人上去就不再是人。',
  },
  {
    no: 'Ⅶ',
    name: '尽头的漩涡',
    alias: '七层',
    from: 15500,
    to: 19500,
    ascent: 9,
    screens: 8,
    drift: ['mote'],
    note: '回去等于死。',
  },
  {
    no: 'Ⅷ',
    name: '奈落之底',
    alias: '极点',
    from: 19500,
    to: ABYSS_MAX_DEPTH,
    ascent: 20,
    screens: 2,
    drift: [],
    note: '一切不明。',
  },
];

/** 取某一深度所在的层 */
export const layerAt = (depth: number): AbyssLayer => {
  for (const layer of ABYSS_LAYERS) if (depth < layer.to) return layer;
  return ABYSS_LAYERS[ABYSS_LAYERS.length - 1];
};

/** HUD 上的区域名（从分层派生，不另外维护） */
export const ABYSS_ZONES: { from: number; name: string }[] = ABYSS_LAYERS.map((l) => ({
  from: l.from,
  name: `${l.no} · ${l.name}`,
}));

/**
 * 阿比斯入口的「下潜人数」计数器。
 *
 * 用的是 abacus（免注册的公开计数 API）：GET 读、HIT 加一。
 * 换成别的服务只要改这里；请求失败时页面照常能用，只是数字显示成「—」。
 *
 * 想直接看现在有多少人下潜过，浏览器打开：
 *   https://abacus.jasoncameron.dev/get/hcr116/abyss-dive
 */
export const DIVE_COUNTER = {
  endpoint: 'https://abacus.jasoncameron.dev',
  namespace: 'hcr116',
  key: 'abyss-dive',
};

/**
 * 时间线是否对外公开。
 *
 * false 的时候三件事一起发生：
 *   1. 导航里不出现「时间线」
 *   2. /timeline/ 变成一个「暂不公开」的占位页，并且 noindex
 *   3. /brief/ 结尾那段按年份排的经历整段不渲染
 *
 * 内容文件一行都不用动，改回 true 就原样回来。
 */
export const TIMELINE_PUBLIC = false;

/**
 * 阿比斯（那个网页小游戏）开不开。
 *
 * 这是个「随时能关」的开关，不是「随时能删」。区别很重要：
 *
 *   设成 false —— /abyss/dive/ 整块游戏不渲染，只剩一句「信号中断」；
 *                 首页菜单里那一项也一起收起来；
 *                 游戏脚本还是会下载，但它们第一步就检查 DOM 在不在，直接退出，
 *                 不跑逻辑、不报错、不碰你的页面。
 *
 *   想彻底删 —— 见 docs/abyss-design.md 末尾的「拆除清单」，五分钟的事。
 */
export const ABYSS_GAME = true;

/** 全站唯一的「个人信息」配置。
 * 想改名字、简介、邮箱、联系方式 —— 只改这个文件就够了。
 */
export const SITE = {
  /** 你的名字或昵称，会出现在页头 */
  name: 'huang',

  /** 中文姓名，用在「有趣」界面的巨幅标题上 */
  cnName: '黄晨睿',

  /** 浏览器标签页标题 */
  title: 'huang · 作品归档',

  /** 首屏那句大字。最好是一句话说明你是谁 / 你在做什么 */
  tagline: '把做过的东西，放在一个地方。',

  /** 首屏大字下面的一小段说明 */
  intro:
    '我是 huang，B 站账号 horob。这里按时间倒序存放我做过的东西、写过的说明文档，还有一些过程记录。',

  /** 邮件，页头「联系」会生成 mailto 链接 */
  email: '1161408049@qq.com',

  /** 其他想放的联系方式 */
  links: [
    { label: 'Bilibili · horob', href: 'https://space.bilibili.com/4592990' },
    { label: 'GitHub · hcr116', href: 'https://github.com/hcr116' },
  ],

  /** 所在城市 / 时区之类的补充信息，可留空 */
  location: '',

  /**
   * 首页顶部的提示条文字。
   * 所有示例作品换成真内容后，把 showPlaceholderNotice 改成 false 即可。
   */
  notice: '站点内容正在陆续补充，作品还在整理中。',

  /** 是否显示上面那条提示 */
  showPlaceholderNotice: true,
};

/**
 * 微信公众号。
 * 二维码图片放在 public/images/ 下。
 */
export const WECHAT = {
  name: '做一辈子战策',
  qr: '/images/wechat-qr.jpg',
  note: '微信扫一扫，关注公众号',
};

/**
 * 「关于」页的技能分组。
 * level 用来控制视觉上的强调程度：core 最醒目，working 次之，basic 最弱。
 * 留空数组则不显示「能力」区块。
 */
export const SKILLS: { group: string; level: 'core' | 'working' | 'basic'; items: string[] }[] = [];

/**
 * 「关于」页的经历时间线。留空数组则不显示「经历」区块。
 */
export const TIMELINE: { year: string; title: string; detail: string }[] = [];
