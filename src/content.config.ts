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
 * 时间线。
 * 每个 .md 文件 = 时间线上的一个节点。
 * 文件名随意（只用来区分），排序看 year 字段。
 */
const timeline = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/timeline' }),
  schema: z.object({
    /** 时间标签：'至今'、'2025'、'2024' …… 显示在左侧刻度上 */
    year: z.string(),

    /** 这一段的小标题，可留空 */
    title: z.string().optional(),

    /** 设为 true 时这一条不显示 */
    draft: z.boolean().default(false),
  }),
});

export const collections = { works, timeline };
