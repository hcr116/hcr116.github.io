# AI 功能 · 项目页怎么加

> 面向自己看的一份操作说明。目录：`src/content/ai/`，路由：`/works/ai/` 和 `/works/ai/<slug>/`。

## 一、加一个新项目

在 `src/content/ai/` 新建一个 `.md`，文件名就是网址（小写、连字符）：

```
src/content/ai/my-tool.md  →  /works/ai/my-tool/
```

frontmatter：

```yaml
---
title: 项目名                 # 卡片和详情页标题
en: MY TOOL                   # 卡片上的英文小字，可留空
summary: 一句话说明            # 列表和详情页顶部都用，别超过 40 字
year: '2026.03'
state: 自用中                 # 自用中 / 已上线 / 实验中 / 搁置
stack: [Astro, Whisper]       # 技术标签
private: true                 # true 时详情页顶部挂「仅展示」提示条
video: ''                     # B 站嵌入地址，留空不显示视频块
order: 10                     # 数字越大越靠前
---
```

正文**必须用 `##` 分四节**，页面会拿这四个小标题自动生成右侧目录：

```md
## 介绍
这个工具解决什么问题、给谁用。

## 设计目的
当初为什么做它、砍掉了什么。

## 怎么做的
技术上的关键选择，两三段就够。

## 踩了什么坑
真踩过的坑，写具体现象 + 最后怎么解决。
```

> 长篇可以随便写，但**别用 `#` 一级标题**（页面已经有 h1 了），`###` 小标题只当段落语气，不进目录。

## 二、截图

**别直接把原图丢进 `public/`。** 用脚本压一遍：

```bash
node scripts/img.mjs D:/截图/one.png D:/截图/two.png --ratio 16:10 --width 1280
```

- 默认输出到 `public/images/ai/`，1600px 宽、JPEG 82
- `--width 1600` 只缩不放
- `--ratio 16:10` 居中裁成这个比例（截图有乱七八糟的窗口边缘时很有用）
- `--mask` 生成片段时自动带上 `blur: true`
- `--png` 保留 PNG（真的需要透明时）

脚本跑完会直接打印可以粘进 frontmatter 的片段：

```yaml
      shots:
          - src: '/images/ai/one.jpg'
            alt: ''
          - src: '/images/ai/two.jpg'
            alt: ''
            blur: true
```

`alt` 记得补一句话（读屏和搜索都靠它）。

## 三、隐私

- 截图里有真实姓名 / 公司 / 聊天记录的，**加 `blur: true`**：默认糊住，点一下才看清。
- 项目本身不公开的，就让 `private: true` 保持默认（挂"仅展示，不提供源码"提示条）。
- 涉及别人的信息（面试录音之类）**不要出现在截图里**，只截结构、截空状态。

## 四、检查

```bash
node node_modules/astro/astro.js build   # 构建
node scripts/links.mjs                   # 拿到带版本的预览链接
node scripts/check-links.mjs             # 站内引用有没有断
```

`/works/` 里「AI 功能」那个方块已经指向 `/works/ai/`，列表和详情会自动带上新加的项目，
不需要改代码。

## 五、未公开的条目（`locked: true`）

有些东西不想公开，但又要让人知道"这里有个东西"：

```yaml
locked: true
```

效果：

- 列表里显示成**跳动的乱码**（长度和真标题一样，但 DOM 里没有真字）
- 不生成详情页（`getStaticPaths` 直接排除，输网址也是 404）
- 点一下：乱码打字机删掉 → 打字机打出「权限不足」→ 同时**下方大标题**也变成「权限不足」
  → 停 420ms → 屏幕收成一条亮线 → 整块淡出消失
- **本轮之内不会再出现**：消失时把 slug 记进 `sessionStorage['hcr:locked:gone']`，
  返回、刷新、再进来都不会渲染它（列表页里那段内联脚本在解析时就把它抹掉，没有闪回）。
  关掉标签页/新开一个标签页才会恢复。

代码位置：`src/scripts/locked.ts`（乱码与消失动效）、`src/pages/works/ai/index.astro`（列表 + 大标题联动）。
### 真标题绝不进 HTML（2026-11-02 修订）

之前为了生成等长乱码，把真标题写进了 `data-base` —— 那等于把答案贴在门上。

现在的做法：

- 页面只输出 **`data-len`（字数）**，脚本按长度造乱码；
- 真标题只活在 `src/content/ai/*.md` 的 frontmatter 里（构建期用一下，不输出）；
- locked 条目不生成详情页，也不进 `<meta name="description">`；
- 页面上留一条 HTML 注释（`set:html` 强行输出，Astro 默认会剥注释）给翻源码的人：
  「为了防止数据安全，作品不会上传至网页，解包也看不到哦~」

**这不是安全防护**：真敏感的内容就别放进仓库、别部署。这套东西只是让站有层次、让访客不误入。

### 权限等级（纯叙事）

- 加载页自检第二行：`权限等级：4`（默认 4，访问 `?lv=10` 写进 localStorage 后一直显示 10）
- 它**不控制任何内容的可见性**——真东西根本不在产物里，所以改 level 也拿不到东西
- 换 level 只改这一行文字，用来跟"加锁条目"的叙事对上