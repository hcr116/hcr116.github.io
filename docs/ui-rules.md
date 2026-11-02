# 全站界面统一规则（UI Rules）

> 这份文件是**规范**，不是建议清单。页面可以长得不一样，但必须能对上这里的每一条；
> 对不上的地方，要么改页面，要么改这份文件——不允许"就这样吧"。
>
> 现状依据：2026-11-02 对 `localhost:4321` 的 9 个页面截图 + `src/` 全量代码比对。
> 证据与清单见第 2 节，规则正文见第 3 节，落地顺序见第 4 节。

---

## 0. 一句话结论

站点现在**不是"排版不统一"，是有四套互不相干的界面系统在同居**：

| 系统 | 特征 | 现有页面 |
| --- | --- | --- |
| A 归档（浅色） | 米白底、宋体大标题、细线、棕色强调、`--ink/--line/--accent` | `/home/`、`/404`、`/timeline/`、`/works/[id]/` |
| B 游戏机（深色像素） | 近黑底、Zpix 像素字体、横向轨道、胶囊按钮、冷光斑 | `/`、`/works/`、`/articles/`、`/brief/` |
| C 联系（深色衬线） | 深色底、Bodoni 巨字压轴线、整行反白 | `/about/` |
| D 阅读（深色无衬线） | 深色底、无衬线正文、左侧页签 + 目录树、sticky 状态条 | `/articles/combat/`、`/articles/play/`、`/articles/assets/` |

四套系统的字体、字距、按钮、返回方式、底部条全都不一样；A 和 B 甚至对"作品"这个词指向了两个不同的页面。
**规则的目标不是把四套合成一套**，而是：

1. 明确只保留 **2 个皮肤**（A 纸 / B 屏），砍掉 C，把 D 并入 B；
2. 明确只保留 **3 种骨架**（入口幕 / 索引轨 / 阅读页），页面 = 骨架 × 皮肤，不允许自由发挥；
3. 把"像素级自由度"从每个页面收回到 **token 层**（颜色、字号、间距、时长各一套）。

---

## 1. 术语

- **域（domain）**：一个内容主题 + 它的入口页 + 它的内容页。当前四个域：`works`、`articles`、`profile`（简介/联系）、`meta`（404、时间线）。
- **皮肤（skin）**：配色 + 字体气质。只有两个：`skin-paper`（浅色归档）、`skin-screen`（深色屏幕）。
- **骨架（shell）**：页面的结构模板。只有三个：`shell-cover`（入口幕）、`shell-rail`（索引轨）、`shell-doc`（阅读页）。
- **皮肤跟随域，骨架跟随层级**：同一个域内，列表页和详情页必须同皮肤；层级越深，骨架从 cover → rail → doc 单向推进。

---

## 2. 现状诊断（证据）

### 2.1 九页对照表

| 页面 | 皮肤 | 左上角 | 时钟/元信息 | 大标题位置 | 选中项尺寸 | 主按钮 | 底部元素 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | B | 无（隐藏 nav） | 无 | 屏幕中央，衬线 96px | — | 菜单 5 项（`01 简介`…） | 音量 + 社交 + 落款 |
| `/home/` | A | 「返回」→ `/` | 无 | 正文顶部，宋体 `clamp(2rem,5.2vw,3.4rem)` | — | 虚线占位块内 `.button` | 无 |
| `/brief/` | B | 「返回」→ `/` | 无 | `pf-head` 左，Bodoni 44–72px | — | 描边链接「看拆解 →」 | `.au-status`（**无样式**） |
| `/about/` | C | 「返回」+ nav | 无 | 绝对定位压在 22% 轴线上，44–76px | 整行反白 | 整行可点 + 复制 | `.ct-foot` |
| `/works/` | B | 「返回」 | **右上** | 轨道**下方**，Zpix 34–52px | 104 → **176**（×1.69） | `▶ 打开` 13px/min 200/padding 13×30 | `.ws-bar` + `.ws-card`（进度卡） |
| `/articles/` | B | 「返回」 | **左上** | 轨道**上方**，Zpix 30–46px | 112 → **184**（×1.64） | `✕ 打开文件夹` 12px/min 176/padding 12×26 | `.ar-bar`（无卡片） |
| `/articles/combat/` | D | 「返回」 | 无 | 文章头，**无衬线 800** 42px | 左侧页签（竖排） | 无 | sticky `.au-status` + 进度条 |
| `/articles/play/` | D | 「返回」 | 无 | 文章头，无衬线 800 | — | 无 | `.works-foot` 两个文字链 |
| `/404` | A | 「返回」+ nav | 无 | 居中偏左，宋体 | — | `.button` ×2 | 无 |

### 2.2 硬伤清单（按修复优先级）

| # | 问题 | 位置 | 影响 |
| --- | --- | --- | --- |
| 1 | 两个"作品"入口指向不同页：header nav「作品」→ `/home/`（在该页还是自身链接），首页菜单「作品」→ `/works/`；「关于」和「联系」都指 `/about/` | `Base.astro:64`、`index.astro:17-21` | IA 分叉，用户走两次会遇到两个不同的作品列表 |
| 2 | 选中块右侧的名字（`.ar-inline` / `.ws-inline`）压在动作行上，1280 以下和 `怪物`/`游戏 DEMO` 都撞按钮 | `ar-ps.css:322-339`、`works-ps.css:199-225` | 首屏最显眼的位置是坏的 |
| 3 | 标题位置相反：articles 在轨道上方，works 在轨道下方。`ar-ps.css:435-457` 已经写好了"和作品页同一套骨架"的 `order` 规则，但 markup 里没有 `.ar-hero` → **整段是死代码** | `ar-ps.css:435-457` vs `index.astro:122` | 两页切换时视线要重新找标题 |
| 4 | 时钟一左一右：`.ar-top{justify-content:space-between}`（返回隐藏后掉到左边）vs `.ws-top{flex-end}` | `ar-ps.css:93`、`works-ps.css:66` | 同一个组件两种位置 |
| 5 | 顶栏高度假设三套：`100svh - 76px`（ar/ws）、`100svh - 64px`（article-ui/profile/contact），而实际 `.header-inner` 是 `padding-block:1.15rem` ≈ 64px | `ar-ps.css:17`、`works-ps.css:13`、`article-ui.css:15`、`profile.css:16`、`contact.css:7`、`global.css:132-138` | PS 两页永远多出 12px 滚动，底栏被切 |
| 6 | `/brief/` 用了 `.au-status`，但这个类只存在于 `article-ui.css`，brief 没 import → 底部状态条渲染成裸文本 | `brief.astro:100`、`article-ui.css:214` | 简介页底部是坏的 |
| 7 | `/articles/combat/` 提示「ESC 返回 · J K 翻页」，脚本里没有任何 ESC/J/K 处理 | `combat.astro:122`、`combat.astro:126-383` | 说明书在骗人 |
| 8 | 列表 → 详情断片：`/works/` 深色轨道，详情 `/works/[id]/` 浅色归档；`/articles/` 深色轨道，正文却是无衬线阅读页 | `works/[id].astro`、`global.css:3228+` | 点进去像换了一个站 |
| 9 | `works.astro` 给每个方块传了 `data-tone` / `style="--tone:…"`，但 `works-ps.css` **从未使用** `var(--tone)`（只有 `ar-ps.css` 用） | `works.astro:44-48`、`works-ps.css` 全文 | 五个分类色是死数据，方块全是同一个灰 |
| 10 | 按钮文案与图标三套：`▶ 打开` / `✕ 打开` / `✕ 打开文件夹`。✕ 在别处表示关闭 | `works.astro:65`、`index.astro:182,264` | 同一个动作三种写法 |
| 11 | 死样式与互相覆盖：`.ws-tabs`（23 行）无 markup；`article-ui.css` 220 行 `au-*` 只用到一个 `.au-status`；`global.css` 末尾 5 段 `.mode-toggle` 互相覆盖；全站 51 个 `!important` | 见各文件 | 改一处不知道会不会炸别处 |
| 12 | 移动端轨道溢出被 `overflow:hidden` 裁掉，无滚动、无降级 → 真机 390 下第 3 项之后**点不到** | `ar-ps.css:20`、`works-ps.css:16` | 手机上无法触达第 4、5 项 |
| 13 | 同一内容三处长度不一致：`/` 的"18 章 / 12 款 / 156 张"、`/brief/` 的同组数字、`combat` 底栏"01 / 03 章" | `index.astro`、`brief.astro:64-67`、`combat.astro:120` | 数字互相打脸 |

### 2.3 量化体检

| 指标 | 现状 | 目标 |
| --- | --- | --- |
| CSS 总量 | 11 个文件 / 9,936 行 | 4 个文件 / ≤2,400 行 |
| 独立色值（hex） | **234** 个 | ≤ 20（全在 token 里） |
| `rgba()` 裸写 | **455** 处 | 0（用 token） |
| 白色透明度档位 | **49** 档（0.008–0.94） | 5 档 |
| 字号声明 | **63** 种（含 9/10/11/13/26/34px 等） | 9 档 |
| Zpix 字号 | 9/10/11/12/13/15/18/20/22/24/26/34/44px… | 12 / 24 / 36 / 48 / 96 |
| 字距声明 | 16 种，px 与 em 混用 | 5 档，统一 px（Zpix）/ em（正文）|
| `border-radius` | 13 种（1/2/3/4/5/6/7px/50%/999px…） | 4 种 |
| 过渡时长 | 30 种（0.12s–1.6s、420ms…） | 4 种 |
| 缓动曲线 | **23** 条 `cubic-bezier` | 2 条 |
| `!important` | 51 个 | 0 |
| `@font-face` | 7 处（Zpix 在 6 个文件里各写一遍） | 1 处 |
| `--gutter` 定义 | 3 处重复 | 1 处 |

---

## 3. 规则

> 每条规则后面的 ⟨⟩ 是执行方式：**[改]** 改页面 / **[收]** 收进 token / **[删]** 删代码。

### 3.1 域：一个内容域只能有一个入口、一个列表页、一种皮肤

| 域 | 入口页（唯一） | 列表骨架 | 详情骨架 | 皮肤 | 详情页 |
| --- | --- | --- | --- | --- | --- |
| `works` | `/works/` | rail | doc | screen | `/works/[id]/` |
| `articles` | `/articles/` | rail | doc | screen | `/articles/combat/`、`/articles/play/`、`/articles/assets/` |
| `profile` | `/brief/` | doc（无列表） | doc | screen | — |
| `contact` | `/about/` | rail | — | screen | — |
| `meta` | — | doc | doc | paper | `/404`、`/timeline/` |

**规则**

1. **同名必须同目标**。站点里不允许出现两个叫「作品」而 href 不同的入口。⟨改⟩
2. `header` 里的 nav 只放**域入口**，且顺序固定：`作品 / 文章 / 简介 / 联系`。当前只有 `作品 / 关于` 两项，且 `作品` 指向 `/home/` —— 必须改为 `作品 → /works/`。⟨改⟩
3. `/home/` **降级为「无 JS 兜底版」**，从 nav 和首页菜单里摘掉，只保留在 `/` 的「简易」按钮和站内 404 里；它的存在理由是"脚本挂了也能看内容"，不是第二种风格。⟨改⟩
4. 列表页与详情页**必须同皮肤**。`/works/` 深色 → `/works/[id]/` 也必须深色；`/articles/` 深色 → 三个正文页也深色（combat 已经是，play/assets 需要补正文样式）。⟨改⟩
5. 一个域内，**层级只有三种**：cover（可省）→ rail（列表）→ doc（内容）。不允许跳级（比如从 cover 直接进 doc 而没有来源页）。⟨改⟩

### 3.2 皮肤：只留两个

| | `skin-paper`（纸） | `skin-screen`（屏） |
| --- | --- | --- |
| 用途 | 无 JS 兜底页、404、纯文本页 | **其余全部**（主站界面） |
| 底 | `#faf9f7` / 暗色模式 `#121213` | `#05060c` |
| 标题字体 | 宋体（`--font-display` 的中文回退） | 同 `--font-display` |
| 界面字体（编号/按钮/提示/元信息） | 无（禁用像素字体） | Zpix |
| 正文 | 系统无衬线 | 系统无衬线 |
| 强调色 | `--a-ink` 棕 `#8a5a3b` | `--a-white` `#e8ecf2` |
| 反白填充 | 无 | `#f1f3f6` |

**规则**

1. 皮肤由 `<body class>` 决定：默认 = `skin-paper`，加 `.skin-screen` = 屏。**禁止**再出现 `.mode-fun` 之外的皮肤开关，也禁止在页面 CSS 里 `body:has(.ws-main){--fun-accent:…}` 这种就地改皮肤（`works-ps.css:380-388`）。⟨改/[收]⟩
2. 只在 `skin-screen` 里允许使用 Zpix。`skin-paper` 里出现 Zpix 视为 bug。⟨改⟩
3. 深色页必须显式写 `class="skin-screen"`，不靠"页面自己铺一个 `position:absolute;inset:0` 的背景 div"来假装深色（现在 `/works/`、`/articles/`、`/about/`、`/brief/` 各铺了一个）。⟨改⟩
4. 字体只允许 **3 个家族**：`--font-display`（Bodoni Moda + 宋体，只管中文大字与英文名）、`--font-ui`（Zpix，只管屏上的编号/按钮/提示）、`--font-body`（系统无衬线，只管正文）。⟨收⟩
5. 一屏之内**最多 2 个**字体家族。当前 `/brief/` 一屏 4 个（Bodoni + Zpix + 无衬线 + 系统 `ui-sans-serif`），`/articles/combat/` 一屏 2 个但是选错了（正文用无衬线、标题也用无衬线，Zpix 只在顶部出现一次）。⟨改⟩

### 3.3 骨架

#### `shell-rail`（索引轨）—— `/works/`、`/articles/`

```
┌ header 64px ───────────────── 左：返回    右：声音 ┐
├ shell 1080px（左右 --gutter）──────────────────────┤
│  meta row  高 44：左 路径/计数   右 时钟（12px Zpix）│   ← 时钟永远在右
│                                                    │
│  RAIL  gap 12                                       │
│  [112] [112] [176 选中] [112] …            ← 横向   │
│                                                    │
│  hero  距轨道 24：h1 40–56 / en 12 / note 15        │   ← 标题永远在轨道下方
│  actions 距 hero 20：pill + circle                 │
│                                    （弹性空白）    │
│  bar 高 40：提示 ←—线—→ 域名                       │   ← 永远最底
└────────────────────────────────────────────────────┘
```

**规则**

1. 一屏装下：`min-height: calc(100svh - var(--hdr-h))`，`--hdr-h: 64px`。**只有这一个高度假设**。⟨收⟩
2. 元素顺序固定为 `meta → rail → hero → actions → bar`，用 DOM 顺序实现，**禁止用 `order` 改排布**（`ar-ps.css:435-457` 就是靠 order 硬掰，还掰错了）。⟨删⟩
3. 时钟在 `meta row` 右侧，`12px` Zpix，前面一个 8px 圆点。没有真实用途就不显示——现在两个页面都显示"当前时间"，但它是纯装饰，**建议直接删**，把右侧位置让给「本域计数」（`3 组 · 11 篇`）。⟨改⟩
4. 选中块：`112 → 176`，`border-radius: 6px`，`gap 12px`，`border: 1px solid var(--l-1)`，选中态见 3.7。⟨收⟩
5. 选中名（`.ar-inline/.ws-inline`）**只能出现在块的右侧、与块底对齐、且必须保证右侧可用宽度 ≥ 名字宽度**；不足时改为画在块内底部（覆盖在封面上），绝不与 `actions` 行重叠。⟨改⟩
6. `actions` 行：`pill`（打开）+ `circle`（更多）。没有第二个动作就只留 pill；`.ws-more`/`.ar-more` 现在点了没有任何行为，**先删**，等真有"更多"再加。⟨删⟩
7. 底部 `bar`：`提示文字 ← 2px 线 → 域名`，高度 40，左中右三段的字号/字距一致。⟨收⟩
8. 每页允许的**装饰性卡片**最多一个（`/works/` 的"整理进度"）。要么两个 rail 页都有，要么都没有；现在只有 works 有 → 删掉，改放进 `meta row` 的右侧计数。⟨删⟩

#### `shell-doc`（阅读页）—— `/articles/combat/`、`/articles/play/`、`/brief/`、`/about/`

```
┌ header 64 ─────────────────────────────────────────┐
│ 进度条 3px（只在正文页出现，贴 header 底边）        │
├ shell ─────────────────────────────────────────────┤
│ 可选：三栏 92 / 216 / minmax(0, 672)  gap 40        │
│   左页签 │ 目录 │ 正文                              │
│   ↑1180 以下：页签变顶部横排，目录收起              │
├ 正文 ──────────────────────────────────────────────┤
│ eyebrow 12 / h1 36 / en 12 / 正文 15/1.95           │
│ …                                                   │
│ foot links：← 返回列表 · ← 回首页                   │
└────────────────────────────────────────────────────┘
```

**规则**

1. 正文列宽 `--read: 672px`（42rem），三栏时总宽仍不超过 `--wrap: 1080px`。⟨收⟩
2. 标题层级：`h1` 36px（`clamp(28px,3.2vw,36px)`）、`h2` 24px、`h3` 18px、正文 15px。**标题不许用像素字体，也不许用 800 字重**（现在是 42px/800 的无衬线，和 B 皮肤的字感完全不接）。⟨改⟩
3. `eyebrow`（`文章 · 01` / `PROFILE`）：12px，字距 0.28em，`--t-3` 色。英文副标（`COMBAT DESIGN`）：12px，字距 0.42em，`--t-3`。⟨收⟩
4. **底部 sticky 状态条取消**，改为页脚链接行 `← 返回 /articles/ · ← 回首页`。阅读页不需要"01/03 章"这种状态条——它和 rail 页的 `bar` 是两种东西，混用让人以为还在索引层。⟨改/删⟩
5. 阅读进度改用 header 底边 3px 细线；`/articles/combat/` 现有那条可以搬过去。⟨改⟩
6. 三栏里的左页签：`92px` 列，竖排，激活态"左侧 1px 亮线 + 文字变亮"，**不使用白底反色**（白底反色是 `skin-paper` 和入口菜单的语言）。⟨改⟩

#### `shell-cover`（入口幕）—— `/`

只有一页，保持现状。唯一要补的：菜单项必须是**全部 4 个域 + 阿比斯**，且和 header nav 的域名一致（`简介 / 作品 / 文章 / 联系 / 阿比斯`）。现在靠 `index.astro:17-21` 硬编码，nav 靠 `Base.astro:64` 硬编码，**两处必须从同一份配置生成**（放进 `consts.ts` 的 `NAV`）。⟨改⟩

### 3.4 布局 token

```css
:root {
  --hdr-h: 64px;                                  /* header 实际高度，唯一假设 */
  --wrap: 1080px;                                 /* 索引页版心 */
  --read: 672px;                                  /* 阅读列 */
  --gutter: max(24px, calc(50% - 540px));         /* 全站唯一左边界（已有，只留一处） */
  --gutter-sm: 20px;                              /* ≤900px */
  --gap: 12px;                                    /* 轨道/卡片间距 */
  --pad: 24px;                                    /* 区块内边距 */
}
```

**规则**

1. `--gutter` 只允许在 token 文件里定义一次（现在 `global.css:22`、`article-ui.css:4`、`profile.css:5` 各一份）。⟨收⟩
2. 间距只用 8 的倍数：`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`。`12` 是唯一允许的非 8 倍数，只用于轨道的 `gap` 和图标内边距。现有 `6/7/9/10/11/13/14/18/22/26/34/44/54px` 全部归到上面 8 档。⟨收⟩
3. 移动端左右内边距固定 `20px`，不再用 `--gutter`（`max(24px, …)` 在 390px 下算出 24，比 20 大，两页边界不一致）。⟨收⟩
4. 一屏高度的减法**只用** `var(--hdr-h)`，禁止出现 `64px` / `76px` / `100svh - 88px` 之类的魔法数。⟨收⟩

### 3.5 字号与字距

```css
/* 屏（skin-screen）——ZPix 只在这 5 个尺寸出现，全部是 12 的倍数 */
--fs-ui-sm: 12px;   /* 编号、提示、英文副标、按钮文字 */
--fs-ui:    24px;   /* 选中名、统计数字 */
--fs-ui-lg: 36px;   /* 子页标题 */
--fs-disp:  48px;   /* 页名（rail 页 h1）*/
--fs-cover: 96px;   /* 入口幕主标题（/ 已是 96）*/

/* 正文（两个皮肤共用） */
--fs-body:  15px;   /* 正文，行高 1.95 */
--fs-lead:  16px;   /* 导语，行高 1.9 */
--fs-meta:  12px;   /* 元信息 */

/* 显示级（中英混排大标题，用 --font-display） */
--fs-display: clamp(40px, 5.2vw, 76px);
```

**规则**

1. **Zpix 只允许 12 / 24 / 36 / 48 / 96**。`9/10/11/13/15/18/20/22/26/34/44px` 全部要改（`WORK` TODO 里已经写了这条，这里升级为硬规则）。理由：Zpix 是 12px 设计的点阵字体，非整数倍会被插值糊掉。⟨改⟩
2. 字距只用 5 档：`0`（正文）、`0.02em`（正文强调）、`0.14em`（中文小标题）、`0.28em`（中文 eyebrow）、`0.42em`（英文全大写）。Zpix 的 px 字距（2/3/5px）全部换成对应的 em 档，避免不同字号下比例失真。⟨收⟩
3. 正文行高 `1.95`（现在是 1.75/1.85/1.9/2.0/2.1 五种）。⟨收⟩
4. **`font-weight` 只用 400 / 600**。现在有 300/600/700/800 混用，700+ 中文在屏上会糊成一团。⟨收⟩
5. 中文与数字之间加空格（`3 组 · 11 篇`、`18 章`），中文与英文之间加空格（`用 UE5 做的`），破折号用 `——`，间隔号用 `·`。全角标点不跟在英文/数字后面。⟨改⟩

### 3.6 颜色 token

```css
/* ===== skin-screen（主站）===== */
.skin-screen {
  --s-0: #05060c;                          /* 底 */
  --s-1: #0b0c12;                          /* 卡片/块 */
  --s-2: #12141b;                          /* 浮层/代码块 */
  --t-1: #f2f0ea;                          /* 主文字 */
  --t-2: rgba(255, 255, 255, 0.62);        /* 次文字/正文 */
  --t-3: rgba(255, 255, 255, 0.38);        /* 弱文字/元信息 */
  --l-1: rgba(255, 255, 255, 0.12);        /* 细线、块的描边 */
  --l-2: rgba(255, 255, 255, 0.38);        /* 强线、激活描边 */
  --a-white: #e8ecf2;                      /* 强调（文字/线）*/
  --a-fill: #f1f3f6;                       /* 反白填充 */
  --glow: rgba(186, 208, 244, 0.16);       /* 冷光斑 */
  --shadow-1: 0 22px 60px rgba(0, 0, 0, 0.55);
}

/* ===== skin-paper（兜底）===== */
:root {
  --s-0: #faf9f7;  --s-1: #ffffff;  --s-2: #f2efea;
  --t-1: #17171a;  --t-2: #56565f;  --t-3: #8b8b95;
  --l-1: #e5e2dc;  --l-2: #d3cfc7;
  --a-white: #8a5a3b;  --a-fill: #17171a;
}
```

**规则**

1. 组件里**禁止裸写 `#hex` 和 `rgba()`**（现在 234 个 hex / 455 个 rgba 全靠手感）。阶调只有上面这些；不够用时**加 token**，不许就地写值。⟨收⟩
2. 白色透明度只允许 5 档：`0.05`（填充）、`0.12`（线）、`0.38`（强线/弱字）、`0.62`（次字）、`0.92`（近白）。现有 49 档全部归并。⟨收⟩
3. 分类色（tone）只能来自**一份**调色板，且必须真的被用到：

   | key | hex | 用途 |
   | --- | --- | --- |
   | `rust` | `#b3492f` | 游戏 / 动作 |
   | `amber` | `#a8762c` | 战策 / 数值 |
   | `teal` | `#2f6f7d` | AI / 工具 |
   | `violet` | `#6a4a86` | 爱好 / 其他 |
   | `slate` | `#3f5a75` | 特效 / 视觉 |

   定义成 `--c-rust`… 只能用于：方块封面渐变、选中块的 `box-shadow` 色、类别标签的描边。**不允许**用于文字颜色（现在 `ar-ps.css:40` 用 tone 做 120px 模糊背景层，已被 `display:none` 关掉，属于死代码）。⟨收/删⟩
4. 一个页面最多 **2 个 tone** 同时出现（当前选中项 + 它的父级），其余方块一律用 `--l-1` 描边 + 中性渐变。⟨改⟩
5. 冷光斑参数统一：`1180×620`、`blur(44px)`、`translate3d` + `rotate(-8deg)`、`cubic-bezier(0.3,0.9,0.2,1) 0.5s`。现在 works 是 `1320×700/46px/-9deg/0.6s`，articles 是 `1180×620/44px/-8deg/0.5s`。⟨收⟩

### 3.7 交互状态：一个动作只有一种表达

| 状态 | 唯一表达 | 参数 |
| --- | --- | --- |
| 轨道块未选中 | 描边 + 降亮度封面 + 名字贴底 | `border:1px solid var(--l-1)`、`filter:brightness(.66)` |
| 轨道块选中 | 放大 + 亮描边 + 外发光（tone）+ 名字移到右侧 | `176px`、`border-color:var(--l-2)`、`box-shadow:0 0 0 1px rgba(255,255,255,.16),0 24px 70px rgba(0,0,0,.6),0 0 64px -18px var(--c-*)` |
| 悬停（块） | 亮度回到 1 + 描边升到 `var(--l-2)`，**不位移、不缩放** | `transition: 0.24s var(--ease-1)` |
| 悬停（文字按钮/返回） | 底部 2px 白线 + 文字变亮，**不反白** | 见下 |
| 悬停（入口菜单） | 白条从左向右填满 + 文字反黑 | `scaleX(0)→1`，`0.22s var(--ease-2)` |
| 键盘焦点 | 2px 白色外描边，offset 3px | `:focus-visible` |
| 按下 | 亮度 ×0.9，**不加边框动画** | |

**规则**

1. "白条反色"只属于 **入口幕菜单**。屏上的其它按钮（返回、打开、页签）**不反白**，用"底部 2px 线"表达。现在 `global.css:4262-4334` 把这套反白硬塞给了 `.article-tab`、`.mode-toggle`、`.ar-back`，然后 `:4337-4375` 又用 `!important` 一段段往回改 —— 这是最典型的"规则打架"。⟨改/删⟩
2. 上述反色/描边逻辑在 `boot.css:1381-1420`、`global.css:4262-4334`、`article-ui.css:278-287` 各写了一遍，**合并成一处**，其余删除。⟨删⟩
3. 鼠标悬停**不允许**触发选中态变化（现在两页的 hover 都会改选中项并移动光斑；`works.astro:99-103` 的注释已经承认"方块会跑到光标底下，连环触发 mouseenter，看起来就是一路滚到底"）。规则：**点击 / 键盘 ←→ / Tab 焦点**才改选中，悬停只改块自身亮度。⟨改⟩

### 3.8 按钮与控件

| 类型 | 形状 | 尺寸 | 字体 | 文案 | 用在哪 |
| --- | --- | --- | --- | --- | --- |
| 主按钮 `btn-primary` | 胶囊 `border-radius:999px` | `min-width:176px; height:40px; padding:0 24px` | Zpix 12px，字距 0.28em | `打开` / `进入` / `看拆解` | rail 的 actions 行 |
| 次按钮 `btn-icon` | 圆形 `50%` | `40×40` | — | `•••` | 有真实二级菜单时才出现 |
| 文字按钮 `btn-text` | 无框、底部 2px 线 | `height:32px; padding:0 2px` | Zpix 12px，字距 0.14em | `返回` | header 左上 |
| 图标按钮 `btn-sound` | 圆形 `50%` | `28×28` | — | 图标 | header 右上 |
| 页签 `tab` | 竖排（≥1180）/横排（<1180），左侧或底部 1px 线 | `padding:8px 0 8px 12px` | 正文 15px | `怪物 / 角色 / 方法` | 阅读页左栏 |
| 标签 `chip` | 直角、1px 线 | `padding:2px 8px` | 正文 12px | 单个词 | 卡片/条目 |

**规则**

1. **动作词表**（只允许这些，其余情况先改词）：

   | 动作 | 文案 | 图标 |
   | --- | --- | --- |
   | 进入下一层 | `打开` / `打开文件夹` | `▶` |
   | 打开外链 | `查看原文` / `下载` | `↗` |
   | 返回上一层 | `返回` | `←` |
   | 回到首页 | `回首页` | 无 |
   | 关闭 | `关闭` | `✕` |

   **`✕` 只表示关闭**。`✕ 打开` / `✕ 打开文件夹` 必须改成 `▶ 打开` / `▶ 打开文件夹`。⟨改⟩
2. 返回**只在 header 左上出现一次**。页面内容和页脚里不再放第二个"返回"链接（现在 `/articles/combat/` 有 header 返回 + 页脚 `回文章 / 回首页`，`/articles/play/` 只有页脚，两边不一致）。规则：`shell-doc` 允许页脚一个 `← 返回 /articles/`（文字按钮形态），`shell-rail` 不允许。⟨改⟩
3. 按钮文字**必须是 Zpix**，`skin-paper` 下例外（用正文无衬线）。⟨改⟩
4. 所有按钮 `height ≥ 40px`（触屏下限），`skin-paper` 的 `.button` 现在只有 `padding:0.55rem 1rem` → 补到 40px。⟨改⟩
5. `min-width:176px` 统一后，`/works/` 的 200px 和 `/articles/` 的 176px 合并。⟨收⟩

### 3.9 键盘与提示

| 键 | 作用 | 出现在 |
| --- | --- | --- |
| `←` `→` | 轨道切换 | rail |
| `↑` `↓` | 页签切换 | doc（三栏时） |
| `Enter` | 打开 / 进入 | rail |
| `Esc` | 返回上一层 | rail 二级、doc |

**规则**

1. **提示语必须与实现一一对应**。写了什么键就必须真的响应，没实现就删字。当前 `/articles/combat/` 的 `ESC 返回 · J K 翻页` 三个键都没实现 → 要么实现，要么改成空。⟨改⟩
2. 提示语格式统一为 `键 动作 · 键 动作`，键用 `← → ENTER ESC` 大写，动作 2–3 字，字距 0.14em，色 `--t-3`。⟨收⟩
3. 提示只放在 `bar` 的左端（rail）或页脚（doc），**不在两个地方重复**。⟨改⟩

### 3.10 动效

```css
--ease-1: cubic-bezier(0.3, 0.9, 0.2, 1);   /* 位移：轨道滑动、光斑、块缩放 */
--ease-2: cubic-bezier(0.4, 0.6, 0.2, 1);   /* 反白填充、颜色 */
--t-fast: 0.16s;   /* 颜色 */
--t-mid:  0.24s;   /* 描边、亮度 */
--t-rail: 0.36s;   /* 轨道平移 */
--t-glow: 0.5s;    /* 光斑跟随 */
```

**规则**

1. 只允许 2 条缓动、4 个时长（现 23 条 / 30 种）。⟨收⟩
2. 转场只走一套：`xfer`（跨域）/ `dive`（入口 → 索引）。**同层不转场**；`aria` 上必须留 `data-dive="on"` 标记，由 `Base.astro` 统一绑定，页面脚本不许自己 `location.href`。⟨改⟩
3. `prefers-reduced-motion: reduce` 下：关掉光斑位移、轨道滑动、反白填充、启动自检；保留颜色变化。现有 `ar-ps.css:423`、`works-ps.css` 只有一处写了，`/works/` 和 `/articles/combat/` 都没写全 → 统一在 token 层处理。⟨改⟩

### 3.11 响应式

| 断点 | 变化 |
| --- | --- |
| `1180px` | 三栏 → 单栏（页签横排、目录收起） |
| `900px` | rail 触摸友好化（块 96→144）、`hero` 字号降一档、装饰卡片隐藏 |
| `560px` | 内边距 20、`h1` 32px、隐藏英文副标 |

**规则**

1. **横向轨道必须可滚动**：`overflow-x: auto` + `scroll-snap-type: x mandatory` + 隐藏滚动条，并且 `.wrap` 允许负 margin 出血。现在 `overflow:hidden` 直接裁掉第 4、5 项，手机上无法触达。⟨改⟩
2. 移动端允许换骨架：`shell-rail` 在 `≤560px` 可以降级为**竖排列表**（每行：编号 + 名称 + 说明），不再保留 3D 式选中态。降级必须在 CSS 里显式写出来，不允许"碰巧被裁切"。⟨改⟩
3. 一屏高度在移动端改为 `min-height: auto`（`100svh` 在 iOS 工具栏进出时会跳）。⟨改⟩
4. 隐藏的信息必须能在别处找到：`/works/` 的 `.ws-card` 在 `<900px` 直接 `display:none`，"已整理 1/5"这个信息就消失了 → 移进 `meta row`。⟨改⟩

### 3.12 文案

1. **一页只有一个 H1**，且 H1 必须是页名（`作品`/`文章`/`战斗策划经验`/`简介`/`联系`）。现在 `/works/` 的 H1 是选中项名（`游戏 DEMO`），`/articles/` 的 H1 也是选中项名（`怪物`）——页名只出现在 `<title>` 里。改法：H1 = 页名且常驻，选中项名降到 `24px` 的副标题位。⟨改⟩
2. 英文副标全大写、字距 0.42em，放 H1 下方 8px。中文里出现的英文（`UE5`、`Boss`、`AI`）保留原大小写。⟨改⟩
3. 编号两位（`01`…`05`），统计用 `3 组 · 11 篇` 这种"数字 + 量词"格式，不写"3 GROUPS · 11 ARTICLES"（中英混排不一致：`/articles/` 是英文，`/works/` 是中文 `1 / 5`）。⟨改⟩
4. 状态词表：`已有内容` / `整理中` / `暂未开放` / `待补`。只这四个，别的词（`待展开`、`待定`、`不保证好听`）一律归到这四类里。⟨改⟩
5. 数字来源唯一：`18 章 / 6.7 万字 / 12 款 / 156 张` 出现在 `/`、`/brief/`、`combat` 三处 → 全部改成从 `consts.ts` 的一个 `STATS` 读取。⟨改⟩
6. 空态文案统一：`这一格还没有内容。`（现在有"这一格还没有内容。""作品还在整理，弄好一个放一个。""还没有内容。"三种）。⟨改⟩

### 3.13 代码组织

```
src/styles/
  tokens.css      ← 唯一放 :root / 皮肤变量 / @font-face / 字体栈的地方
  base.css        ← reset、header、nav、.wrap、body、通用类（.btn-*、.chip、.bar）
  shell-rail.css  ← 索引轨骨架
  shell-doc.css   ← 阅读页骨架
  skin-paper.css  ← 兜底皮肤的少量覆盖（≤80 行）
  (页面专属 ≤ 各 40 行，且必须带页面前缀)
```

**规则**

1. 页面专属 CSS 只能改**自己页面独有的东西**，不许改 `.site-header`、`.btn-*`、`body`、`--gutter`、`--fun-*`。现在 `works-ps.css:380-388` 直接改 body 变量，必须删。⟨改/删⟩
2. **禁止 `!important`**（现 51 个）。需要覆盖就调层级或改 token。⟨改⟩
3. class 前缀统一：骨架用 `sh-`（`sh-rail`、`sh-tile`、`sh-hero`、`sh-bar`），皮肤用 `is-` 状态类（`is-on`、`is-swap`），页面用域名（`ar-`、`ws-`、`pf-`、`ct-`）。现有 `au-`（`article-ui`）整体废弃——它 220 行里只有 `.au-status` 被用到一次，而 `brief.astro` 还用错了一次。⟨改/删⟩
4. 死代码清单（可直接删）：

   | 位置 | 内容 |
   | --- | --- |
   | `article-ui.css:13-287` | 220 行 `au-*` 里实际只用到 `.au-status`/`.au-progress`（combat），其余可删 |
   | `ar-ps.css:35-47` | `.ar-wash`（`display:none`）+ 对应 markup |
   | `ar-ps.css:435-457` | `order` 那套"统一骨架"死代码 |
   | `works-ps.css:73-95` | `.ws-tabs`（无 markup） |
   | `global.css:4224-4260` | `.x-fill`（只有 `boot.css` 用 `.tp-menu`，这里是重复实现） |
   | `global.css:4337-4375` | 5 段互相覆盖的 `.mode-toggle` |
   | `profile.css:3-12`、`article-ui.css:3-11` | 重复的 `--gutter` / `@font-face` |
   | `works.astro:46-48` | 死掉的 `data-tone` / `--tone`（或反过来让 CSS 用起来，二选一） |
   | `global.css:849-935` | `.contact-list` / `.wechat-card` / `.wechat-meta`：旧联系页的样式，`/about/` 改版后已无引用 |

5. 每个 `<Base>` 必须显式传 `skin`（`paper` / `screen`）和 `shell`（`cover` / `rail` / `doc`），由 `Base.astro` 拼 class。**禁止**页面自己铺背景 div 来改皮肤。⟨改⟩

---

## 4. 落地顺序

### P0 —— 只改"看得见的错"，不动结构（✅ 2026-11-02 已完成，见第 6 节）

| # | 动作 | 文件 | 状态 |
| --- | --- | --- | --- |
| 1 | 顶栏高度统一成 `--hdr-h: 64px`，`min-height: calc(100svh - var(--hdr-h))` | `global.css` `:root` / `.site-header`、`ar-ps.css`、`works-ps.css`、`article-ui.css`、`profile.css`、`contact.css` | ✅ |
| 2 | 时钟移到 `meta row` 右侧（两页一致） | `ar-ps.css` `.ar-top` | ✅ |
| 3 | `✕ 打开` → `▶ 打开`；`✕ 打开文件夹` → `▶ 打开文件夹` | `articles/index.astro` | ✅ |
| 4 | 选中名不再压到动作行（直接删掉块外那层，名字交给标题） | `ar-ps.css`、`works-ps.css` + 两页 markup | ✅ |
| 5 | `/brief/` 底部状态条：删掉那个 `.au-status` | `brief.astro` | ✅ |
| 6 | `/articles/combat/` 提示语去掉未实现的 `J K`，并把 `ESC 返回` 真的实现 | `combat.astro` | ✅ |
| 7 | 移动端轨道改 `overflow-x:auto` + snap（JS 同步不再用 translateX） | `ar-ps.css`、`works-ps.css`、两页脚本 | ✅ |
| 8 | 主按钮尺寸统一 40px / 176px | `ar-ps.css` `.ar-play`、`works-ps.css` `.ws-play` | ✅ |

**验收**：1440 和 390 两档下，`/works/` 与 `/articles/` 的顶栏、时钟、标题、按钮、底栏位置逐像素对齐；无横向溢出。

### P1 —— 建 token 层，把颜色/字号/间距收进去（1–2 天）

1. 新建 `tokens.css`，落第 3.4 / 3.5 / 3.6 / 3.10 的变量。
2. 把 `ar-ps.css`、`works-ps.css`、`profile.css`、`contact.css` 里的裸值替换成 token（脚本可做：先列 234 个 hex → 归并到 20 个）。
3. `theme` 改成 `skin-paper` / `skin-screen` 两套，`Base.astro` 加 `skin` / `shell` 参数。
4. 删死代码（第 3.13.4 表）。
5. Zpix 字号全部落到 12/24/36/48（`/works/` 的 9px 编号、`/articles/` 的 10px 英文、`/brief/` 的 10/11px 都要改）。

**验收**：`grep -c '#[0-9a-f]\{3,6\}'` 在页面 CSS 里为 0；`grep -c '!important'` 为 0；CSS 总行数 ≤ 2,400。

### P2 —— 骨架收口，IA 合并（2–3 天）

1. 统一 nav（`作品 → /works/`、`文章 → /articles/`、`简介 → /brief/`、`联系 → /about/`），由 `consts.ts` 的 `NAV` 生成，首页菜单共用。
2. `/home/` 降级为兜底页：从 nav/菜单摘除，改成 `skin-paper` + `shell-doc`。
3. `/works/[id]/` 改 `skin-screen`；三个 articles 正文页补同一套 `shell-doc` 正文样式。
4. `shell-rail` 抽成一个组件（`src/components/Rail.astro`），`/works/` 与 `/articles/` 各自只提供数据和 `bar` 文案。
5. 标题位置统一到轨道下方（删死掉的 `order` 段，靠 DOM 顺序）；H1 改回页名。→ **标题位置已提前完成**（见第 6 节），H1 仍是选中项名，留给这一步。

**验收**：四个域各自的"列表 → 详情"走一遍，皮肤不跳、返回路径一致；H1 只有页名。

### P3 —— 视觉与可访问性复核（1 天）

1. 键盘全流程：`Tab` 能走到每个可点项，`Enter/Esc` 行为与提示一致。
2. `prefers-reduced-motion` 下无位移。
3. 320 / 390 / 768 / 1024 / 1440 / 1920 六档截图对比。
4. 对比度：`--t-3`（0.38 白）在 `#05060c` 上是 4.3:1，**用于正文不合格**（正文必须 `--t-2`）；用于 ≤12px 的元信息时也要提到 0.5 以上。

---

## 5. 验收清单（每改完一页勾一遍）

- [ ] 页面只属于一个皮肤（`skin-paper` 或 `skin-screen`），没有自己铺背景
- [ ] 骨架是 cover / rail / doc 之一，元素顺序与该骨架规定一致
- [ ] 有且只有一个 H1，H1 是页名
- [ ] 顶栏左边「返回」、右边「声音」，高度 64px，`min-height` 用 `var(--hdr-h)`
- [ ] 时钟/计数在 `meta row` 右侧
- [ ] 标题在轨道下方（rail）或正文顶部（doc）
- [ ] 主按钮 40px 高 / 176px 宽 / Zpix 12px / 图标是 `▶` 不是 `✕`
- [ ] 选中态只有一种表达（放大 + 白描边 + tone 发光）
- [ ] 悬停不改选中项
- [ ] 提示语只在 `bar` 左端出现一次，且键都真的实现了
- [ ] 移动端轨道可横向滚动，底栏不被裁
- [ ] 页面 CSS 里没有 `#hex`、没有 `rgba()`、没有 `!important`、没有重复 `--gutter` / `@font-face`
- [ ] Zpix 只出现在 12/24/36/48/96
- [ ] 中英文之间、中文与数字之间有空格

---

## 6. 执行记录

### 2026-11-02 第一轮：P0 + 标题位置（13 处改动）

| 改了什么 | 文件 |
| --- | --- |
| 新增 `--hdr-h: 64px`；`.site-header` 定高、`.header-inner` 垂直居中（不再靠 `padding-block` 撑） | `global.css` |
| 五个页面/样式里的 `100svh - 76px`、`- 64px` 全部换成 `var(--hdr-h)` | `ar-ps.css`、`works-ps.css`、`article-ui.css`、`profile.css`、`contact.css` |
| `.ar-top` 改 `justify-content:flex-end` + `.ar-back{margin-right:auto}` → 时钟固定贴右 | `ar-ps.css` |
| `✕ 打开` / `✕ 打开文件夹` → `▶`（含脚本里那句动态文案） | `articles/index.astro` |
| 删掉选中块外侧的名字（`.ar-inline` / `.ws-inline`，含 CSS + markup + 响应式残留） | `ar-ps.css`、`works-ps.css`、两页 |
| 主按钮统一 `min-width:176px; height:40px; padding:0 24px; font-size:12px` | `ar-ps.css`、`works-ps.css` |
| `•••` 圆钮统一 40×40 | `works-ps.css` |
| `/brief/` 删掉无样式的 `.au-status` | `brief.astro` |
| `ESC 返回` 真的实现（退回 `/articles/`，搜索框聚焦时不抢），并删掉没实现的 `J K 翻页` | `combat.astro` |
| 窄屏轨道改 `overflow-x:auto` + `scroll-snap`，脚本在 ≤900px 时不再 `translateX`（改用 `scrollIntoView`） | `ar-ps.css`、`works-ps.css`、两页脚本 |
| 窄屏底栏右侧域名标签隐藏，底栏不再被裁 | 两个 PS 样式 |
| **文章页标题移到轨道下方**（DOM 顺序 + `margin-top:auto`），和作品页同一处视线落点 | `articles/index.astro`、`ar-ps.css` |
| 删掉 `ar-ps.css` 末尾那段靠 `order` 硬掰的死代码 | `ar-ps.css` |

### 顺手修掉的两个坑（都是"以后一定会再踩"的类型）

1. **`is-swap` 会把大标题永久藏起来**。两个 PS 页的换字效果原来是
   `transition: opacity .16s` + `.is-swap{opacity:0}`，靠 130ms 后的 `setTimeout` 摘类。
   只要那个定时器没跑到（异常、后台标签、被打断），标题就永远停在 `opacity:0`。
   截图里复现了：`/works/` 的大标题整块消失。
   → 改成 `animation` + `both`：类名卡住时动画也会自己播完回到正常态。
2. **`querySelector('[data-en]')` 命中的是方块，不是标题**。方块自己带
   `data-en` / `data-note`，标题一挪到轨道后面，全局查询就先命中第一个方块，
   `textContent` 直接把方块的封面内容冲掉（截图里 01 号方块变成了三行文字）。
   → 标题元素改成在 `[data-head]` 里查。**这是"属性名当选择器用"的通用陷阱**，
   规则见 3.13：交互元素的选择器必须带容器前缀。
3. **"每次 select 都重播淡入"会让标题停在半透明**。首帧、`resize`、重新 `render`
   都会走一遍 `is-swap`，0.16s 的动画叠加起来看起来就是标题发灰。
   → 记住上次显示的 `key`（层级 + 序号 / 选中序号），只有真的换了才播。

### 验证

- `astro build` 14 页通过；`check-links` 156 个引用 0 失效；`check-isolation` 通过
- 截图复核（1440×900 / 390×844）：两页的顶栏高度、时钟位置、标题位置、按钮尺寸、底栏已对齐；
  手机端轨道可横向滑动
- 截图留在 `tmp/audit/`

> ⚠️ **测量方法上的一个坑（别再踩）**：无头 Edge 的窗口有最小宽度（实测
> `--window-size=390` 得到的视口是 **492×705**，截图只是被裁到 390 宽）。
> 所以早期 390 截图里"底栏文字被裁"是**裁切假象**，不是真 bug。
> 想看真实窄屏，用一个 390 宽的 iframe 包一层：`frame.html?u=/about/&w=390&h=844`，
> 媒体查询会按 iframe 的宽度算。真机 390 下 `/works/` 的底栏是完整的。

### 还没做（下一轮）

- H1 仍然是选中项名，不是页名（3.12.1）
- `/works/`、`/articles/`、`/about/` 中间那一大块空白（`flex:1` 撑出来的），要么给 hero 一个固定位置，要么放点真东西
- `•••` 按钮仍然没有行为（联系页已经删掉了）
- 颜色/字号 token（P1）、IA 合并（P2）

### 2026-11-02 第二轮：联系页按方案 02 落地

`/about/`（联系）从"绝对定位的名片"改成 **`shell-rail`**：四个通道横向轨道 + 标题压底 + 动作行 + 底栏，
和 `/works/`、`/articles/` 用同一个骨架。

| 改了什么 | 说明 |
| --- | --- |
| `src/pages/about.astro` 重写 | 四个通道 = 四个方块；`?c=wechat` 可直链到某个通道 |
| `src/styles/contact.css` 重写 | 旧的 `.ct-*`（`top: calc(22% + 78px)` 那套绝对定位）整段删除 |
| 配色收到中性灰阶 | **没有任何色相**：去掉了原先的 `--c` 分类色（红/橙/紫），选中态靠白描边 + 冷光 |
| 封面用纹理不用纯色 | 四块分别是斜纹 / 四点 / 网格 / 同心，都是"深灰渐变 + 白透明度纹理"，没有一块是纯色填充 |
| 通道动作 | 邮件=复制（含 `✓ 已复制` 反馈 + `直接发信` 兜底）、B 站/GitHub=新窗口打开、微信=就地露出二维码 |
| 页眉 | `hideNav`，左「← 返回」回 `/`，右声音钮（和两个索引页一致） |

**为什么选 02**：它和作品页、文章页是同一个骨架，从 `/works/` 点进来不会有第二套视觉语言；
四个通道也正好是四个方块。代价是信息密度低（要左右推才知道有四个），
所以标题区保留了完整的邮箱和一句说明，二维码在微信那格直接露出。

设计探索的四个版本留在 `mockups/`（`0-all.html` 是总览），**不参与构建**。

### 2026-11-02 第三轮：首页（`/`）页脚重排 + 删掉音量格子

问题：底部是**两行两套基线**——落款 `© 2026 黄晨睿 · … · B 站 horob` 在 `top:93%` 居中，
`音量 ▮▮▮▮ 50` 和 `Bilibili · horob / GitHub · hcr116 / 邮件` 在 `top:96%` 两端对齐。
落款里的「B 站 horob」和右边的「Bilibili · horob」还是同一件事写了两遍。

| 改了什么 | 说明 |
| --- | --- |
| 落款和联系方式合并成**一行** | `.tp-foot` 一个 `flex`，`justify-content:space-between` + `align-items:baseline`，左落款、右联系方式 |
| 落款文案去掉重复的「B 站 horob」 | 现在是 `© 2026 黄晨睿 · 动作游戏战斗策划`，B 站只在右边出现一次 |
| 字号/字距统一 | 12px / `letter-spacing:.14em` / 同一个 `--t` 灰阶（原来 11.5px 与 11px 两套） |
| 定位改用 `bottom` + 百分比内边距 | 原来 `top:93%` / `top:96%` 两个魔法数；现在一个 `bottom:3.2svh`，左右都是 `3.4%`，和上下对称 |
| **删掉音量格子**（`音量 ▮▮▮▮ 50`） | 音量本来就是拖那条主轴（地平线）调的，`← →` 也能调；页脚再放一排格子属于同一件事说两遍。同时删掉 `.tp-vol*` 样式和 `data-vol-bars` 的点击处理 |
| 层级提到 19 | 页脚原来 `z-index:11`，被压在暗角（18）/ 扫描线（17）下面，读起来是一团灰；现在和菜单同层 |
| 窄屏拆两行、左对齐 | ≤720 时 `flex-direction:column`，`padding:0 6%` |
| 顺手修窄屏菜单 | 菜单项原来会被压缩成「简 / 介」两行；现在 `flex:none` + `white-space:nowrap` + 容器换行取中 |

> 截图注意：页脚的 `opacity` 是 1s 淡入，无头浏览器在虚拟时间下会把它冻在 ≈0.02，
> 所以直接截图看不见页脚。要看排版得临时加 `.tp-foot{opacity:1!important;transition:none!important}`，
> 截完记得 `astro build` 覆盖回去。



---

## 附录 A：建议的 `tokens.css`（未接入，迁移时用）

```css
/* 字体 */
@font-face {
  font-family: 'Zpix';
  src: url('/fonts/zpix.woff2') format('woff2');
  font-display: swap;
}
@font-face {
  font-family: 'Bodoni Moda';
  src: url('/fonts/bodonimoda.woff2') format('woff2');
  font-display: swap;
  font-weight: 600;
}

:root {
  --font-display: 'Bodoni Moda', 'Songti SC', 'Noto Serif SC', Georgia, serif;
  --font-ui: 'Zpix', ui-monospace, monospace;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;

  --hdr-h: 64px;
  --wrap: 1080px;
  --read: 672px;
  --gutter: max(24px, calc(50% - 540px));
  --gap: 12px;

  --fs-cover: clamp(48px, 7vw, 96px);
  --fs-display: clamp(40px, 5.2vw, 76px);
  --fs-ui-lg: 36px;
  --fs-ui: 24px;
  --fs-ui-sm: 12px;
  --fs-lead: 16px;
  --fs-body: 15px;

  --r-0: 0;
  --r-1: 2px;
  --r-2: 6px;
  --r-pill: 999px;

  --ease-1: cubic-bezier(0.3, 0.9, 0.2, 1);
  --ease-2: cubic-bezier(0.4, 0.6, 0.2, 1);
  --t-fast: 0.16s;
  --t-mid: 0.24s;
  --t-rail: 0.36s;
  --t-glow: 0.5s;
}

.skin-paper {
  --s-0: #faf9f7; --s-1: #ffffff; --s-2: #f2efea;
  --t-1: #17171a; --t-2: #56565f; --t-3: #8b8b95;
  --l-1: #e5e2dc; --l-2: #d3cfc7;
  --a-white: #8a5a3b; --a-fill: #17171a;
}

.skin-screen {
  --s-0: #05060c; --s-1: #0b0c12; --s-2: #12141b;
  --t-1: #f2f0ea; --t-2: rgba(255,255,255,.62); --t-3: rgba(255,255,255,.38);
  --l-1: rgba(255,255,255,.12); --l-2: rgba(255,255,255,.38);
  --a-white: #e8ecf2; --a-fill: #f1f3f6;
  --glow: rgba(186,208,244,.16);
  --c-rust: #b3492f; --c-amber: #a8762c; --c-teal: #2f6f7d; --c-violet: #6a4a86; --c-slate: #3f5a75;
}
```

## 附录 B：class 迁移对照

| 现在 | 统一后 | 说明 |
| --- | --- | --- |
| `.ar-main` / `.ws-main` | `main.sh-main[data-shell="rail"]` | 骨架共用 |
| `.ar-shell` / `.ws-shell` | `.sh-shell` | 版心 |
| `.ar-rails` / `.ws-rail` | `.sh-rail` | 轨道容器 |
| `.ar-track` / `.ws-track` | `.sh-track` | 轨道 |
| `.ar-tile` / `.ws-tile` | `.sh-tile`（+ `is-on`） | 方块 |
| `.ar-head` / `.ws-hero` | `.sh-hero` | 标题区（统一放轨道下方） |
| `.ar-actions` / `.ws-actions` | `.sh-actions` | 动作行 |
| `.ar-play` / `.ws-play` | `.btn-primary` | 主按钮 |
| `.ar-more` / `.ws-more` | `.btn-icon`（暂删） | 更多 |
| `.ar-bar` / `.ws-bar` | `.sh-bar` | 底栏 |
| `.ar-back` / `.mode-toggle` | `.btn-text` | 返回 |
| `.ar-clock` / `.ws-clock` | `.sh-meta` | 时钟/计数（右侧） |
| `.ws-card` | 并入 `.sh-meta` | 进度卡 |
| `.au-status` / `.au-progress` | 删除 | 改 header 底边 3px 进度线 |
| `.article-tab` / `.rail-node` | `.sh-tab` / `.sh-node` | 阅读页左栏 |
| `.ct-list` / `.pf-row` | `.sh-row` | 通栏行（skin-screen 下统一） |

---

## 交付规矩：每次改完必须给带版本号的链接

改完不看构建时间就刷新，很容易看到旧副本（这个会话里已经踩过三次）。
所以每轮收尾固定两步：

```bash
node node_modules/astro/astro.js build
node scripts/links.mjs
```

`scripts/links.mjs` 会从 `dist/index.html` 的 `<meta name="dsh-build">` 读出构建时间，
拼出带 `?v=<时间戳>` 的链接。**带版本号的 URL 是永不撞车的缓存键**：文件没变，
但浏览器不能拿旧的那份。把打印出来的链接原样贴给用户。

排障时的版本核对：F12 搜 `dsh-build`，值应该和链接里的 `v` 对得上。

---

## 面包屑（2026-11-02）

层级一深（首页 → 作品 → AI 功能 → 某个项目），左上角只放一个「返回」就不够用了：
它只能回上一级，回不了任意一级。所以「返回」右边固定跟一条面包屑：

```
返回   首页 / 作品 / AI 功能 / 背诵卡片
```

规则：

- **由路径自动生成**，中文名查 `Base.astro` 里的 `CRUMB_LABELS`；新增分区加一行即可。
- **末段不是链接**（当前页），带 `aria-current="page"`。
- 动态页（项目/文章详情）用 `<Base crumbLast={...}>` 传真实标题，否则会露出 slug。
- 第一段永远是「首页」→ `/`。
- 窄屏（≤720px）只留「首页」和当前页，中间层级隐藏。
- 颜色跟皮肤走：纸壳用 `--ink-*`；深色壳在 `.mode-fun` 里另给一套（直接复用纸壳的
  `--ink-*` 会在黑底上看不见）。

---

## 状态色：只有「待导入」允许用红（2026-11-02）

全站的暖色禁令有一个例外：

```
.ws-pending  →  #ff5a52（红字 + 半透明下划线 + 微光）
```

它只出现在**作品页那行说明**里，表示这个方向还没有内容（`已导入 N 个` 的 N 为 0 时）。
除此之外，正文、按钮、边框、背景一律只走冷青—白这条线，不加红/橙/黄。

加这条的理由：0 这个数字读起来像「有，但为零」，而「待导入」是待办状态的提醒，
需要一眼看见。红色在这里是**状态**，不是装饰。