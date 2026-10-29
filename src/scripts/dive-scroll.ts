/**
 * /brief/ 与 /abyss/dive/ 共用的滚动下潜
 * ------------------------------------------------------------------
 * 一个 460vh 高的容器 + 内部 sticky 舞台：滚动进度 0→1 就是下潜 0→480 米。
 * 每层用 data-speed 控制视差倍率（越大越近、跑得越快），
 * 每块文案用 data-at 指定它「在哪个深度出现」。
 *
 * 全部走 rAF + transform/opacity，不碰布局，滚动时不会掉帧。
 */

import { ABYSS_ZONES } from '../consts';

/** 默认最深 480 米；页面可以用 data-max-depth 覆盖（阿比斯是 8000） */
const DEFAULT_MAX_DEPTH = 480;
const RISK_ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'];

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function initDive(): void {
  // 注意：不要用 [data-dive]——那是给链接挂转场用的，页头的「返回」按钮也带这个属性，
  // 会先被 querySelector 选中，导致整个滚动逻辑套在了一个 31px 高的链接上。
  const section = document.querySelector<HTMLElement>('[data-dive-track]');
  if (!section) return;

  const stage = section.querySelector<HTMLElement>('[data-dive-stage]');
  const depthOut = section.querySelector<HTMLElement>('[data-depth]');
  const riskOut = section.querySelector<HTMLElement>('[data-risk]');
  const zoneOut = section.querySelector<HTMLElement>('[data-zone]');
  const route = section.querySelector<SVGPathElement>('[data-route]');
  const routeReveal = section.querySelector<SVGRectElement>('[data-route-reveal]');
  const routeDot = section.querySelector<HTMLElement>('[data-route-dot]');
  const routeCursor = section.querySelector<HTMLElement>('[data-route-cursor]');
  const radar = section.querySelector<SVGGElement>('[data-radar]');
  const radarRing = section.querySelector<HTMLElement>('[data-radar-ring]');
  const radarHit = section.querySelector<SVGGElement>('[data-radar-hit]');
  const radarEcho = section.querySelector<SVGGElement>('[data-radar-echo]');
  const radarClip = section.querySelector<SVGCircleElement>('[data-radar-clip]');
  const radarBelow = section.querySelector<SVGRectElement>('[data-radar-below]');
  const hudValue = section.querySelector<HTMLElement>('.dive-hud-value');
  const dimA = section.querySelector<HTMLElement>('.dive-dim-a');
  const dimB = section.querySelector<HTMLElement>('.dive-dim-b');
  const dimC = section.querySelector<HTMLElement>('.dive-dim-c');
  const layers = Array.from(section.querySelectorAll<HTMLElement>('[data-speed]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-at]'));
  const tickEls = Array.from(section.querySelectorAll<HTMLElement>('[data-tick]'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  const maxDepth = Number(section.dataset.maxDepth ?? '') || DEFAULT_MAX_DEPTH;
  const routeLength = route?.getTotalLength() ?? 0;
  // 红点要按 viewBox 的比例换算成百分比，不能假定 viewBox 是 100×100
  const routeBox = route?.ownerSVGElement?.viewBox.baseVal;
  const routeW = routeBox?.width || 100;
  const routeH = routeBox?.height || 100;

  let frame = 0;
  let isDeep = false;

  /** 跨层：换名字、名字浮上来、深度数字跟着跳一下 */
  const crossZone = (name: string): void => {
    if (!zoneOut) return;
    zoneOut.textContent = name;
    zoneOut.hidden = false;

    // 摘掉再挂，动画才能重播
    zoneOut.classList.remove('is-new');
    void zoneOut.offsetWidth;
    zoneOut.classList.add('is-new');

    if (hudValue) {
      hudValue.classList.remove('is-crossing');
      void hudValue.offsetWidth;
      hudValue.classList.add('is-crossing');
    }
  };

  // ---------------------------------------------------------------- 扇形雷达
  // 节奏按真实声呐来：一下打到最远、边打边淡，然后一小段静默再发下一次。
  // 帧里只写 transform / opacity 两个属性，不碰布局。
  const RADAR_MS = 2600; // 一个完整周期
  const RADAR_RANGE = 260; // viewBox 单位，约等于整列的四成半高
  const RADAR_REACH = 0.68; // 周期走到这里刚好推到最远
  let radarRaf = 0;
  let radarOn = false;
  let radarAnchor = 0;
  let dotX = 0;
  let dotY = 0;

  // 雷达是 HTML 元素，位置按像素算，所以要先量一下这一列多大
  const plot = section.querySelector<HTMLElement>('.dive-route-plot');
  let plotW = 0;
  let plotH = 0;
  const measure = (): void => {
    plotW = plot?.clientWidth ?? 0;
    plotH = plot?.clientHeight ?? 0;
  };
  measure();
  window.addEventListener('resize', measure, { passive: true });

  const inView = (): boolean => {
    const box = section.getBoundingClientRect();
    return box.top < window.innerHeight && box.bottom > 0;
  };

  const radarFrame = (now: number): void => {
    if (!radarOn) return;
    radarRaf = requestAnimationFrame(radarFrame);

    const t = ((now - radarAnchor) % RADAR_MS) / RADAR_MS;

    // 冲击波式外推：一上来快，越远越慢，到 RADAR_REACH 停住
    const grow = Math.min(1, t / RADAR_REACH);
    const radius = RADAR_RANGE * (1 - Math.pow(1 - grow, 3));

    // 亮线先扫过去：0.05 起手，0.55 就淡干净
    const alpha = t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.5);

    // 回波接在后面：0.3 浮上来、0.8 开始碎、到周期末尾完全散掉。
    // 两段是错开的，所以「碎线」不会被亮线盖住。
    const echoIn = Math.min(1, Math.max(0, (t - 0.3) / 0.22));
    const echoOut = Math.min(1, Math.max(0, (1 - t) / 0.25));
    const echoAlpha = 0.5 * echoIn * echoOut;

    const xform = `translate(${dotX.toFixed(2)} ${dotY.toFixed(2)}) scale(${radius.toFixed(2)})`;

    if (!plotW || !plotH) measure();

    // 光带：横向铺满整列，只改纵向位移，纯合成层
    if (radar && plotW && plotH) {
      const py = (dotY / routeH) * plotH;
      const travel = (radius / routeH) * plotH;
      radar.style.transform = `translate3d(0, ${(py + travel).toFixed(1)}px, 0)`;
      radar.style.opacity = alpha.toFixed(3);
      if (radarRing) {
        radarRing.style.transform = `translate3d(0, ${(py + travel * 0.62).toFixed(1)}px, 0)`;
        radarRing.style.opacity = (alpha * 0.75).toFixed(3);
      }
    }

    radarClip?.setAttribute('transform', xform);
    radarBelow?.setAttribute('y', dotY.toFixed(2));
    radarHit?.setAttribute('opacity', (alpha * 0.95).toFixed(3));
    radarEcho?.setAttribute('opacity', echoAlpha.toFixed(3));
  };

  const startRadar = (): void => {
    if (radarOn || reduce.matches || !radar) return;
    radarOn = true;
    radarAnchor = performance.now();
    radarRaf = requestAnimationFrame(radarFrame);
  };

  const stopRadar = (): void => {
    radarOn = false;
    cancelAnimationFrame(radarRaf);
    if (radar) radar.style.opacity = '0';
    if (radarRing) radarRing.style.opacity = '0';
    radarHit?.setAttribute('opacity', '0');
    radarEcho?.setAttribute('opacity', '0');
  };

  const render = (): void => {
    frame = 0;
    if (reduce.matches) return;

    const scrollable = section.offsetHeight - window.innerHeight;
    const progress = clamp01(-section.getBoundingClientRect().top / Math.max(1, scrollable));

    // 红点位置先算：深度读数直接读它的高度，刻度、读数、点三者才对得上。
    // （以前读数走的是缓动后的滚动进度，和折线的高度不是一回事，刻度会「提前」亮。）
    const point = route && routeLength > 0 ? route.getPointAtLength(progress * routeLength) : null;
    const sank = point ? clamp01(point.y / routeH) : 0;
    const depth = Math.round(sank * maxDepth);
    if (depthOut) depthOut.textContent = depth.toLocaleString('en-US');

    // 越深越暗：外圈压暗 → 视野收紧 → 整屏沉下去，三段错开
    if (dimA) dimA.style.opacity = (clamp01((sank - 0.02) / 0.55) * 0.85).toFixed(3);
    if (dimB) dimB.style.opacity = (clamp01((sank - 0.42) / 0.48) * 0.9).toFixed(3);
    if (dimC) dimC.style.opacity = (clamp01((sank - 0.66) / 0.34) * 0.5).toFixed(3);
    if (stage) stage.style.setProperty('--dark', sank.toFixed(3));

    // 刻度：下潜到那一层才亮一次，亮过就不再重复
    for (const tick of tickEls) {
      if (tick.classList.contains('is-found')) continue;
      const at = Number(tick.dataset.tick ?? '0');
      if (depth >= at) tick.classList.add('is-found');
    }

    // 危险等级：按最大深度的四等分升，最高 Ⅳ
    if (riskOut) {
      const step = maxDepth / RISK_ROMAN.length;
      const level = 1 + Math.min(RISK_ROMAN.length - 1, Math.floor(depth / step));
      if (riskOut.dataset.level !== String(level)) {
        riskOut.dataset.level = String(level);
        riskOut.textContent = RISK_ROMAN[level - 1] ?? RISK_ROMAN[0];
      }
    }

    // 区域分层：深度跨过 from 就换名字，换的那一下有次过场
    if (zoneOut && ABYSS_ZONES.length > 0) {
      let current = ABYSS_ZONES[0];
      for (const zone of ABYSS_ZONES) {
        if (depth >= zone.from) current = zone;
      }
      if (zoneOut.textContent !== current.name) crossZone(current.name);
    }

    // 到底了：换成暖色，只发生一次
    if (!isDeep && depth >= maxDepth * 0.95) {
      isDeep = true;
      section.classList.add('is-deep');
    }

    // 红点沿着折线走：getPointAtLength 给的是 viewBox 坐标，按宽高换算成百分比
    if (point && routeDot) {
      const topPct = (point.y / routeH) * 100;
      dotX = point.x;
      dotY = point.y;
      routeDot.style.left = `${((point.x / routeW) * 100).toFixed(2)}%`;
      routeDot.style.top = `${topPct.toFixed(2)}%`;
      if (routeCursor) routeCursor.style.top = `${topPct.toFixed(2)}%`;

      // 亮线露到红点为止。多给 3 个单位，让线从点的身下穿过，接缝被点盖住。
      routeReveal?.setAttribute('height', String(point.y + 3));

      // 过了四分之三就点亮，表示已经进深水区
      const hot = depth >= maxDepth * 0.75;
      if (routeDot.hasAttribute('data-hot') !== hot) routeDot.toggleAttribute('data-hot', hot);
    }

    if (stage) stage.style.setProperty('--p', progress.toFixed(4));

    for (const layer of layers) {
      const speed = Number(layer.dataset.speed ?? '0.4');
      layer.style.transform = `translate3d(0, ${(-progress * speed * 100).toFixed(2)}vh, 0)`;
    }

    for (const panel of panels) {
      const at = Number(panel.dataset.at ?? '0');
      const distance = Math.abs(progress - at);
      // 越深，字也跟着暗一点，但最后那段话还得看得清
      const dim = 1 - sank * 0.13;
      const opacity = clamp01(1 - distance / 0.22) * dim;

      panel.style.opacity = opacity.toFixed(3);
      panel.style.transform = `translate3d(0, ${((progress - at) * -10).toFixed(2)}vh, 0)`;
      // 只在真正看得见的时候接住鼠标，避免挡住下面的链接
      panel.style.pointerEvents = opacity > 0.55 ? 'auto' : 'none';
      panel.toggleAttribute('inert', opacity < 0.15);
    }
  };

  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reduce.addEventListener('change', schedule);
  // 下潜落地动画会动 transform，结束后需要重算一次深度读数
  document.addEventListener('dive:landed', schedule);
  render();

  // 雷达只在看得见的时候跑，切走标签页就停，别白烧电
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible && !document.hidden) startRadar();
        else stopRadar();
      },
      { threshold: 0 },
    ).observe(section);
  } else if (inView()) {
    startRadar();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !inView()) stopRadar();
    else startRadar();
  });

  reduce.addEventListener('change', () => {
    if (reduce.matches || !inView()) stopRadar();
    else startRadar();
  });
}

initDive();
