/**
 * 就地展开的存档层（XMB 式）—— 数据驱动版
 * ------------------------------------------------------------------
 * P3：一套网格服务多个频道。卡片不再写死在 HTML 里，而是由这里按数据渲染。
 *
 * 频道 = { id, items, emptyText }
 *   有内容 → 2×2 一屏四张，可翻卡、翻组
 *   没内容 → 网格位置留空，中央一行灰字（默认「还没有内容」）
 *
 * 卡片有两种：
 *   video —— 缩略视频，点开全屏播放（特效作品）
 *   link  —— 文字卡，点开跳 href（文章、以后的其它方向）
 *
 * 它负责：开 / 关、分页、焦点框、背景交叉淡入、播放层、四种返回方式
 * 它不负责：频道条里哪一格亮着（onToggle）、卡片的业务含义
 */

export type ArchiveItem = {
  id: string;
  kind: 'video' | 'link';
  /** 主标题，比如「命中」或文章标题 */
  title: string;
  /** 副标，比如「2023年11月」或「怪物 · 3/9」 */
  sub?: string;
  /** 左上角小标签，比如「VFX 01」 */
  tag?: string;
  /** 右上角时长，只有视频用 */
  dur?: string;
  /** 视频封面 / 视频地址 */
  poster?: string;
  src?: string;
  /** link 卡跳哪 */
  href?: string;
};

export type ArchiveChannel = {
  id: string;
  /** 面包屑里显示的名字 */
  title?: string;
  items: ArchiveItem[];
  /** 没内容时显示什么，默认「还没有内容」 */
  emptyText?: string;
};

export type ArchiveOptions = {
  root: HTMLElement | null;
  grid: HTMLElement | null;
  pager?: HTMLElement | null;
  focus?: HTMLElement | null;
  bgLayers?: HTMLElement[];
  legend?: HTMLElement | null;
  crumbs?: { host: HTMLElement; html: (channel: ArchiveChannel) => string } | null;
  player?: { box: HTMLElement; video: HTMLVideoElement } | null;
  channels: Record<string, ArchiveChannel>;
  pageSize?: number;
  urlParam?: string;
  baseUrl?: string;
  onToggle?: (open: boolean, channel: ArchiveChannel) => void;
  onSelect?: (item: ArchiveItem, index: number) => void;
  /** 没内容时的那句话，默认「还没有内容」 */
  emptyText?: string;
  /**
   * 动效版本：v1 = 老的一层淡入（文章页还在用）；
   * v2 = 上浮式入场 + 反放退场 + 换频道整排推出推入（先在作品页试）
   */
  motion?: 'v1' | 'v2';
};

export type ArchiveHandle = {
  /** 存档层是否开着 */
  readonly opened: boolean;
  readonly index: number;
  readonly channelId: string;
  open: (channelId: string, animate?: boolean) => void;
  close: () => void;
  goTo: (i: number) => void;
  goPage: (delta: number) => void;
};

const CARD_HINT_PLAY = 'Enter 播放';
const CARD_HINT_OPEN = 'Enter 打开';

export function initArchive(options: ArchiveOptions): ArchiveHandle {
  const {
    root,
    grid,
    pager = null,
    focus = null,
    bgLayers = [],
    legend = null,
    crumbs = null,
    player = null,
    channels,
    pageSize = 4,
    urlParam = 'vfx',
    baseUrl = location.pathname,
    onToggle,
    onSelect,
    emptyText: emptyFallback = '还没有内容',
    motion = 'v1',
  } = options;

  /* v2 = 上浮式入场 / 反放退场 / 换频道整排推出推入（先在作品页试用） */
  const useMotion2 = motion === 'v2';
  if (useMotion2) root?.classList.add('is-motion-v2');

  const CLOSE_MS = 380;
  const SWITCH_OUT_MS = 180;
  const SWITCH_IN_MS = 240;
  const STAGGER_MS = 45;

  const reduceMotion = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let closeTimer = 0;
  let switchBusy = false;

  const param = `?${urlParam}=1`;
  /** URL 里有没有这个参数（?ch=1 和 ?ch=vfx 都算有） */
  const hasParam = () => new URLSearchParams(location.search).has(urlParam);

  let isOpen = false;
  let index = 0;
  let channelId = '';
  let cards: HTMLElement[] = [];
  let crumbBackup = '';
  let bgTurn = 0;

  /* ---------------- 渲染卡片 ---------------- */

  const buildCard = (item: ArchiveItem, i: number): HTMLElement => {
    const el = document.createElement('article');
    el.className = 'ws-vfx-card';
    el.dataset.card = String(i);
    el.dataset.kind = item.kind;
    el.dataset.id = item.id;
    if (item.poster) el.dataset.poster = item.poster;
    if (item.src) el.dataset.src = item.src;
    if (item.href) el.dataset.href = item.href;

    if (item.kind === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      if (item.poster) video.poster = item.poster;
      video.setAttribute('aria-hidden', 'true');
      el.append(video);
    }

    if (item.tag) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item.tag;
      el.append(tag);
    }

    if (item.dur) {
      const dur = document.createElement('span');
      dur.className = 'dur';
      dur.textContent = item.dur;
      el.append(dur);
    }

    const cap = document.createElement('div');
    cap.className = 'cap';
    const b = document.createElement('b');
    b.textContent = item.title;
    cap.append(b);
    if (item.sub) {
      const sub = document.createElement('span');
      sub.textContent = item.sub;
      cap.append(sub);
    }
    el.append(cap);

    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = item.kind === 'video' ? CARD_HINT_PLAY : CARD_HINT_OPEN;
    el.append(hint);

    return el;
  };

  const renderChannel = (channel: ArchiveChannel): void => {
    if (!grid) return;

    for (const old of [...grid.querySelectorAll<HTMLElement>('.ws-vfx-card, .ws-vfx-empty')]) old.remove();
    cards = [];

    if (!channel.items.length) {
      const empty = document.createElement('div');
      empty.className = 'ws-vfx-empty';
      empty.textContent = channel.emptyText ?? emptyFallback;
      grid.append(empty);
      // 没内容：页码藏掉、两边热区都关掉、焦点框不画
      if (pager) pager.hidden = true;
      root?.classList.add('vfx-at-start', 'vfx-at-end');
      focus?.classList.remove('is-on');
      return;
    }

    for (const [i, item] of channel.items.entries()) {
      const card = buildCard(item, i);
      card.style.gridRow = String(Math.floor((i % pageSize) / 2) + 1);
      card.style.gridColumn = String(((i % pageSize) % 2) + 1);
      card.addEventListener('mouseenter', () => {
        if (isOpen && i !== index) goTo(i);
      });
      card.addEventListener('click', () => {
        if (i !== index) {
          goTo(i);
          return;
        }
        if (channel.items[i]?.kind === 'video') {
          const src = channel.items[i]?.src;
          if (src) openPlayer(src);
        } else {
          const href = channel.items[i]?.href;
          if (href) location.href = href;
        }
      });
      grid.append(card);
      cards.push(card);
    }
  };

  /* ---------------- 分页 ---------------- */

  const pageCount = () => Math.max(1, Math.ceil(cards.length / pageSize));

  const renderPage = (): void => {
    const page = Math.floor(index / pageSize);
    for (const [k, card] of cards.entries()) {
      card.classList.toggle('is-offpage', Math.floor(k / pageSize) !== page);
    }
    root?.classList.toggle('vfx-at-start', page === 0);
    root?.classList.toggle('vfx-at-end', page >= pageCount() - 1);
    if (pager) {
      pager.innerHTML =
        '<b>' + String(page + 1).padStart(2, '0') + '</b> / ' + String(pageCount()).padStart(2, '0');
      pager.hidden = cards.length === 0;
    }
  };

  /* ---------------- 背景 / 焦点框 / 视频 ---------------- */

  const paintBg = (): void => {
    const poster = cards[index]?.getAttribute('data-poster');
    if (!poster || bgLayers.length < 2) {
      for (const layer of bgLayers) layer.classList.remove('is-on');
      return;
    }
    const incoming = bgLayers[bgTurn % 2];
    const outgoing = bgLayers[(bgTurn + 1) % 2];
    incoming.style.backgroundImage = 'url(' + poster + ')';
    incoming.classList.add('is-on');
    outgoing.classList.remove('is-on');
    bgTurn += 1;
  };

  const moveFocus = (animate = true): void => {
    const card = cards[index];
    if (!focus) return;
    if (!card || card.classList.contains('is-offpage')) {
      focus.classList.remove('is-on');
      return;
    }

    const apply = (): void => {
      focus.style.transform = 'translate(' + card.offsetLeft + 'px, ' + card.offsetTop + 'px)';
      focus.style.width = card.offsetWidth + 'px';
      focus.style.height = card.offsetHeight + 'px';
    };

    if (!animate) focus.style.transition = 'none';
    apply();
    focus.classList.add('is-on');

    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });

    if (!animate) {
      void focus.offsetWidth;
      focus.style.transition = '';
    }
  };

  const syncVideo = (): void => {
    for (const [i, card] of cards.entries()) {
      const video = card.querySelector('video');
      const src = card.getAttribute('data-src');
      if (!video || !src) continue;
      if (i === index) {
        if (!video.getAttribute('src')) video.src = src;
        void video.play().catch(() => {
          /* 静音自动播放一般能成，被拦就停在封面 */
        });
      } else if (!video.paused) {
        video.pause();
      }
    }
  };

  /* ---------------- 选中某张 ---------------- */

  const goTo = (i: number): void => {
    if (!cards.length) return;
    const next = Math.max(0, Math.min(cards.length - 1, i));
    if (next === index && isOpen) return;
    index = next;

    for (const [k, card] of cards.entries()) card.classList.toggle('is-on', k === next);

    renderPage();
    syncVideo();
    paintBg();
    moveFocus();

    const item = channels[channelId]?.items[next];
    if (item) onSelect?.(item, next);
  };

  const goPage = (delta: number): void => {
    const page = Math.floor(index / pageSize) + delta;
    if (page < 0 || page >= pageCount()) return;
    goTo(page * pageSize);
  };

  /* ---------------- 播放层 ---------------- */

  let playerOpen = false;
  let playerHideTimer = 0;

  const openPlayer = (src: string): void => {
    if (!player) return;
    window.clearTimeout(playerHideTimer);
    playerOpen = true;
    document.documentElement.classList.add('is-vfx-playing');
    player.box.hidden = false;
    void player.box.offsetWidth;
    player.box.classList.add('is-on');
    player.video.src = src;
    void player.video.play().catch(() => {
      /* 点开就算手势 */
    });
  };

  const closePlayer = (): void => {
    if (!player || !playerOpen) return;
    playerOpen = false;
    document.documentElement.classList.remove('is-vfx-playing');
    player.box.classList.remove('is-on');
    player.video.pause();
    playerHideTimer = window.setTimeout(() => {
      if (playerOpen || !player) return;
      player.box.hidden = true;
      player.video.removeAttribute('src');
      player.video.load();
    }, 240);
  };

  player?.box.addEventListener('click', (event) => {
    if (event.target === player.box) closePlayer();
  });

  /* ---------------- 开 / 关 ---------------- */

  /** v2 入场：四张卡从下方错峰升起 */
  const riseCards = (): void => {
    if (!useMotion2 || reduceMotion()) return;
    const visible = cards.filter((card) => !card.classList.contains('is-offpage'));

    visible.forEach((card, i) => {
      card.classList.add('is-enter');
      card.style.setProperty('--i', String(i));
      /* 延迟写在行内：is-enter 摘掉之后这条还要继续生效，错峰才看得出来 */
      card.style.transitionDelay = `${160 + i * STAGGER_MS}ms`;
    });

    /* 下一帧再放开，让"从下往上"这一帧成立 */
    window.setTimeout(() => {
      visible.forEach((card) => card.classList.remove('is-enter'));
    }, 40);

    /* 入场结束后清掉行内延迟，别影响退场/换频道的节奏 */
    window.setTimeout(() => {
      visible.forEach((card) => {
        card.style.transitionDelay = '';
      });
    }, 160 + visible.length * STAGGER_MS + 520);
  };

  const open = (id: string, animate = true): void => {
    const channel = channels[id];
    if (!channel) return;

    const wasOpen = isOpen;
    const switching = useMotion2 && wasOpen && channelId !== id;

    if (!animate) root?.classList.add('is-vfx-instant');
    else root?.classList.remove('is-vfx-instant');

    channelId = id;
    if (!isOpen) {
      isOpen = true;
      root?.classList.add('is-vfx');
      if (legend) legend.hidden = false;
      if (crumbs) {
        crumbBackup = crumbs.host.innerHTML;
        crumbs.host.insertAdjacentHTML('beforeend', crumbs.html(channel));
      }
      /* URL 里带上频道 id，刷新 / 分享能回到同一个频道 */
      const url = baseUrl + '?' + urlParam + '=' + id;
      if (animate) history.pushState({ [urlParam]: id }, '', url);
      else history.replaceState({ [urlParam]: id }, '', url);
    }

    /* 换频道时面包屑也得跟着换（进存档时写过一次） */
    if (isOpen && crumbs && crumbBackup) {
      crumbs.host.innerHTML = crumbBackup;
      crumbs.host.insertAdjacentHTML('beforeend', crumbs.html(channel));
    }

    const commit = (): void => {
      renderChannel(channel);
      index = -1;
      goTo(0);
      onToggle?.(true, channel);
    };

    /* v2 换频道：整排先推出去，换了内容再推回来 */
    if (switching && !reduceMotion() && !switchBusy) {
      switchBusy = true;
      root?.classList.add('is-vfx-switch-out');
      window.setTimeout(() => {
        root?.classList.remove('is-vfx-switch-out');
        commit();
        root?.classList.add('is-vfx-switch-in');
        window.setTimeout(() => {
          root?.classList.remove('is-vfx-switch-in');
          switchBusy = false;
        }, SWITCH_IN_MS);
      }, SWITCH_OUT_MS);
      return;
    }

    commit();

    /* v2 打开：卡片错峰升起（换频道那条路径由推入负责） */
    if (!wasOpen) riseCards();
  };

  const finishClose = (): void => {
    if (legend) legend.hidden = true;
    if (crumbs && crumbBackup) crumbs.host.innerHTML = crumbBackup;
    for (const card of cards) card.querySelector('video')?.pause();
    closePlayer();

    if (hasParam()) {
      history.pushState({ [urlParam]: 0 }, '', baseUrl);
    }
  };

  const close = (): void => {
    if (!isOpen) return;
    isOpen = false;

    /* v2：卡片先退场（错峰），再收容器 —— 打开时的反放 */
    if (useMotion2) {
      root?.classList.add('is-vfx-closing');
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(
        () => {
          root?.classList.remove('is-vfx', 'is-vfx-closing');
          finishClose();
        },
        reduceMotion() ? 100 : CLOSE_MS,
      );
    } else {
      root?.classList.remove('is-vfx');
      finishClose();
    }
  };

  /* ---------------- 事件 ---------------- */

  for (const zone of document.querySelectorAll<HTMLElement>('[data-zone]')) {
    zone.addEventListener('mouseenter', () => goPage(zone.dataset.zone === 'next' ? 1 : -1));
    zone.addEventListener('click', (event) => {
      event.stopPropagation();
      goPage(zone.dataset.zone === 'next' ? 1 : -1);
    });
  }

  document.querySelector('[data-backdrop]')?.addEventListener('click', () => close());
  document.querySelector('[data-vfx-close]')?.addEventListener('click', () => close());

  /* 点空白处返回：除了这些"有自己活儿"的，点哪儿都返回 */
  document.addEventListener('click', (event) => {
    if (!isOpen) return;
    const target = event.target as Element | null;
    if (!target) return;
    if (
      target.closest('.ws-vfx-card') ||
      /* 频道方块：作品页是 .ws-tile、文章页是 .ar-tile，都带 data-tile */
      target.closest('[data-tile]') ||
      target.closest('.ws-tile') ||
      target.closest('.ar-tile') ||
      target.closest('.ws-vfx-zone') ||
      target.closest('.ws-vfx-legend') ||
      target.closest('[data-player]') ||
      target.closest('.site-header')
    ) {
      return;
    }
    close();
  });

  window.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (playerOpen) {
        closePlayer();
        return;
      }
      close();
    }
    /* 播放层开着时，方向键交给视频自己（快进 / 快退），别切卡片 */
    if (playerOpen) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    }
  });

  window.addEventListener('popstate', () => {
    if (hasParam()) {
      const wanted = new URLSearchParams(location.search).get('ch') ?? channelId;
      if (channels[wanted]) open(wanted, false);
      else if (channelId && channels[channelId]) open(channelId, false);
    } else {
      close();
    }
  });

  window.addEventListener('resize', () => {
    if (isOpen) moveFocus(false);
  });

  /* 带参数直达：直接是存档态，不演展开 */
  if (hasParam()) {
    const wanted = new URLSearchParams(location.search).get('ch');
    const first = wanted && channels[wanted] ? wanted : Object.keys(channels)[0];
    if (first) open(first, false);
  }

  return {
    get opened() {
      return isOpen;
    },
    get index() {
      return index;
    },
    get channelId() {
      return channelId;
    },
    open,
    close,
    goTo,
    goPage,
  };
}
