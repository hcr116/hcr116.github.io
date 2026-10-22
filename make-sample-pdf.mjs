/**
 * 生成占位 PDF（零依赖，手写 PDF 字节流）。
 * 只用于模板演示，跑一次就够了：
 *   node scripts/make-sample-pdf.mjs
 * 生成物：public/docs/sample-doc.pdf
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 595.28;
const H = 841.89;
const M = 64;
const RIGHT = W - M;
const COL_W = RIGHT - M;

// 颜色（RGB 0-1）
const ink = [0.09, 0.09, 0.102];
const soft = [0.337, 0.337, 0.373];
const faint = [0.545, 0.545, 0.584];
const accent = [0.541, 0.353, 0.231];
const ruleCol = [0.878, 0.863, 0.831];
const barCol = [0.91, 0.894, 0.867];

const n = (v) => Number(v.toFixed(3)).toString();
const rgb = (c) => `${n(c[0])} ${n(c[1])} ${n(c[2])}`;
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const ops = [];

/** 文字：x 为左边界，top 为文字顶部的「从上往下」坐标 */
function text(str, x, top, size, font, color) {
  const baseline = H - (top + size * 0.78);
  ops.push(`BT /${font} ${n(size)} Tf ${rgb(color)} rg ${n(x)} ${n(baseline)} Td (${esc(str)}) Tj ET`);
}

function line(y, color = ruleCol, width = 0.8) {
  const y0 = H - y;
  ops.push(`${n(width)} w ${rgb(color)} RG ${n(M)} ${n(y0)} m ${n(RIGHT)} ${n(y0)} l S`);
}

function rect(x, top, w, h, color, stroke = false) {
  const y0 = H - (top + h);
  ops.push(stroke
    ? `${n(0.8)} w ${rgb(color)} RG ${n(x)} ${n(y0)} ${n(w)} ${n(h)} re S`
    : `${rgb(color)} rg ${n(x)} ${n(y0)} ${n(w)} ${n(h)} re f`);
}

// 近似字宽（Helvetica，够用来做居中）
const approxWidth = (s, size) => s.length * size * 0.5;

// ---------- 内容 ----------
text('SAMPLE DOCUMENT', M, 64, 8, 'F2', accent);
line(82);

text('Placeholder document', M, 112, 26, 'F2', ink);
text('Delete public/docs/sample-doc.pdf and drop your own PDF in here.', M, 172, 12, 'F1', soft);
text('Visitors open it by clicking the attachment on the work detail page.', M, 192, 12, 'F1', soft);

const meta = [
  ['DOCUMENT', 'sample-doc.pdf'],
  ['SIZE', 'keep it under 5 MB'],
  ['NOTE', 'Word and PPT cannot be previewed — export to PDF'],
];
let y = 240;
for (const [key, value] of meta) {
  text(key, M, y, 8, 'F2', faint);
  text(value, 176, y - 1, 10, 'F1', soft);
  y += 24;
}

line(320);
text('Why a PDF', M, 344, 13, 'F2', ink);

let by = 376;
const bars = [COL_W, 452, 430, COL_W, 300, 0, COL_W, 400, 250];
for (const w of bars) {
  if (w === 0) {
    by += 14;
    continue;
  }
  rect(M, by, w, 7, barCol);
  by += 18;
}

const boxTop = by + 24;
rect(M, boxTop, COL_W, 74, ruleCol, true);
text('Tip', M + 16, boxTop + 15, 10, 'F2', accent);
text('Attach the most useful file first — a one-page brief beats a 40-page manual.', M + 16, boxTop + 33, 10, 'F1', soft);
text('Name the file so it is obvious what it contains, e.g. dashboard-spec.pdf.', M + 16, boxTop + 49, 10, 'F1', soft);

const footer = 'This file ships with the starter template — replace it.';
text(footer, M + (COL_W - approxWidth(footer, 8)) / 2, 780, 8, 'F1', faint);

// ---------- 组装 PDF ----------
const content = ops.join('\n');
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(W)} ${n(H)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) {
  pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

mkdirSync('public/docs', { recursive: true });
writeFileSync('public/docs/sample-doc.pdf', Buffer.from(pdf, 'latin1'));

// ---------- 自检：确认每个 xref 偏移都指向正确的对象 ----------
const buf = Buffer.from(pdf, 'latin1');
offsets.forEach((off, i) => {
  const at = buf.subarray(off, off + 12).toString('latin1');
  if (!at.startsWith(`${i + 1} 0 obj`)) {
    throw new Error(`xref 偏移错误：对象 ${i + 1} 指向 "${at}"`);
  }
});
if (!pdf.endsWith('%%EOF\n')) throw new Error('缺少 %%EOF');

console.log(`OK  public/docs/sample-doc.pdf  ${buf.length} bytes  xref 校验通过`);
