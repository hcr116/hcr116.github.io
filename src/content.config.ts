import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 作品集合。
 * 每个 .md 文件 = 一个作品，文件名就是网址 slug。
 * 例如 01-dashboard-rework.md  →  /works/01-dashboard-rework/
 */
const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    /** 作品标题 */
    title: z.string(),

    /** 一句话说明：解决了什么问题 / 做成了什么（列表页与详情页都会显示） */
    summary: z.string(),

    /** 年份，写成 "2024" 或 "2024.06" 这样的字符串 */
    year: z.string(),

    /** 你在这件事里的角色 */
    role: z.string().optional(),

    /** 用到的工具 / 技术，显示为标签 */
    tags: z.array(z.string()).default([]),

    /** 封面图，放在 public/images/ 下，写成 /images/xxx.jpg */
    cover: z.string().optional(),

    /** 封面图的替代文字（无障碍与 SEO） */
    coverAlt: z.string().default(''),

    /**
     * 演示视频嵌入地址。
     * B 站：//player.bilibili.com/player.html?bvid=BVxxxxxxxxxx&page=1&high_quality=1
     * YouTube：https://www.youtube.com/embed/VIDEO_ID
     * 留空则不显示视频区块。
     */
    video: z.string().optional(),

    /** 说明文档列表；文件放在 public/docs/ 下 */
    docs: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),

    /** 列表页排序，数字越大越靠前 */
    order: z.number().default(0),

    /** 设为 true 时不会出现在站点上 */
    draft: z.boolean().default(false),
  }),
});

/**
 * AI 功能：作品里「AI 功能」那个方向下的具体项目。
 * 每个 .md 文件 = 一个项目，文件名就是网址 slug（/works/ai/<slug>/）。
 *
 * 正文（body）按四节写：介绍 / 设计目的 / 怎么做的 / 踩了什么坑。
 * 页面会自动从正文的 ## 小标题生成右侧目录，所以别用别的级别当分节。
 */
const ai = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ai' }),
  schema: z.object({
    /** 项目名，卡片和详情页标题 */
    title: z.string(),

    /** 英文名，卡片右下角的小字 */
    en: z.string().default(''),

    /** 一句话说明，列表卡片与详情页顶部都用 */
    summary: z.string(),

    /** 年份，写成 "2026" 或 "2026.03" */
    year: z.string().default(''),

    /** 现在的状态 */
    state: z.enum(['自用中', '已上线', '实验中', '搁置']).default('自用中'),

    /** 用到的技术，显示成标签 */
    stack: z.array(z.string()).default([]),

    /** 代码不公开：详情页顶部挂一条提示 */
    private: z.boolean().default(true),

    /** 未公开：列表里显示成跳动的乱码，点一下弹【权限不足】然后消失，也不生成详情页 */
    locked: z.boolean().default(false),

    /** 演示视频嵌入地址，留空则不显示视频块 */
    video: z.string().optional(),

    /** 截图。blur: true 的默认盖住，点一下才显示 */
    shots: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().default(''),
          blur: z.boolean().default(false),
        }),
      )
      .default([]),

    /** 排序，数字越大越靠前 */
    order: z.number().default(0),

    /** 设为 true 时不出现在站上 */
    draft: z.boolean().default(false),
  }),
});

/**
 * 关于页的自述正文。
 * 只有一个文件，正文用 Markdown 写，改文案不用碰模板。
 */
const about = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/about' }),
  schema: z.object({}),
});

/**
 * 站点设置：背景音乐。
 */
const settings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/settings' }),
  schema: z.object({
    /** 背景音乐路径，如 /audio/bgm.mp3。留空则不显示喇叭按钮 */
    bgm: z.string().optional().default(''),
    /** 音量 0-100 */
    bgmVolume: z.number().min(0).max(100).default(35),
  }),
});

export const collections = { works, ai, about, settings };
