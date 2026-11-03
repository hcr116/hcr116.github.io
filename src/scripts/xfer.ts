/**
 * 换页转场
 * ------------------------------------------------------------------
 * 四档，按「从哪到哪」自动选：
 *   connect  首页 → 内页      黑幕自下而上吞掉 → 新页自上而下揭开（带亮边）
 *   scan     内页 ↔ 内页      扫描带推过去          → 柔边揭开
 *   slide    文章列表 → 单篇   整页左移 + 模糊        → 从右侧滑入
 *   soft     返回上一级        直接淡黑               → 淡出
 *
 * 站点是静态多页（真实跳转），所以用 sessionStorage 留一个「我正要走」的
 * 标记：目标页在 <head> 里读到它，首帧就把黑幕铺满，换页那一下不会白闪。
 */

const KEY = 'xf-kind';
const OUT_MS: Record<Kind, number> = {
  connect: 300,
  scan: 310,
  slide: 300,
  soft: 350,
};
const IN_MS = 520;

export type Kind = 'connect' | 'scan' | 'slide' | 'soft';

const reduceMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 根据「从哪到哪」决定用哪一档 */
function kindOf(to: URL): Kind {
  const from = location.pathname.replace(/\/index\.html$/, '/');
  const toPath = to.pathname;

  if (toPath === '/' || toPath === '') return 'soft';        // 回首页 = 往上走，轻一点
  if (from === '/' || from === '') return 'connect';          // 首页出发 = 正式进入
  if (/^\/articles\/?$/.test(from) && /^\/articles\/[^/]+\/?$/.test(toPath)) return 'slide';
  return 'scan';
}

function ensureVeil(): HTMLElement {
  const found = document.getElementById('xfer');
  if (found) return found;

  const el = document.createElement('div');
  el.id = 'xfer';
  el.className = 'xfer';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<span class="xfer-slices"><i></i><i></i><i></i><i></i></span>' +
    '<span class="xfer-band"></span>' +
    '<span class="xfer-edge"></span>';
  document.body.append(el);
  return el;
}

/** 出发：把黑幕推上来，然后跳转 */
function leave(href: string, kind: Kind): void {
  const root = document.documentElement;
  ensureVeil();

  if (kind !== 'slide') {
    // 幻灯和扫描都用「黑幕上推」，只是速度快慢不同
    root.classList.add('xf-leaving', `xf-${kind}`);
  } else {
    root.classList.add('xf-leaving', `xf-${kind}`);
  }

  try {
    sessionStorage.setItem(KEY, kind);
  } catch {
    /* 隐私模式：退化成普通跳转 */
  }

  window.setTimeout(() => {
    window.location.href = href;
  }, OUT_MS[kind]);
}

/** 给全站站内链接挂上转场 */
export function bindXfer(): void {
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as Element | null)?.closest?.('a');
      if (!(link instanceof HTMLAnchorElement)) return;

      // 阿比斯那一下自己处理（信号不清晰 → 信号中断 → 这一项消失），
      // 不走下潜转场。这里是 document 捕获阶段，跑在页面自己的 click 之前，
      // 不在这儿放行的话，点了照样会被送去 /abyss/。
      if (link.hasAttribute('data-abyss')) return;
      // 未公开条目自己处理（乱码 → 权限不足 → 消失），不要跳转
      if (link.closest('[data-locked]')) return;
      // 页面自己接管这个链接（作品页点「特效作品」是原地展开，不是换页）
      if (link.hasAttribute('data-no-xfer')) return;

      // 新标签页 / 下载 / 纯锚点 / 外链：一律放行
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;

      if (reduceMotion()) return;

      event.preventDefault();
      leave(url.href, kindOf(url));
    },
    { capture: true },
  );
}

/* --------------------------------------------------------------------------
   预取：鼠标移到站内链接上（或键盘聚焦）就先把下一页拉进缓存。
   静态站每次点击都是真实跳转，这一下能把"黑幕揭开时页面还没到"的空档抹平。
   -------------------------------------------------------------------------- */

const prefetched = new Set<string>();

function prefetch(url: string): void {
  if (prefetched.has(url)) return;
  prefetched.add(url);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'document';
  document.head.append(link);
}

function maybePrefetch(target: EventTarget | null): void {
  const link = (target as Element | null)?.closest?.('a');
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.target && link.target !== '_self') return;
  if (link.hasAttribute('download')) return;
  if (link.hasAttribute('data-no-xfer')) return;

  const href = link.getAttribute('href');
  if (!href || href.startsWith('#')) return;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search) return;

  prefetch(url.href);
}

/** 给站内链接挂上"悬停预取"（只挂一次） */
export function bindPrefetch(): void {
  document.addEventListener('pointerover', (event) => maybePrefetch(event.target), { passive: true });
  document.addEventListener('focusin', (event) => maybePrefetch(event.target));
}

/** 到达：上一页留了标记就揭开黑幕 */
export function xferIn(): void {
  const root = document.documentElement;

  let kind: Kind | null = null;
  try {
    kind = sessionStorage.getItem(KEY) as Kind | null;
    sessionStorage.removeItem(KEY);
  } catch {
    kind = null;
  }

  // 调试：?xfer=<kind> 直接看到达动画
  const forced = /[?&]xfer=(connect|scan|slide|soft)/.exec(location.search);
  if (forced) kind = forced[1] as Kind;

  if (!kind) {
    root.classList.remove('xf-entering', 'xf-run', 'xf-connect', 'xf-scan', 'xf-slide', 'xf-soft');
    return;
  }

  // head 里已经把 xf-entering / xf-<kind> 加上了，这里只要启动动画
  const veil = ensureVeil();
  void veil.offsetWidth;

  const lift = (): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add('xf-run');

        window.setTimeout(() => {
          root.classList.remove(
            'xf-entering',
            'xf-run',
            'xf-connect',
            'xf-scan',
            'xf-slide',
            'xf-soft',
          );
          veil.style.transform = '';
        }, IN_MS);
      });
    });
  };

  /* 等新页画完再揭幕：静态站每次都是真实跳转，
     如果固定 520ms 就揭开，字体/图片还没到，会"白一下再跳出来"。
     兜底 900ms —— 再慢也不能让人对着黑屏干等。 */
  if (document.readyState === 'complete') {
    lift();
    return;
  }

  const fallback = window.setTimeout(lift, 900);
  window.addEventListener(
    'load',
    () => {
      window.clearTimeout(fallback);
      lift();
    },
    { once: true },
  );
}

/** 浏览器前进/后退时收拾现场（bfcache 恢复时脚本不会重跑） */
export function bindXferLifecycle(): void {
  const clean = () => {
    const root = document.documentElement;
    root.classList.remove(
      'xf-leaving',
      'xf-entering',
      'xf-run',
      'xf-connect',
      'xf-scan',
      'xf-slide',
      'xf-soft',
    );
  };

  window.addEventListener('pagehide', clean);
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) clean();
  });
}
