/**
 * 不可见文字水印
 * ------------------------------------------------------------------
 * 把一段字（站点地址）用**零宽字符**编进去：
 *   0 = ZWSP (U+200B)  1 = ZWNJ (U+200C)
 * 前后用 WORD JOINER (U+2060) 包住，方便解码时定位。
 *
 * 效果：读者在页面上完全看不见；一旦整段复制到别处，
 * 那串零宽字符会跟着走，用 scripts/wm-check.mjs 能读出来源。
 *
 * 注意：这是**追溯**手段，不是防护。拦不住截图，也拦不住看源码的人。
 */

const ZERO = '\u200b'; // 0
const ONE = '\u200c'; // 1
const START = '\u2060';
const END = '\u2061';

/** 把文字编码成一串零宽字符 */
export function wmEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = START;
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      out += (byte >> bit) & 1 ? ONE : ZERO;
    }
  }
  return out + END;
}

/** 从任意文字里把水印解出来（找不到就返回空串） */
export function wmDecode(haystack: string): string {
  const start = haystack.indexOf(START);
  if (start < 0) return '';
  const end = haystack.indexOf(END, start + 1);
  if (end < 0) return '';

  const body = haystack.slice(start + 1, end);
  const bytes: number[] = [];
  let byte = 0;
  let count = 0;

  for (const ch of body) {
    if (ch !== ZERO && ch !== ONE) continue;
    byte = (byte << 1) | (ch === ONE ? 1 : 0);
    count += 1;
    if (count === 8) {
      bytes.push(byte);
      byte = 0;
      count = 0;
    }
  }

  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}
