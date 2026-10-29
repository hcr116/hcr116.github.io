/**
 * 背景音乐的节拍检测
 * ------------------------------------------------------------------
 * 把 <audio> 接到 Web Audio 上，用一个 AnalyserNode 只看低频段：
 * 能量明显高出滑动平均就算一拍，往 window 上抛 `bgm:beat`。
 * 音乐暂停 / 音量为 0 时抛 `bgm:idle`，页面据此停掉一切律动。
 *
 * 为什么不按 BPM 设个定时器：
 * 曲子是固定的，但换曲、前奏、间奏都会让定时器立刻和音乐错开，
 * 而「跟着音乐抖但错开半拍」比完全不抖更难受。真的去测能量反而更稳。
 *
 * 注意：createMediaElementSource 一旦调用，<audio> 就不再直接出声，
 * 必须接回 destination，否则音乐直接没了。所以只在「确实开始播放」之后才建图。
 */

type BeatDetail = { level: number };

let wired = false;

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
  let lastBeat = 0;

  // 实测这支曲子（135 秒的慢速电子）：低频段标准差约 0.21，
  // 用「超过滑动平均 1.22 倍」判一拍，8 秒里能落到 11 下左右，差不多是歌的拍子。
  // 之前用 1.35 倍 + 平滑 0.62，结果一次都不触发——阈值比曲子本身的起伏还高。
  const RATIO = 1.26;
  const FLOOR = 0.08;
  const REFRACTORY = 260;

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

    analyser.getByteFrequencyData(data);

    // 只数低频：fftSize 1024 时一个桶约 43Hz，取前 4 个桶 ≈ 200Hz 以下（底鼓/贝斯）
    const bins = Math.min(4, data.length);
    let sum = 0;
    for (let i = 0; i < bins; i += 1) sum += data[i];
    const energy = sum / bins / 255;

    // 滑动平均的时间常数要按「每帧都跑」来算：60fps 下 0.97/0.03 ≈ 半秒窗口，
    // 窗口太短的话平均线会跟着自己跑，随便一点起伏都算一拍。
    avg = avg * 0.97 + energy * 0.03;

    const now = performance.now();
    if (energy > FLOOR && energy > avg * RATIO && now - lastBeat > REFRACTORY) {
      lastBeat = now;
      window.dispatchEvent(
        new CustomEvent<BeatDetail>('bgm:beat', { detail: { level: energy } }),
      );
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
