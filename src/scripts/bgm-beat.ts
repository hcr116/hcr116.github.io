/**
 * 背景音乐的节拍 / 能量检测
 * ------------------------------------------------------------------
 * 把 <audio> 接到 Web Audio 上，用 AnalyserNode 只看中频段：
 *   · 能量明显高出滑动平均 → 抛 `bgm:beat`（离散的"这一下"）
 *   · 每帧的能量按最近峰值归一化 → 抛 `bgm:level`（0~1 的连续值）
 *
 * 为什么要换频段：原来只听 200Hz 以下（底鼓/贝斯），那是对着电子乐调的。
 * 现在这首是 エミール —— 钢琴 + 合唱，能量全在 300–2000Hz，
 * 继续听低频等于什么都没听到，标题就不会呼吸。
 * fftSize 1024 @44.1kHz → 每桶约 43Hz，300Hz≈第 7 桶，2000Hz≈第 46 桶。
 *
 * 为什么不按 BPM 设个定时器：曲子固定，但换曲、前奏、间奏都会让定时器错开半拍，
 * 「跟着音乐抖但错开」比完全不抖更难受。真的去测能量反而更稳。
 *
 * 注意：createMediaElementSource 一旦调用，<audio> 就不再直接出声，
 * 必须接回 destination，否则音乐直接没了。所以只在确实开始播放之后才建图。
 */

type BeatDetail = { level: number };

let wired = false;

const BIN_FROM = 7;
const BIN_TO = 46;

const RATIO = 1.18; // 中频起伏比低频平缓，阈值放低一点
const FLOOR = 0.05;
const REFRACTORY = 240; // 两拍之间至少隔这么久
const LEVEL_GAP = 33; // bgm:level 大约 30fps，够用又不浪费

export function attachBgmBeat(audio: HTMLAudioElement): void {
  if (wired || typeof window === 'undefined') return;

  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;

  wired = true;

  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let data: Uint8Array | null = null;
  let raf = 0;
  let avg = 0;
  let peak = 0;
  let lastBeat = 0;
  let lastLevel = 0;

  const ensureGraph = (): boolean => {
    if (ctx && analyser && data) return true;
    try {
      const next = new Ctor();
      const source = next.createMediaElementSource(audio);
      const node = next.createAnalyser();
      node.fftSize = 1024;
      // 平滑别开太高：0.6 以上瞬态会被抹平，节奏就全没了
      node.smoothingTimeConstant = 0.3;
      source.connect(node);
      node.connect(next.destination); // 不接回来就没有声音了
      ctx = next;
      analyser = node;
      data = new Uint8Array(node.frequencyBinCount);
      return true;
    } catch {
      return false;
    }
  };

  const tick = (): void => {
    raf = requestAnimationFrame(tick);
    if (!analyser || !data || !ctx) return;

    analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);

    const from = Math.min(BIN_FROM, data.length - 1);
    const to = Math.min(BIN_TO, data.length);
    let sum = 0;
    for (let i = from; i < to; i += 1) sum += data[i];
    const energy = sum / Math.max(1, to - from) / 255;

    // 滑动平均：60fps 下 0.97/0.03 ≈ 半秒窗口；窗口太短平均线会跟着自己跑
    avg = avg * 0.97 + energy * 0.03;

    // 峰值包络：慢慢衰减，用来把 energy 归一化到 0~1
    peak = Math.max(energy, peak * 0.995);
    const level = peak > 0.001 ? Math.min(1, energy / peak) : 0;

    const now = performance.now();

    if (now - lastLevel > LEVEL_GAP) {
      lastLevel = now;
      window.dispatchEvent(new CustomEvent<BeatDetail>('bgm:level', { detail: { level } }));
    }

    if (energy > FLOOR && energy > avg * RATIO && now - lastBeat > REFRACTORY) {
      lastBeat = now;
      window.dispatchEvent(new CustomEvent<BeatDetail>('bgm:beat', { detail: { level } }));
    }
  };

  const start = (): void => {
    if (!ensureGraph()) return;
    void ctx?.resume();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    cancelAnimationFrame(raf);
    raf = 0;
    avg = 0;
    peak = 0;
    window.dispatchEvent(new CustomEvent('bgm:idle'));
  };

  audio.addEventListener('play', start);
  audio.addEventListener('playing', start);
  audio.addEventListener('pause', stop);
  audio.addEventListener('ended', stop);
  audio.addEventListener('volumechange', () => {
    if (audio.volume <= 0 || audio.paused) stop();
    else if (!raf) start();
  });

  if (audio.paused) window.dispatchEvent(new CustomEvent('bgm:idle'));
  else start();
}
