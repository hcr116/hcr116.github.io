/**
 * 元进度：买了就一直有的东西
 * ------------------------------------------------------------------
 * 钱是这一趟的钱，死了清零；**买下来的东西不清零**——这是唯一的沉淀。
 *
 *   · 背筐：背包格子更大
 *   · 灯：多看见一行
 *   · 手：攻击力更高
 */

const KEY = 'abyss.meta.v3';

export type Meta = {
  /** 背包额外加了几档（0 = 6×5） */
  bag: number;
  /** 灯（0/1/2）：看得更远 */
  lamp: number;
  /** 攻击加成 */
  atk: number;
};

const DEFAULT_META: Meta = { bag: 0, lamp: 0, atk: 0 };

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<Meta>;
    return {
      bag: Math.max(0, Math.min(3, Number(parsed.bag) || 0)),
      lamp: Math.max(0, Math.min(2, Number(parsed.lamp) || 0)),
      atk: Math.max(0, Math.min(4, Number(parsed.atk) || 0)),
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

export const meta: Meta = loadMeta();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* 存不下就算了 */
  }
}

/** 背包尺寸：6×5 起，每档 +1 列 */
export const bagSize = (): { cols: number; rows: number } => ({ cols: 6 + meta.bag, rows: 5 });

/** 能看见下一行往后几行 */
export const visionRows = (): number => 1 + meta.lamp;

export const buyBag = (): void => {
  meta.bag = Math.min(3, meta.bag + 1);
  save();
};

export const buyLamp = (): void => {
  meta.lamp = Math.min(2, meta.lamp + 1);
  save();
};

export const buyAtk = (): void => {
  meta.atk = Math.min(4, meta.atk + 1);
  save();
};

/** 调试用 */
(window as unknown as { __meta?: () => Meta }).__meta = () => meta;
