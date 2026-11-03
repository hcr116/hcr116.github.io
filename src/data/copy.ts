/**
 * 文案取值
 * ------------------------------------------------------------------
 * 所有短文案都从 src/data/copy.csv 来（构建时由 scripts/copy-import.mjs 导入）。
 * 页面里这样用：
 *
 *   t('ui.back', '返回')                 // 表里没有就用第二个参数兜底
 *   tf('ui.imported', { n: 5 }, '已导入 {n} 个')
 *
 * 为什么每个调用都带兜底字：表里删掉一行不该让页面变成空白，
 * 那样你半夜改表改崩了都不知道哪一条。兜底字就是最后一道保险。
 */

import { COPY } from './copy.generated';

/**
 * 取一条文案
 *
 * 表里「有这一行」就用表里的值（哪怕 zh 是空的 —— 空表示"这条先不显示"）；
 * 表里「没这一行」才用兜底字。所以"清空"和"删行"是两种意思。
 */
export function t(id: string, fallback = ''): string {
  return id in COPY ? COPY[id] : fallback;
}

/** 取一条文案并把 {n} 之类的占位换掉 */
export function tf(id: string, vars: Record<string, string | number>, fallback = ''): string {
  return t(id, fallback).replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}
