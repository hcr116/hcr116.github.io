// 文章页方框「老电视」演示页（只写进 dist，不参与构建）
// 用 ?s=idle|live|switch 强制某个状态，方便逐张截图再拼在一起
// 用法：node scripts/_mk-crt-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist/articles/index.html', 'utf8');

const style = `
<style>
  /* 演示页只留第 2 块，放大到选中尺寸，三张图裁同一个位置就能对齐 */
  .ar-track[data-set='root'] .ar-tile:not(:nth-child(2)) {
    display: none;
  }

  .ar-track[data-set='root'] .ar-tile:nth-child(2) {
    width: 184px !important;
    height: 184px !important;
  }

  .ar-glow {
    display: none;
  }

  /* 演示用：把换台那一瞬钉住，截图才稳定 */
  .force-switch .ar-flash {
    animation: none !important;
    opacity: 0.42 !important;
  }

  .force-switch .ar-art,
  .force-switch .ar-scan,
  .force-switch .ar-noise {
    animation: none !important;
  }

  .force-switch .ar-art,
  .force-switch .ar-scan {
    transform: translateX(-3px);
  }

  .force-switch .ar-noise {
    animation: none !important;
    background-position: -17px 9px;
    opacity: 1 !important;
  }

  .force-live .ar-noise {
    background-position: 13px -15px;
  }

  .force-live .ar-art {
    filter: brightness(0.95) !important;
  }

  .force-switch .ar-art {
    filter: brightness(1.12) !important;
  }

  /* 换台那一帧不要把字挡住，方便看清“上一个画面正在消失” */
  .force-switch .ar-name {
    opacity: 0.35;
  }
</style>
`;

let out = src.replace('</head>', `${style}</head>`);

const script = `
<script>
  window.addEventListener('load', () => {
    const state = new URLSearchParams(location.search).get('s') || 'idle';
    // 拿第 2 块（默认是待机的）来演示，避免和“选中”混淆
    const tile = document.querySelectorAll('.ar-track[data-set="root"] .ar-tile')[1];
    if (!tile) return;
    if (state === 'live') tile.classList.add('force-live', 'is-live');
    if (state === 'switch') tile.classList.add('force-switch', 'is-live', 'is-switching');
  });
</script>
`;

out = out.replace('</body>', `${script}</body>`);

writeFileSync('dist/crt-demo.html', out, 'utf8');
console.log('written dist/crt-demo.html');
