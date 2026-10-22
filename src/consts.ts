/**
 * 全站唯一的「个人信息」配置。
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
  links: [{ label: 'Bilibili · horob', href: 'https://space.bilibili.com/4592990' }],

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
