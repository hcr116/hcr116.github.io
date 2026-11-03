// 生成「阿比斯恢复动效 + 落款居中」的示意图页（只写进 dist，不参与构建）
// 用法：node scripts/_mk-proposal.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist/index.html', 'utf8');

const oldBtn =
  '<button type="button" class="is-locked" data-locked aria-disabled="true"> <span class="n">05</span> 阿比斯 </button>';
const newLink =
  '<a href="/abyss/" class="is-signal" data-dive="on"> <span class="n">05</span> 阿比斯 </a>';
if (!src.includes(oldBtn)) throw new Error('没找到锁定的按钮，构建产物变了？');

/* ---------- 对照组（现状）：只把淡入拉直，不改任何东西 ---------- */
const baseStyle = `
<style>
  .tp-scene {
    opacity: 1 !important;
    transition: none !important;
  }

  .tp-foot {
    opacity: 1 !important;
    transition: none !important;
  }
</style>
`;

writeFileSync(
  'dist/title-control.html',
  src.replace('</head>', `${baseStyle}</head>`),
  'utf8'
);

/* ---------- 方案：阿比斯恢复动效 + 落款居中 ---------- */
let out = src.replace(oldBtn, newLink);

// 2) 落款居中：1fr auto 1fr 三栏，中间那栏永远在正中，右边社交贴右
const style = `
<style>
  /* —— 示意图改动 —— */
  /* 无头浏览器会把 1.6s / 1s 的淡入冻在半路，这里直接给到终态，截图才看得清 */
  .tp-scene {
    opacity: 1 !important;
    transition: none !important;
  }

  .tp-foot {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: baseline;
    gap: 24px;
    opacity: 1 !important;
    transition: none !important;
  }

  .tp-credit {
    grid-column: 2;
    justify-self: center;
    text-align: center;
  }

  .tp-social {
    grid-column: 3;
    justify-self: end;
  }

  /* 指认用：示意图里把改动的地方框一下（真落地时删掉） */
  .mark-signal {
    outline: 1px dashed rgba(56, 232, 255, 0.45);
    outline-offset: 4px;
  }

  .mark-foot {
    outline: 1px dashed rgba(255, 255, 255, 0.18);
    outline-offset: 10px;
  }
</style>
`;

out = out.replace('</head>', `${style}</head>`);

// 3) 让爆发态出现：无头浏览器没有鼠标，这里持续派发 mouseenter 触发 fire()
const script = `
<script>
  window.addEventListener('load', () => {
    const link = document.querySelector('a.is-signal');
    const foot = document.querySelector('.tp-foot');
    if (foot) foot.classList.add('mark-foot');
    if (link) link.classList.add('mark-signal');
    // 每 260ms 触发一次抖动，截图时基本总能抓到爆发帧
    setInterval(() => {
      if (link) link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    }, 260);
  });
</script>
`;

out = out.replace('</body>', `${script}</body>`);

writeFileSync('dist/title-proposal.html', out, 'utf8');
console.log('written dist/title-proposal.html');
