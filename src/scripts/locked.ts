/**
 * 未公开条目：字是跳动的乱码，点下去演「打字机删掉 → 打出权限不足 → 信号中断消失」
 * ------------------------------------------------------------------
 * 用在不想公开、但又要让人知道「这里有个东西」的条目上（比如 AI 功能里的面试记录）。
 *
 * 和数据的关系：条目在 frontmatter 里标 `locked: true`，列表页给它挂上
 * `data-locked` 和 `data-len`（真标题的**字数**）。真标题从来不进 HTML ——
 * 只把长度写进页面，脚本按长度生成乱码，所以 F12 也只能看到一堆方块。
 *
 * 用法：
 *   initLocked({ onDeny: () => { ... } })
 *   onDeny 在「权限不足」四个字打出来的那一刻触发，给页面同步改大标题用。
 */

const GLYPHS = '▓▒░▚▞⌁≠≡∷※◇◆△▽⊕⊗∅∉';

const SCRAMBLE_MS = 90; // 平时多久跳一次字
const DEL_MS = 34; // 打字机：删一个字的间隔
const TYPE_MS = 72; // 打字机：打一个字的间隔
const HOLD_MS = 420; // 「权限不足」停多久再断
const LINE_MS = 170; // 收成一条亮线
const GONE_MS = 320; // 淡出

export const DENIED_TEXT = '权限不足';

/** 本轮已经「权限不足」掉的条目，换页/返回再进来时不再出现（sessionStorage，和开局加载页同一套） */
const GONE_KEY = 'hcr:locked:gone';

function rememberGone(key: string): void {
  if (!key) return;
  try {
    const raw = sessionStorage.getItem(GONE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    if (!next.includes(key)) next.push(key);
    sessionStorage.setItem(GONE_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式：只影响"记住"，不影响这一次的消失 */
  }
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function noise(len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

/** 打字机：逐字删光 */
async function typeDelete(els: HTMLElement[], per = DEL_MS): Promise<void> {
  const len = Math.max(...els.map((el) => el.textContent?.length ?? 0));
  for (let n = len; n >= 0; n -= 1) {
    els.forEach((el) => {
      el.textContent = (el.textContent ?? '').slice(0, n);
    });
    await sleep(per);
  }
}

/** 打字机：逐字打出来（几处文字同步） */
async function typeWrite(els: HTMLElement[], text: string, per = TYPE_MS): Promise<void> {
  for (let n = 1; n <= text.length; n += 1) {
    els.forEach((el) => {
      el.textContent = text.slice(0, n);
    });
    await sleep(per);
  }
}

type Options = {
  /** 「权限不足」打出来那一刻调用，用来同步改页面其它地方（比如详情区大标题） */
  onDeny?: (tile: HTMLElement) => void;
};

export function initLocked(options: Options = {}): void {
  const tiles = [...document.querySelectorAll<HTMLElement>('[data-locked]')];
  if (!tiles.length) return;

  for (const tile of tiles) {
    // 一块里可能有两处文字（块内的名字 + 选中时挂到右侧的名字），都要一起动
    const labels = [...tile.querySelectorAll<HTMLElement>('[data-locked-text]')];
    // 只拿长度，不拿真名：真标题从不进 HTML（见 src/data/private.ts 的说明）
    const len = Number(tile.dataset.len) || 4;
    if (!labels.length) continue;

    const paintNoise = () => {
      const text = noise(len);
      labels.forEach((el) => {
        el.textContent = text;
      });
    };

    paintNoise();
    let timer = window.setInterval(paintNoise, SCRAMBLE_MS);

    tile.setAttribute('aria-disabled', 'true');

    tile.addEventListener('click', (event) => {
      // 拦住跳转（xfer 那边也会跳过 data-locked，这里再保一道）
      event.preventDefault();
      event.stopPropagation();

      if (tile.dataset.denied === '1') return;
      tile.dataset.denied = '1';
      window.clearInterval(timer);

      void (async () => {
        // ① 乱码逐字删掉
        await typeDelete(labels);
        // ② 用打字机打出「权限不足」
        await typeWrite(labels, DENIED_TEXT);
        tile.classList.add('is-denied');
        options.onDeny?.(tile);

        await sleep(HOLD_MS);

        // ③ 信号不好：屏幕收成一条亮线
        tile.classList.add('is-power-off');
        await sleep(LINE_MS);

        // ④ 中断：淡出、摘节点
        tile.classList.add('is-gone');
        await sleep(GONE_MS);
        rememberGone(tile.dataset.lockedKey ?? '');
        tile.remove();
      })();
    });

    // 键盘也能触发（tab 到乱码块上按回车）
    tile.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      tile.click();
    });
  }
}
