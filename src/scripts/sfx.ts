/**
 * 界面音效
 * ------------------------------------------------------------------
 * 全部用 Web Audio 现场合成，不加载任何音频文件：体积为零，音高音量可以逐次微调。
 *
 * 设计原则（避免「好听」变成「烦人」）：
 *   1. 极短。悬停 30–60ms，按下 90ms。不做长音。
 *   2. 极轻。主音量 0.5，单次峰值 0.06–0.16，实际听感是很小的一声「哒」。
 *   3. 悬停只在「进入一个新元素」时响，同一个元素里移动不重复；
 *      另外有 55ms 节流，快速扫过菜单不会连成机关枪。
 *   4. 音高承载信息：菜单五项按五声音阶依次升高，扫一遍像划过一串琴键；
 *      书脊用低一个八度的木质音；普通链接用最轻的高频 tick。
 *   5. 状态音各有性格：拒绝是两声下行，解锁是三声上行，下潜是噪声下行扫频。
 *
 * 关于自动播放：浏览器不允许在没有用户手势前出声，所以第一次点击/按键之前是静音的。
 * 这是平台限制，绕不过去——按一下任何地方之后，悬停音效就全部生效。
 *
 * 音效**不受**背景音乐开关控制，默认常开。
 */

type SfxKind = 'nav' | 'book' | 'link';

const VOLUME_MAX = 0.9;
export const SFX_DEFAULT_VOLUME = 0.8;
const HOVER_THROTTLE = 55;

/** 五声音阶（C5 D5 E5 G5 A5），菜单五项按序取用 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880];

const INTERACTIVE = 'a[href], button, [role="button"], input, textarea, select';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = SFX_DEFAULT_VOLUME;
let lastEl: Element | null = null;
let lastHoverAt = 0;

/** 0..1。拖动滑杆时调用，会平滑过渡，避免爆音 */
export function setSfxVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next));
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(volume * VOLUME_MAX, ctx.currentTime, 0.02);
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;

  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = volume * VOLUME_MAX;
  master.connect(ctx.destination);
  return ctx;
}

function ready(): AudioContext | null {
  const c = audio();
  if (!c || !master || c.state !== 'running') return null;
  return c;
}

type BlipOptions = {
  freq: number;
  /** 有值就从 freq 滑到它 */
  to?: number;
  type?: OscillatorType;
  /** 秒 */
  dur: number;
  gain?: number;
  delay?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
};

function blip(options: BlipOptions): void {
  const c = ready();
  if (!c || !master) return;

  const t0 = c.currentTime + (options.delay ?? 0);
  const peak = options.gain ?? 0.14;
  const attack = Math.min(0.012, options.dur * 0.25);

  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + options.dur);

  const osc = c.createOscillator();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, t0);
  if (options.to) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, options.to), t0 + options.dur);
  }

  let tail: AudioNode = osc;
  if (options.filter) {
    const biquad = c.createBiquadFilter();
    biquad.type = options.filter.type;
    biquad.frequency.value = options.filter.freq;
    biquad.Q.value = options.filter.q ?? 1;
    tail.connect(biquad);
    tail = biquad;
  }

  tail.connect(amp);
  amp.connect(master);
  osc.start(t0);
  osc.stop(t0 + options.dur + 0.03);
}

/** 白噪声扫频，用来做「下潜 / 浮出水面」 */
function sweep(down: boolean, delay = 0): void {
  const c = ready();
  if (!c || !master) return;

  const dur = down ? 0.34 : 0.26;
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.3;
  band.frequency.setValueAtTime(down ? 2800 : 420, t0);
  band.frequency.exponentialRampToValueAtTime(down ? 380 : 2200, t0 + dur);

  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(down ? 0.13 : 0.08, t0 + 0.05);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(band);
  band.connect(amp);
  amp.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

export const sfx = {
  hover(index: number, kind: SfxKind): void {
    if (kind === 'nav') {
      blip({ freq: PENTATONIC[index % PENTATONIC.length] ?? 523.25, type: 'triangle', dur: 0.055, gain: 0.1 });
      return;
    }
    if (kind === 'book') {
      // 木质：低一个八度、正弦、稍长
      blip({ freq: 130.81 * (1 + index * 0.06), type: 'sine', dur: 0.07, gain: 0.13 });
      blip({ freq: 261.63 * (1 + index * 0.06), type: 'sine', dur: 0.04, gain: 0.05 });
      return;
    }
    blip({ freq: 1046.5, type: 'sine', dur: 0.03, gain: 0.05 });
  },

  press(): void {
    blip({
      freq: 330,
      to: 130,
      type: 'sawtooth',
      dur: 0.09,
      gain: 0.12,
      filter: { type: 'lowpass', freq: 1300 },
    });
    blip({ freq: 880, type: 'sine', dur: 0.025, gain: 0.05 });
  },

  /** 权限不够 / 输错密钥：两声下行，听感是「不行」 */
  deny(): void {
    blip({ freq: 233.08, type: 'square', dur: 0.07, gain: 0.07, filter: { type: 'lowpass', freq: 1800 } });
    blip({ freq: 174.61, type: 'square', dur: 0.1, gain: 0.07, delay: 0.085, filter: { type: 'lowpass', freq: 1600 } });
  },

  /** 解锁成功：三声上行 */
  confirm(): void {
    [523.25, 659.25, 880].forEach((freq, i) => {
      blip({ freq, type: 'sine', dur: 0.13, gain: 0.08, delay: i * 0.07 });
    });
  },

  /** 下潜：噪声下行 */
  dive(delay = 0.05): void {
    sweep(true, delay);
  },

  /** 抵达：噪声上行 */
  surface(): void {
    sweep(false, 0);
  },
};

/** 一次用户手势之后把音频上下文唤醒——浏览器在此之前不让出声 */
function prime(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

function classify(el: HTMLElement): { index: number; kind: SfxKind } {
  const menu = el.closest('.fun-menu');
  if (menu) {
    const items = Array.from(menu.querySelectorAll('a'));
    return { index: Math.max(0, items.indexOf(el)), kind: 'nav' };
  }

  if (el.closest('.shelf-book')) {
    const shelf = el.closest('.shelf');
    const books = Array.from(shelf?.querySelectorAll('a[data-book], .shelf-book a') ?? []);
    return { index: Math.max(0, books.indexOf(el)), kind: 'book' };
  }

  return { index: 0, kind: 'link' };
}

export function attachSfx(): void {
  // 任何按下 / 按键都算手势，顺手把上下文唤醒
  window.addEventListener('pointerdown', prime, { capture: true });
  window.addEventListener('keydown', prime, { capture: true });

  document.addEventListener('pointerover', (event) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>(INTERACTIVE);
    if (!el || el === lastEl) return;

    lastEl = el;
    const now = performance.now();
    if (now - lastHoverAt < HOVER_THROTTLE) return;
    lastHoverAt = now;

    const { index, kind } = classify(el);
    sfx.hover(index, kind);
  });

  document.addEventListener('pointerout', (event) => {
    if (!lastEl) return;
    const to = (event as PointerEvent).relatedTarget as Node | null;
    if (!to || !lastEl.contains(to)) lastEl = null;
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(INTERACTIVE);
      if (!el) return;
      // 锁着的书由 articles-unlock 自己播「拒绝」音，这里不抢
      if (el.hasAttribute('data-locked')) return;
      sfx.press();
    },
    { capture: true },
  );

  // 键盘 Tab：焦点落到哪就在哪响一声，和鼠标悬停一致
  document.addEventListener('focusin', (event) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>(INTERACTIVE);
    if (!el) return;
    lastEl = el;
    const { index, kind } = classify(el);
    sfx.hover(index, kind);
  });
}
