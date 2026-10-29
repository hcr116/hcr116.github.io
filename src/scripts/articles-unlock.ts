/**
 * /articles/ 的书架：点一本书 → 书从格子里浮起来 → 封面翻开 → 书页里办事
 * ------------------------------------------------------------------
 * - 锁着的书（02 / 03）：书页上要密钥，输对了才「跑正常流程」，也就是往后跳转。
 * - 没锁的书（01）：封面翻开后直接跳转。
 * - 已经解锁过（localStorage 有记录）：所有书都按没锁处理。
 *
 * 跳转走的是站里现成的 diveOut()，遮罩从书的位置撑开，换页那一瞬间才连得上。
 *
 * 说明：这仍然是**前端把关**，不是真的权限控制。锁住的那两篇内容本来就是空的，
 * 绕过也没什么可看。以后要放私密内容，得换成带服务端校验的方式。
 */

import { sfx } from './sfx';
import { diveOut } from './dive-transition';

const SECRET = 'hcr';
const STORE = 'articles-key';

/** 书浮起来的时长，和 CSS 里 .book-gate-stage 的 transition 对齐 */
const IN_MS = 440;
/** 封面翻过去的时长，和 CSS 里 .book-gate-cover 的 transition 对齐 */
const COVER_MS = 820;
/** 封面转到能看见书页的时候再聚焦输入框，别让人对着封面打字 */
const FOCUS_MS = IN_MS + 460;

type BookInfo = {
  href: string;
  no: string;
  cn: string;
  en: string;
  spine: string;
  locked: boolean;
};

function initArticles(): void {
  const gate = document.getElementById('book-gate');
  if (!gate) return;

  const stage = gate.querySelector<HTMLElement>('.book-gate-stage');
  const cover = gate.querySelector<HTMLElement>('[data-gate-cover]');
  const form = document.getElementById('key-form') as HTMLFormElement | null;
  const input = document.getElementById('key-input') as HTMLInputElement | null;
  const message = document.getElementById('key-msg');
  const lockedBody = gate.querySelector<HTMLElement>('[data-gate-locked]');
  const openBody = gate.querySelector<HTMLElement>('[data-gate-open]');
  const books = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-book]'));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers: number[] = [];
  let current: BookInfo | null = null;
  let lastFocus: HTMLElement | null = null;

  const clearTimers = (): void => {
    while (timers.length > 0) window.clearTimeout(timers.pop());
  };

  const after = (ms: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, reduce.matches ? 0 : ms));
  };

  const unlock = (): void => {
    document.body.classList.add('is-unlocked');
    for (const book of books) book.removeAttribute('data-locked');
  };

  /** 关掉书：先把封面转回去，再整本缩小回书架 */
  const closeGate = (): void => {
    clearTimers();
    gate.classList.remove('is-open');
    after(140, () => gate.classList.remove('is-in'));
    after(IN_MS, () => {
      gate.hidden = true;
      gate.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('gate-open');
      lastFocus?.focus({ preventScroll: true });
    });
  };

  /** 往下走：遮罩从书页中心撑开，目标是这本书的 href */
  const proceed = (): void => {
    if (!current) return;
    sfx.dive();
    diveOut(current.href, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
  };

  const openGate = (book: HTMLAnchorElement): void => {
    const rect = book.getBoundingClientRect();
    const info: BookInfo = {
      href: book.getAttribute('href') ?? '/articles/',
      no: book.querySelector('.book-no')?.textContent?.trim() ?? '',
      cn: book.querySelector('.book-cn')?.textContent?.trim() ?? '',
      en: book.querySelector('.book-en')?.textContent?.trim() ?? '',
      spine:
        getComputedStyle(book.closest('.shelf-book') ?? book).getPropertyValue('--spine').trim() ||
        '#b3492f',
      locked: book.dataset.locked === 'on',
    };

    current = info;
    lastFocus = book;

    // 起手位置 = 被点的那本书在屏幕上的位置，读起来才像「从格子里抽出来」
    stage?.style.setProperty('--from-x', `${rect.left + rect.width / 2 - window.innerWidth / 2}px`);
    stage?.style.setProperty('--from-y', `${rect.top + rect.height / 2 - window.innerHeight / 2}px`);

    cover?.style.setProperty('--spine', info.spine);
    for (const el of gate.querySelectorAll('[data-gate-no]')) el.textContent = info.no;
    for (const el of gate.querySelectorAll('[data-gate-en]')) el.textContent = info.en;
    for (const el of gate.querySelectorAll('[data-gate-title]')) el.textContent = info.cn;

    if (lockedBody) lockedBody.hidden = !info.locked;
    // 「翻开了」那一块只在密钥过掉之后才露，免得的免费书闪一下就走
    if (openBody) openBody.hidden = true;
    if (message) message.textContent = '';
    if (input) input.value = '';

    gate.hidden = false;
    gate.removeAttribute('aria-hidden');
    document.documentElement.classList.add('gate-open');

    // 先让「缩小状态」参与一帧布局，再切成落定状态，过渡才演得出来
    void gate.offsetWidth;
    requestAnimationFrame(() => gate.classList.add('is-in'));

    after(IN_MS - 40, () => {
      gate.classList.add('is-open');
      sfx.press();
    });

    if (info.locked) {
      after(FOCUS_MS, () => input?.focus({ preventScroll: true }));
    } else {
      // 没锁的书：封面转到一半就走，不用等它完全摊平
      after(IN_MS + COVER_MS * 0.5, proceed);
    }
  };

  try {
    if (localStorage.getItem(STORE) === SECRET) unlock();
  } catch {
    /* 隐私模式读不到 localStorage，就按未解锁处理 */
  }

  for (const book of books) {
    book.addEventListener('click', (event) => {
      // 新标签页、右键、组合键一律放行，让它按普通链接走
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      sfx.press();
      openGate(book);
    });
  }

  for (const el of Array.from(gate.querySelectorAll('[data-gate-close]'))) {
    el.addEventListener('click', closeGate);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !gate.hidden) {
      event.preventDefault();
      closeGate();
    }
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!current?.locked) return;

    const value = (input?.value ?? '').trim().toLowerCase();

    if (value === SECRET) {
      try {
        localStorage.setItem(STORE, SECRET);
      } catch {
        /* 存不了也没关系，本次会话仍然解锁 */
      }
      unlock();
      if (lockedBody) lockedBody.hidden = true;
      if (openBody) openBody.hidden = false;
      if (message) message.textContent = '';
      sfx.confirm();
      after(340, proceed);
      return;
    }

    sfx.deny();
    if (message) message.textContent = '密钥不对。';
    const box = gate.querySelector<HTMLElement>('.gate-form');
    if (box) {
      box.classList.remove('is-nope');
      void box.offsetWidth;
      box.classList.add('is-nope');
    }
  });
}

initArticles();
