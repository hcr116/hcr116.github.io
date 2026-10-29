/**
 * 阿比斯入口的「下潜人数」
 * ------------------------------------------------------------------
 * 进页面先读一个数（GET，不加），显示「你是第 N 个」——
 * 点「下潜」时再真正加一（HIT），这样数字统计的是**点击**，不是浏览。
 *
 * 走的是 abacus 这个免注册的公开计数 API。所有失败都静默降级：
 * 拉不到就显示「—」，点击照常进页面，绝不因为统计把用户挡在门外。
 */

import { DIVE_COUNTER } from '../consts';

function initAbyss(): void {
  const counter = document.querySelector<HTMLElement>('[data-abyss-count]');
  const enter = document.querySelector<HTMLElement>('[data-abyss-enter]');
  if (!counter && !enter) return;

  const url = (action: 'get' | 'hit'): string =>
    `${DIVE_COUNTER.endpoint}/${action}/${DIVE_COUNTER.namespace}/${DIVE_COUNTER.key}`;

  const show = (value: number | null): void => {
    if (counter) counter.textContent = value === null ? '—' : String(value);
  };

  // 读：现在已经有几个人下潜过；这个 key 还没被创建过会 404，当成 0
  fetch(url('get'), { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { value?: number } | null) => {
      const current = typeof data?.value === 'number' ? data.value : 0;
      show(current + 1);
    })
    .catch(() => show(null));

  // 写：点了「下潜」才加一。keepalive 保证页面跳走之后请求还能发完
  enter?.addEventListener('click', () => {
    void fetch(url('hit'), { cache: 'no-store', keepalive: true }).catch(() => undefined);
  });
}

initAbyss();
