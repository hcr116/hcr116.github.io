/**
 * 特效作品存档（VFX ARCHIVE）的条目
 * ------------------------------------------------------------------
 * 视频在 public/video/vfx/，由 scripts/vfx.mjs 从原始录屏压出来：
 *
 *   node scripts/vfx.mjs "<源目录>" --smart --by-time --width 1280 --crf 24
 *
 * --smart 的意思：不超过 2.5MB 的只换封装（画质零损失），超了才重编码。
 *
 * 显示规则：格子上写 `date + label`，也就是「2023年11月 命中」。
 * date 单独存着，以后做详情页/时间轴能直接用，不用去拆字符串。
 */

export type VfxItem = {
  /** 编号，显示成 VFX 01 */
  id: string;
  /** 时间 */
  date: string;
  /** 标题 */
  label: string;
  /** 一行说明：解决什么问题 / 怎么做的 */
  note: string;
  /** 时长标签 */
  dur: string;
  /** 视频路径；没文件就留空 */
  src: string;
  /** 封面 */
  poster: string;
  /** 文件是否已经到位 */
  ready: boolean;
};

export const vfxItems: VfxItem[] = [
  {
    id: '01',
    date: '2023年11月',
    label: '命中',
    note: '待补：怎么做的',
    dur: '0:06',
    src: '/video/vfx/vfx-01.mp4',
    poster: '/video/vfx/vfx-01.jpg',
    ready: true,
  },
  {
    id: '02',
    date: '2023年11月',
    label: '蓄力',
    note: '待补：怎么做的',
    dur: '0:07',
    src: '/video/vfx/vfx-02.mp4',
    poster: '/video/vfx/vfx-02.jpg',
    ready: true,
  },
  {
    id: '03',
    date: '2023年11月',
    label: '场域',
    note: '待补：怎么做的',
    dur: '0:10',
    src: '/video/vfx/vfx-03.mp4',
    poster: '/video/vfx/vfx-03.jpg',
    ready: true,
  },
  {
    id: '04',
    date: '2023年11月',
    label: '爆点',
    note: '待补：怎么做的',
    dur: '0:11',
    src: '/video/vfx/vfx-04.mp4',
    poster: '/video/vfx/vfx-04.jpg',
    ready: true,
  },
  {
    id: '05',
    date: '2023年11月',
    label: '坠地',
    note: '待补：怎么做的',
    dur: '0:09',
    src: '/video/vfx/vfx-05.mp4',
    poster: '/video/vfx/vfx-05.jpg',
    ready: true,
  },
];

/** 已经到位的条目数（作品页那句「已导入 N 个」用它） */
export function countVfx(): number {
  return vfxItems.filter((v) => v.ready && v.src).length;
}
