/**
 * 首页右侧图形：悬停菜单按钮时上下滑动切换
 * ------------------------------------------------------------------
 * 四个图形在同一个格子里叠着，靠三个 class 决定位置：
 *   is-active —— 停在中间（可见）
 *   is-up     —— 在可视区上方（滚过去了）
 *   is-down   —— 在可视区下方（还没轮到）
 *
 * 因为位置只由「和当前项的前后关系」决定，所以往下悬停时整体向上滚、
 * 往上悬停时整体向下滚，动画天然是连贯的，不用额外判断方向。
 *
 * 另外这里还管圆盘的心跳：默认一动不动（只有两个环在转），
 * 只有背景音乐在放、并且检测到一拍时，才给 .fun-art 挂一次 .is-beat。
 */

function initFunArt(): void {
  const nav = document.querySelector<HTMLElement>('[data-fun-nav]');
  const figures = Array.from(document.querySelectorAll<HTMLElement>('[data-figure]'));
  const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-figure-target]'));
  if (!nav || figures.length === 0 || triggers.length === 0) return;

  let current = 0;

  const show = (index: number): void => {
    if (index === current || index < 0 || index >= figures.length) return;
    current = index;

    figures.forEach((figure, i) => {
      figure.classList.toggle('is-active', i === index);
      figure.classList.toggle('is-up', i < index);
      figure.classList.toggle('is-down', i > index);
    });
  };

  for (const trigger of triggers) {
    const index = Number(trigger.dataset.figureTarget ?? '0');
    trigger.addEventListener('mouseenter', () => show(index));
    // 键盘 Tab 过来也要切，不然只有鼠标能用
    trigger.addEventListener('focus', () => show(index));
  }

  // 离开菜单就回到第一个，和刚进页面时一致
  nav.addEventListener('mouseleave', () => show(0));
  nav.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !nav.contains(next)) show(0);
  });
}

/**
 * 圆盘：跟着背景音乐跳。
 * 音乐关着 → 什么都不发生，只有两个环在转；
 * 音乐开着 → 每检测到一拍，重挂一次 .is-beat，让圆盘/涟漪/光晕各演一遍。
 */
function initEmblemBeat(): void {
  const art = document.querySelector<HTMLElement>('.fun-art');
  if (!art) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let settle = 0;

  const beat = (): void => {
    art.classList.remove('is-beat');
    // 强制一次重排，动画才肯重挂（同一帧里摘了又挂会被合并成没变化）
    void art.offsetWidth;
    art.classList.add('is-beat');
    window.clearTimeout(settle);
    settle = window.setTimeout(() => art.classList.remove('is-beat'), 900);
  };

  const idle = (): void => {
    window.clearTimeout(settle);
    art.classList.remove('is-beat');
  };

  window.addEventListener('bgm:beat', beat);
  window.addEventListener('bgm:idle', idle);
  idle();
}

initFunArt();
initEmblemBeat();
