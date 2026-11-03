#!/usr/bin/env node
/**
 * 交互探针
 * ------------------------------------------------------------------
 * 用无头 Edge 跑一遍关键交互路径，输出 pass/fail。
 * 目的：动"标准逻辑"（rail / 就地展开）之前先跑这个，确认没把别的页面修坏。
 *
 * 断言只看「状态」不看「动画」：无头环境下 CSS transition 会停住，
 * 但 class / 属性 / 文本是同步生效的，拿它们判断最稳。
 *
 * 用法：
 *   npm run probe
 *   node scripts/probe-interactions.mjs works     # 只跑名字里带 works 的
 *
 * 前提：预览服务在跑（node node_modules/astro/astro.js preview --port 4321）。
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:4321';

const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));

const CASES = [
  {
    id: 'works-archive',
    page: 'works',
    title: '作品页 → 特效频道：展开 / 翻卡 / 翻页 / 播放 / ESC 分层 / 背板返回',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const shell = document.querySelector('.ws-main');
      const player = document.querySelector('[data-player]');
      const out = [];
      let cards = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });

      const tile = [...document.querySelectorAll('.ws-rail .ws-tile')]
        .find((t) => t.getAttribute('href') === '#vfx');

      check('找到特效方块', !!tile);
      tile && tile.click();
      await sleep(400);
      cards = [...document.querySelectorAll('.ws-vfx-card')];
      check('进入存档（.is-vfx）', shell.classList.contains('is-vfx'));
      check('卡片渲染出来了', cards.length === 5, String(cards.length));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      await sleep(200);
      check('→ 选中第 2 张', cards[1]?.classList.contains('is-on'));

      for (let i = 0; i < 3; i += 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        await sleep(120);
      }
      await sleep(200);
      check('→ 越过第 4 张 → 第 2 页', shell.classList.contains('vfx-at-end'));
      check('第 2 页选中的是第 5 张', cards[4]?.classList.contains('is-on'));
      check('页码 = 02 / 02', (document.querySelector('[data-pager]')?.textContent ?? '').includes('02'));

      for (let i = 0; i < 4; i += 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        await sleep(120);
      }
      await sleep(200);
      check('← 回到第 1 页', shell.classList.contains('vfx-at-start'));

      cards[0].click();
      await sleep(300);
      check('点选中的卡 → 播放层打开', player.classList.contains('is-on'));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(200);
      check('ESC 一次：只关播放层', !player.classList.contains('is-on') && shell.classList.contains('is-vfx'));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(200);
      check('ESC 两次：退出存档', !shell.classList.contains('is-vfx'));

      tile && tile.click();
      await sleep(400);
      document.querySelector('[data-backdrop]')?.click();
      await sleep(200);
      check('点空白背板 → 退出存档', !shell.classList.contains('is-vfx'));

      return out;
    `,
  },
  {
    id: 'works-switch-channel',
    page: 'works',
    title: '作品页：存档里直接换频道（特效 → AI → 空频道），面包屑/页码跟着变',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const shell = document.querySelector('.ws-main');
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const tileOf = (href) => [...document.querySelectorAll('.ws-rail .ws-tile')]
        .find((t) => t.getAttribute('href') === href);
      /* 进存档会在面包屑后面再补一段 .here，所以要取最后一个 */
      const here = () => [...document.querySelectorAll('.crumbs .here')].pop()?.textContent?.trim() ?? '';

      tileOf('#vfx').click();
      await sleep(400);
      check('进特效频道', here() === '特效作品', here());

      tileOf('#ai').click();
      await sleep(400);
      check('换到 AI 频道', here() === 'AI 功能', here());
      check('AI 卡片渲染', document.querySelectorAll('.ws-vfx-card').length > 0,
        String(document.querySelectorAll('.ws-vfx-card').length));

      tileOf('#game-demo').click();
      await sleep(400);
      check('换到空频道', here() === '游戏 DEMO', here());
      check('空态出现', !!document.querySelector('.ws-vfx-empty'));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(200);
      check('ESC 退出', !shell.classList.contains('is-vfx'));

      return out;
    `,
  },
  {
    id: 'works-empty-channel',
    page: 'works',
    title: '作品页 → 空频道（游戏 DEMO）：展开后是空态，不是空白',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const shell = document.querySelector('.ws-main');
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });

      const tile = [...document.querySelectorAll('.ws-rail .ws-tile')]
        .find((t) => t.getAttribute('href') === '#game-demo');

      check('找到游戏 DEMO 方块', !!tile);
      tile && tile.click();
      await sleep(400);
      check('进入存档', shell.classList.contains('is-vfx'));
      check('没有卡片', document.querySelectorAll('.ws-vfx-card').length === 0);
      const empty = document.querySelector('.ws-vfx-empty');
      check('有「还没有内容」', !!empty && (empty.textContent ?? '').includes('还没有内容'), empty?.textContent ?? '');
      check('页码藏起来', document.querySelector('[data-pager]')?.hidden !== false);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(200);
      check('ESC 退出', !shell.classList.contains('is-vfx'));

      return out;
    `,
  },
  {
    id: 'works-destroy',
    page: 'works',
    title: '作品页：销毁战策经验 → 4 格重编号、不选中、悬停不再错位',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const tiles = () => [...document.querySelectorAll('.ws-rail .ws-tile')];
      const title = () => (document.querySelector('[data-hero-title]')?.textContent ?? '').trim();

      const combat = tiles().find((t) => t.getAttribute('href') === '/articles/?from=combat');
      check('找到战策经验', !!combat);
      combat.click();

      await sleep(3400);
      check('剩 4 个方向', tiles().length === 4, String(tiles().length));
      check('重新编号 01-04', tiles().map((t) => t.querySelector('.ws-num')?.textContent).join(',') === '01,02,03,04',
        tiles().map((t) => t.querySelector('.ws-num')?.textContent).join(','));
      check('销毁后没有选中项', tiles().every((t) => !t.classList.contains('is-on')));
      check('整理进度变 2 / 4', (document.querySelector('[data-stat]')?.textContent ?? '').includes('2 / 4'),
        document.querySelector('[data-stat]')?.textContent ?? '');

      /* 悬停第二格：下标必须当场算，不能沿用闭包里的旧下标 */
      tiles()[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      tiles()[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      await sleep(400);
      check('悬停第二格选中的也是第二格', tiles().findIndex((t) => t.classList.contains('is-on')) === 1,
        String(tiles().findIndex((t) => t.classList.contains('is-on'))));
      check('标题跟着是 AI 功能', title() === 'AI 功能', title());

      return out;
    `,
  },
  {
    id: 'works-link-card',
    page: 'works',
    title: '作品页 → AI 频道：卡片是跳转型（没有视频、带 href）',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const player = document.querySelector('[data-player]');
      const tile = [...document.querySelectorAll('.ws-rail .ws-tile')]
        .find((t) => t.getAttribute('href') === '#ai');

      tile && tile.click();
      await sleep(400);
      const cards = [...document.querySelectorAll('.ws-vfx-card')];
      check('AI 频道有卡片', cards.length > 0, String(cards.length));
      check('卡片带跳转地址', !!cards[0]?.getAttribute('data-href'), cards[0]?.getAttribute('data-href') ?? '');
      check('卡片不是视频（没有 video 元素）', !cards[0]?.querySelector('video'));
      check('进入存档后播放层是关的', !player.classList.contains('is-on'));

      return out;
    `,
  },
  {
    id: 'works-history',
    page: 'works',
    title: '作品页：URL / 后退 — 关掉存档后地址栏干净，浏览器后退能关',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const shell = document.querySelector('.ws-main');
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const tile = [...document.querySelectorAll('.ws-rail .ws-tile')]
        .find((t) => t.getAttribute('href') === '#vfx');

      tile && tile.click();
      await sleep(400);
      check('开存档后 URL 带 ch', location.search.includes('ch='), location.search);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(300);
      check('关存档后 URL 干净', !location.search.includes('ch='), location.search || '(空)');
      check('关存档后类名去掉', !shell.classList.contains('is-vfx'));

      tile && tile.click();
      await sleep(400);
      history.back();
      await sleep(500);
      check('浏览器后退能关存档', !shell.classList.contains('is-vfx'));

      return out;
    `,
  },
  {
    id: 'works-rail',
    page: 'works',
    title: '作品页 rail：方向键换方向、hero 跟着变',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const title = () => (document.querySelector('[data-hero-title]')?.textContent ?? '').trim();

      const first = title();
      for (let i = 0; i < 8 && title() === first; i += 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        await sleep(260);
      }
      check('→ 后 hero 变字', title() !== first, first + ' → ' + title());

      return out;
    `,
  },
  {
    id: 'ai-rail',
    page: 'works/ai',
    title: 'AI 功能（标准样板）：方向键换项目、hero 跟着变',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const title = () => (document.querySelector('[data-hero-title]')?.textContent ?? '').trim();
      const tiles = [...document.querySelectorAll('[data-tile]')];

      check('至少有 2 个方块', tiles.length >= 2, String(tiles.length));

      const first = title();
      for (let i = 0; i < 8 && title() === first; i += 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        await sleep(260);
      }
      check('选中第 2 个', tiles[1]?.classList.contains('is-on'));
      check('hero 跟着变', title() !== first, first + ' → ' + title());

      return out;
    `,
  },
  {
    id: 'articles',
    page: 'articles',
    title: '文章页：点文件夹 → 展开文章网格 → 卡片可跳转 → ESC 返回',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const shell = document.querySelector('.ar-main');
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });

      const tiles = [...document.querySelectorAll('.ar-tile')];
      const h1 = () => (document.querySelector('[data-h1]')?.textContent ?? '').trim();
      check('开局有选中', !!document.querySelector('.ar-tile.is-on'), String(tiles.length) + ' 个文件夹');

      /* 悬停要能把下面的标题换掉（rail 用的是 mouseover 委托，不是 mouseenter） */
      const before = h1();
      tiles[1]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await sleep(300);
      check('悬停第二个文件夹 → 标题跟着变', h1() !== before, before + ' → ' + h1());

      const first = tiles[0];
      first && first.click();
      await sleep(400);
      const cards = [...document.querySelectorAll('.ws-vfx-card')];
      check('点文件夹 → 进入存档', shell.classList.contains('is-vfx'));
      check('文章卡片渲染出来', cards.length > 0, String(cards.length));
      check('卡片带跳转地址', !!cards[0]?.getAttribute('data-href'), cards[0]?.getAttribute('data-href') ?? '');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(200);
      check('ESC 退回频道条', !shell.classList.contains('is-vfx'));

      const second = tiles[1];
      second && second.click();
      await sleep(400);
      check('再点另一个文件夹也能展开', shell.classList.contains('is-vfx'));
      const pager = document.querySelector('[data-pager]');
      check('页码显示', !!pager && !pager.hidden, pager?.textContent?.trim() ?? '');

      return out;
    `,
  },
  {
    id: 'about',
    page: 'about',
    title: '联系页：方向键换频道、hero 跟着变',
    code: `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      const check = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
      const title = () => (document.querySelector('[data-hero-title]')?.textContent ?? '').trim();
      const onIdx = () => [...document.querySelectorAll('.ab-tile')].findIndex((t) => t.classList.contains('is-on'));

      const first = title();
      const firstIdx = onIdx();
      for (let i = 0; i < 8 && onIdx() === firstIdx; i += 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        await sleep(260);
      }
      check('→ 后选中下一个方块', onIdx() !== firstIdx, firstIdx + ' → ' + onIdx());
      check('→ 后 hero 变字', first !== title(), first + ' → ' + title());

      return out;
    `,
  },
];

const probeScript = (code) => `
<script>
(async () => {
  const run = async () => { ${code} };
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const out = await run();
    const box = document.createElement('div');
    box.id = '__probe';
    box.textContent = JSON.stringify(out);
    document.body.appendChild(box);
  } catch (error) {
    const box = document.createElement('div');
    box.id = '__probe';
    box.textContent = JSON.stringify([{ name: '脚本抛错', ok: false, info: String(error) }]);
    document.body.appendChild(box);
  }
})();
</script>`;

function runCase(item) {
  const src = join(DIST, item.page, 'index.html');
  const html = readFileSync(src, 'utf8');
  const tmpName = `__probe-${item.id}.html`;
  const tmp = join(DIST, tmpName);
  writeFileSync(tmp, html.replace('</body>', probeScript(item.code) + '</body>'), 'utf8');

  const profile = join(ROOT, 'tmp', 'probe', item.id);
  const res = spawnSync(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${profile}`,
      '--window-size=1280,860',
      '--virtual-time-budget=16000',
      '--dump-dom',
      `${BASE}/${tmpName}`,
    ],
    { encoding: 'utf8', timeout: 90_000, maxBuffer: 32 * 1024 * 1024 },
  );

  try {
    unlinkSync(tmp);
  } catch {
    /* 清理失败不影响结果 */
  }

  const dom = res.stdout ?? '';
  const match = dom.match(/<div id="__probe">([\s\S]*?)<\/div>/);
  if (!match) return { error: '页面里没拿到探针结果（脚本没跑完 / 页面报错）' };

  const raw = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  try {
    return { results: JSON.parse(raw) };
  } catch {
    return { error: '探针结果不是合法 JSON：' + raw.slice(0, 120) };
  }
}

const selected = CASES.filter((c) => !filter || c.id.includes(filter) || c.page.includes(filter));
if (!selected.length) {
  console.error(`没有匹配 "${filter}" 的用例`);
  process.exit(1);
}

let pass = 0;
let fail = 0;
const failures = [];

for (const item of selected) {
  const { results, error } = runCase(item);
  console.log('');
  console.log('▌ ' + item.id + ' — ' + item.title);

  if (error) {
    console.log('  ✗ ' + error);
    fail += 1;
    failures.push(item.id + '：' + error);
    continue;
  }

  for (const r of results) {
    if (r.ok) {
      pass += 1;
      console.log('  ✓ ' + r.name + (r.info ? '  [' + r.info + ']' : ''));
    } else {
      fail += 1;
      console.log('  ✗ ' + r.name + (r.info ? '  [' + r.info + ']' : ''));
      failures.push(item.id + ' / ' + r.name);
    }
  }
}

console.log('');
console.log(`结果：${pass} 通过 / ${fail} 失败`);

if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  · ' + f);
  process.exit(1);
}
