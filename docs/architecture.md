# 站点架构：交互、数据、护栏

> 这份文档说明「哪些是标准、怎么接、怎么验证」。改代码前后都该看一眼。
> 最后更新：2026-11-03

---

## 一、三层结构

```
┌─ 交互层（标准模块，改一处全站生效）
│   src/scripts/rail.ts      横排频道：选中 / 开关机 / ← → / Enter / Esc
│   src/scripts/archive.ts   就地展开：开合 / 2×2 分页 / 焦点框 / 背景 / 播放层 / 返回
│
├─ 数据层（内容与文案）
│   src/content/**/*.md      文章、AI 项目（Astro content collection）
│   src/data/copy.csv        全站短文案（107 条），构建时导入
│   src/data/vfx.ts          特效作品那 5 条视频
│
└─ 页面层（只做接线：DOM + 数据 + 回调）
    src/pages/works.astro          五个方向
    src/pages/articles/index.astro 三个文件夹
    src/pages/works/ai/index.astro AI 列表（独立页，标准样板）
```

**原则**：页面只负责"这一页有什么"，行为交给模块。想给某页特例就传 options，不要复制代码。

---

## 二、rail.ts（横排频道）

```ts
const rail = initRail({
  track: '.ar-track',        // 容器（事件委托挂这里）
  tile: '.ar-tile',          // 方块选择器
  getTiles: () => [...],     // 可选：动态轨道（两级页面用）
  onSelect: (tile) => {...}, // 选中后写 hero
  slide: (tile) => {...},    // 可选：轨道平移
  onEnter: () => {...},      // Enter 做什么（默认点一下当前方块）
  onEscape: () => {...},     // Esc 做什么
  initial: 0,                // 初始选第几块；null = 先不选
});
```

它做：`.is-on` 切换、`powerOn/powerOff`、悬停/聚焦即选中、键盘。
它不做：hero 文案、轨道位移、锁定拦截（这些是页面的）。

**踩过的坑**：初始化必须走 `select(0, true)` 而不是 `paintHero(tile)`，
否则 `current` 还是 -1，第一次按 → 只是重选第 0 块，看起来像"方向键没反应"。

---

## 三、archive.ts（就地展开存档）

```ts
const archive = initArchive({
  root: document.querySelector('.ws-main'),
  grid: document.querySelector('[data-vfx-track]'),
  channels: {                 // 一个频道一份数据
    vfx: { id: 'vfx', title: '特效作品', items: [/* video 卡 */] },
    ai:  { id: 'ai',  title: 'AI 功能', items: [/* link 卡 */] },
  },
  pageSize: 4,                // 2×2
  urlParam: 'ch',             // ?ch=vfx 直达
  player: { box, video },     // 可选：视频卡的全屏层
  onToggle: (open, channel) => {...},   // 频道条高亮哪个
});
```

**卡片两种**：

| kind | 用于 | 点击 |
| --- | --- | --- |
| `video` | 特效作品 | 全屏播放 |
| `link` | AI 项目、文章 | 跳 `item.href` |

没内容 → 网格留空 + 一行灰字（`emptyText`，默认「还没有内容」），页码自动藏起来。

**URL**：`?ch=<频道id>`。换频道时 `pushState` 会带上 id，刷新/分享能回到同一个频道。

---

## 四、文案表（copy.csv）

```
id,area,zh,state,note
ui.back,通用/返回,返回,在用,存档态左下角那个 ○ 返回
ui.imported,通用/状态,已导入 {n} 个,在用,{n} 自动替换
```

- 页面用 `t('id', '兜底字')` / `tf('id', { n: 5 }, '兜底字')`
- `state`：`在用` / `待定` / `废弃`（废弃的不导入）
- build 时自动跑 `scripts/copy-import.mjs` 生成 `src/data/copy.generated.ts`

**三种"没有字"的写法，意思不一样**：

| 写法 | 效果 |
| --- | --- |
| **格子留空**（zh 空着，state 在用） | 这条存在但不显示 —— 临时关掉某句用它 |
| **删掉整行** | 页面用代码里的兜底字（可能又冒出来） |
| **state 改废弃** | 不导入，页面用兜底字 |

**分段**：一个格子里想写多段，用 `|` 隔开（或者在格子里真换行）。
简介页按 `|` / 换行拆成多个 `<p>`，并会清掉中文标点后的多余空格
（Excel/WPS 常把换行存成空格，不清就会显示成「怪物设计。 爱好」）。

> ⚠️ **保存格式：必须选「CSV UTF-8」**
>
> WPS / Excel 默认存成 **ANSI(GBK)**，导入脚本虽然能兜底读（会打一行警告），
> 但**超出 GBK 范围的字符会真的丢字**（emoji、生僻符号、某些特殊标点）。
> 实测已经踩过两次：整张表 2422 个汉字变成乱码，靠 GBK 解码才救回来。
> 所以：另存为 → 文件类型选 **CSV UTF-8**，别用默认的「CSV (逗号分隔)」。

---

## 五、护栏（改完必跑）

```bash
npm run probe      # 交互探针：45 条断言，约 40 秒
npm run console    # 逐页抓运行时错误（13 页）
npm run check      # 链接 / 隔离 / 文案引用
```

**为什么需要 console**：Astro 构建不做类型检查，`.astro` 的 `<script>` 里用了
不存在的变量也能构建通过，只在浏览器里炸（`t is not defined`，整段脚本失效）。
`check-console.mjs` 就是把这类问题变成能提前发现的问题。

**探针的写法约定**：
- 只断言状态（class / 属性 / 文本），不断言动画 —— 无头环境 CSS transition 会冻住
- 会"按到它变"而不是"按一次看结果"（脚本可能 1.5s 后才装好监听）
- 会跳走的操作（link 卡点击）先改 `data-href` 再点，避免探针被打断

---

## 六、已知缺口

| 项 | 说明 |
| --- | --- |
| `/works/ai/` 成了孤儿页 | AI 功能改成就地展开后，没有入口指向它。项目详情 `/works/ai/<slug>/` 仍从网格卡进入 |
| 文章页存档视觉与作品页有细微差别 | 频道条抬 -30（作品页 -58），因为它的轨道本来就高 |
| 卡片不可聚焦 | 纯键盘用户只能靠 ← → 选，Tab 到不了卡片 |
| 触屏 | 边缘热区靠 hover，触屏翻不了组（可用 ← → / 返回 / 页码提示） |
| reduced-motion | 覆盖不全（焦点框、背景淡入未关） |
