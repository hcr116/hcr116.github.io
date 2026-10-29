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
  version: 'v0.4',
  iteration: 4,
  updated: '2026-10-28',
};

/**
 * 深渊的区域分层。
 *
 * 深度跨过 from 就换一个区域名，显示在右上角；跨层的瞬间会有一次
 * 数字跳动 + 区域名浮入的过场（见 dive-scroll.ts 的 crossZone）。
 *
 * 不填的话右上角不出现这一行，其他一切照常。
 * 名字想换成自己的，改这里就行，长度不限。
 */
export const ABYSS_ZONES: { from: number; name: string }[] = [
  { from: 0, name: 'Ⅰ · 潮线' },
  { from: 1500, name: 'Ⅱ · 回声带' },
  { from: 3000, name: 'Ⅲ · 无光带' },
  { from: 5000, name: 'Ⅳ · 压密层' },
  { from: 7000, name: 'Ⅴ · 底' },
];

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
