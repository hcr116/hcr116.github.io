/*
 * 菜单行的像素行错位
 * ------------------------------------------------------------------
 * 参考的是老电视信号坏掉的样子：不是几块厚条在推，而是一行一行像素在错位。
 *
 * 做法：把整行 <a> 克隆若干份（克隆能保留 grid 排版，光靠 innerHTML 复制会失去布局），
 * 每份用 clip-path 裁成一条 2px 级的细带，爆发时逐帧随机左右推一下。
 *
 * 为什么条数要按行高算：一行字只有二十来像素高，固定 32 条会切到 0.6px 一条，
 * 等于没有。所以按「每条约 2.2px」反推条数，小节也才有像素行的感觉。
 */

const CYCLE = 2400; // 多久来一次大的（之前 6 秒，等于看不见）
const BURST = 440; // 大抖持续多久
const STEP = 38; // 逐帧推进的间隔
const BAND_TARGET = 2.2; // 每条大约多高（px）
const POWER = 6.5; // 最大横向位移（px）——之前 4px 基本看不出来，9px 又太糊
const IDLE_EVERY = 280; // 平时的小抖：让这一行一直是「活的」
const IDLE_POWER = 1.8;
const FRINGE = 2.4; // 色差镶边的默认偏移

type Band = HTMLAnchorElement;

function initMenuGlitch(): void {
  const link = document.querySelector<HTMLAnchorElement>('.fun-menu a.is-signal');
  if (!link) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  link.classList.add('is-signal-ready');

  /*
   * 先留一份「干净的行」当模板。
   * 直接克隆页面上那一行的话，会把已经加进去的图层一起克隆进去，
   * 结果图层里套图层（还都带绝对定位和混合模式），渲染器会直接卡死。
   */
  const template = link.cloneNode(true) as Band;
  template.querySelectorAll('.sig-band, .sig-fringe').forEach((node) => node.remove());
  template.removeAttribute('href');
  template.classList.remove('is-signal', 'is-signal-ready');
  template.tabIndex = -1;

  function clear(): void {
    link!.querySelectorAll('.sig-band, .sig-fringe').forEach((node) => node.remove());
  }

  function layer(className: string): Band {
    const el = template.cloneNode(true) as Band;
    el.classList.add(...className.split(' '));
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function build(): void {
    clear();

    const height = link!.offsetHeight || 44;
    const count = Math.max(8, Math.min(26, Math.round(height / BAND_TARGET)));

    // 两层镶边：整体错开，安静时也在
    link!.append(layer('sig-fringe c'));
    link!.append(layer('sig-fringe m'));

    for (let i = 0; i < count; i += 1) {
      const top = (i / count) * 100;
      const high = 100 / count;
      const band = layer('sig-band');
      band.style.clipPath = `inset(${top.toFixed(3)}% 0 ${(100 - top - high).toFixed(3)}% 0)`;
      link!.append(band);
    }
  }

  function reset(): void {
    link!.querySelectorAll<HTMLElement>('.sig-band').forEach((band) => {
      band.style.transform = 'translate3d(0,0,0)';
    });
    const c = link!.querySelector<HTMLElement>('.sig-fringe.c');
    const m = link!.querySelector<HTMLElement>('.sig-fringe.m');
    if (c) c.style.transform = `translate3d(${-FRINGE}px,0,0)`;
    if (m) m.style.transform = `translate3d(${FRINGE}px,0,0)`;
  }

  function scramble(power: number): void {
    const bands = link!.querySelectorAll<HTMLElement>('.sig-band');
    bands.forEach((band) => {
      const roll = Math.random();
      // 只推一部分行，全推就糊成一团——挑着推才像信号断续
      if (roll < 0.55) {
        band.style.transform = `translate3d(${((Math.random() * 2 - 1) * power).toFixed(1)}px,0,0)`;
      } else if (roll < 0.66) {
        band.style.transform = `translate3d(0,${((Math.random() * 2 - 1) * 2.5).toFixed(1)}px,0)`;
      } else {
        band.style.transform = 'translate3d(0,0,0)';
      }
    });

    const jitter = (Math.random() * 2 - 1) * 1.6;
    const c = link!.querySelector<HTMLElement>('.sig-fringe.c');
    const m = link!.querySelector<HTMLElement>('.sig-fringe.m');
    if (c) c.style.transform = `translate3d(${(-FRINGE - jitter).toFixed(1)}px,0,0)`;
    if (m) m.style.transform = `translate3d(${(FRINGE + jitter).toFixed(1)}px,0,0)`;
  }

  /** 安静的间隙里也有小抖：每次只碰一两条，幅度 1~2px */
  function idle(): void {
    const bands = Array.from(link!.querySelectorAll<HTMLElement>('.sig-band'));
    if (!bands.length) return;
    bands.forEach((band) => {
      band.style.transform = 'translate3d(0,0,0)';
    });
    const picks = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < picks; i += 1) {
      const band = bands[Math.floor(Math.random() * bands.length)];
      if (!band) continue;
      band.style.transform = `translate3d(${((Math.random() * 2 - 1) * IDLE_POWER).toFixed(1)}px,0,0)`;
    }
  }

  let burstTimer = 0;
  let cycleTimer = 0;
  let idleTimer = 0;

  function fire(): void {
    const start = performance.now();
    window.clearInterval(burstTimer);
    window.clearInterval(idleTimer);
    burstTimer = window.setInterval(() => {
      if (performance.now() - start > BURST) {
        window.clearInterval(burstTimer);
        reset();
        startIdle();
        return;
      }
      scramble(POWER);
    }, STEP);
  }

  function startIdle(): void {
    window.clearInterval(idleTimer);
    idleTimer = window.setInterval(idle, IDLE_EVERY);
  }

  function loop(): void {
    window.clearTimeout(cycleTimer);
    cycleTimer = window.setTimeout(() => {
      fire();
      loop();
    }, CYCLE);
  }

  build();
  reset();
  loop();
  startIdle();

  // 鼠标停上来当场抖一次，别让人等那个周期
  link.addEventListener('mouseenter', fire);

  // 行高会随字号/断点变化，重建一次就够，不用频繁
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      reset();
    }, 220);
  });
}

initMenuGlitch();
