# 作品归档 · 个人网站

一个纯静态的个人作品集站点。**不需要服务器、不需要数据库、不需要运维**，
构建产物是一堆 HTML 文件，传到任何静态托管平台就能用。

- 技术栈：Astro 5（内容用 Markdown 写，自动生成静态页）
- 页面：首页作品列表 / 作品详情 / 关于 / 404
- 支持：封面图、站内嵌视频（B 站、YouTube）、PDF 说明文档下载、深浅色自动切换、手机端自适应

---

## 一、本地预览

依赖已经装好了，直接跑：

```bash
pnpm dev
```

然后浏览器打开终端里提示的地址（默认 http://localhost:4321 ）。

要看成品的静态版本：

```bash
pnpm build      # 生成 dist/
pnpm preview    # 预览 dist/ 里构建出来的结果
```

> 用 npm 也行：`npm install` 然后 `npm run dev`。

---

## 二、目录结构

```
portfolio-site/
├─ src/
│  ├─ consts.ts              ← 你的名字、简介、联系方式、技能、经历（改这里最多）
│  ├─ content.config.ts      ← 作品的字段定义（一般不用动）
│  ├─ content/works/*.md     ← 每个作品一个 Markdown 文件
│  ├─ layouts/Base.astro     ← 页头页脚
│  ├─ pages/
│  │  ├─ index.astro         ← 首页（作品列表）
│  │  ├─ about.astro         ← 关于页
│  │  ├─ 404.astro
│  │  └─ works/[id].astro    ← 作品详情模板
│  └─ styles/global.css      ← 全站样式（改配色看文件开头的变量）
├─ public/
│  ├─ images/                ← 封面图、示意图
│  ├─ docs/                  ← PDF 说明文档
│  ├─ favicon.svg
│  └─ video-placeholder.html ← 视频占位页（换成真视频后可删）
├─ scripts/
│  ├─ check-links.mjs        ← 上线前自检：扫全站失效链接
│  └─ make-sample-pdf.mjs    ← 重新生成示例 PDF
└─ astro.config.mjs
```

---

## 三、把手上的内容填进去（5 件事）

### 1. 改个人信息

打开 `src/consts.ts`，改这几项：`name`、`tagline`（首屏大字）、`intro`、`email`、`links`、`location`。

同一个文件下面还有 `SKILLS`（技能分组）和 `TIMELINE`（经历时间线）。

**全部内容替换完之后**，把 `showPlaceholderNotice` 改成 `false`，首页那条「占位版本」提示就会消失。

### 2. 写作品

在 `src/content/works/` 下新建一个 `.md` 文件，**文件名就是网址**：
`05-my-project.md` → `/works/05-my-project/`

文件开头这一段是元信息（frontmatter），字段含义：

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 作品标题 |
| `summary` | 是 | 一句话说清解决了什么问题 / 做成了什么 |
| `year` | 是 | 写成字符串，如 `'2024.06'`（带引号） |
| `role` | 否 | 你的角色 |
| `tags` | 否 | 标签数组 |
| `cover` | 否 | 封面图路径，如 `/images/my-cover.jpg` |
| `coverAlt` | 否 | 封面图的文字说明（无障碍 / SEO） |
| `video` | 否 | 视频嵌入地址，见下节 |
| `docs` | 否 | 附件列表，见下节 |
| `order` | 否 | 排序用，数字越大越靠前，默认 0 |
| `draft` | 否 | 设 `true` 则不上线 |

`---` 分隔线下面是正文。推荐按「背景 → 我做了什么 → 结果 → 一点反思」四段写，
**结果要有数字，"一点反思"别省**——愿意讲哪里没做好的人更可信。

### 3. 换图片

把图片放进 `public/images/`，然后用 `/images/文件名` 引用（**注意开头的斜杠**）。

- 封面建议 16:10，宽 1600px 左右，存成 WebP 或压缩过的 JPG，单张控制在 200KB 内
- 正文里插图：`![图片说明](/images/xxx.jpg)`，下一行用 `*斜体*` 写图注

### 4. 放视频

**不要把视频文件直接放进网站**（体积大、加载慢、平台还限制单文件大小）。

正确做法是传到 B 站，然后取嵌入地址填进 `video`：

```yaml
video: //player.bilibili.com/player.html?bvid=BV1xxxxxxxxx&page=1&high_quality=1
```

YouTube 则是 `https://www.youtube.com/embed/视频ID`。留空或删掉这一行，视频区块就不显示。

当前示例作品里的 `video` 指向 `/video-placeholder.html`（一个占位页面），换成真地址即可。

### 5. 放说明文档

Word / PPT 浏览器里看不了，**先导出成 PDF**，放进 `public/docs/`，然后登记：

```yaml
docs:
  - label: 使用说明 v2.1
    href: /docs/usage-v2.1.pdf
```

`public/docs/sample-doc.pdf` 是示例文件，替换掉即可。

---

## 四、上线前自检

```bash
pnpm build
pnpm check
```

`pnpm check` 会扫描 `dist/` 里所有链接，告诉你有没有指错路径的图片、PDF 或网址。
输出「失效 0 个」就可以部署了。

---

## 五、部署到 EdgeOne Pages（免费、国内访问快）

站点构建后是纯静态文件，EdgeOne Pages 只负责把源码构建成网页再分发出去，仍然不需要服务器。

### 方式一：网页上传（本机没装 Git 也能用）

1. 在 GitHub 上新建一个仓库（公开或私有都行，空仓库不要勾 README）
2. 仓库页 → **Add file → Upload files**，把这些拖进去：
   `src/`、`public/`、`scripts/`、`package.json`、`pnpm-lock.yaml`、
   `astro.config.mjs`、`tsconfig.json`、`pnpm-workspace.yaml`、`.gitignore`、`README.md`
   **不要拖 `node_modules/` 和 `dist/`**（体积大且没必要，构建时会重新装）
3. 点 Commit changes
4. 登录腾讯云 EdgeOne Pages 控制台 → 新建项目 → 导入这个 GitHub 仓库
5. 构建设置：
   - 框架预设：选 **Astro**（没有就留自定义）
   - 构建命令：`npm run build`（平台若不会自动装依赖，就填 `npm install && npm run build`）
   - 输出目录：`dist`
   - Node 版本：**20** 或更高
6. 点部署，完成后拿到 `xxxx.edgeone.app` 域名，直接发人

以后改内容，在 GitHub 网页上重新上传改过的文件即可，平台会自动重新部署。

### 方式二：装 Git 后用命令行（推荐长期用）

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

之后每次改完 `git push`，EdgeOne 自动重新构建，不用再手动上传。

> 如果控制台提供「直接上传静态文件」的入口，也可以再省一层：只上传 `dist/` 目录，连仓库都不用建。

### 关于自定义域名

默认的 `xxx.edgeone.app` 二级域名够用，先上线再说。

想绑自己的域名（如 `yourname.com`）时：在控制台加自定义域名 → 按提示配置 DNS。
**注意：走中国大陆节点加速通常要求域名完成 ICP 备案**，没有备案的域名建议先继续用平台域名，或走境外节点（速度会慢一些）。

### 如果以后想换平台

`pnpm build` 出来的 `dist/` 是纯静态文件，可以直接搬到 Cloudflare Pages、Vercel、Netlify、
阿里云 OSS、腾讯云 COS 等任何静态托管上，**不需要改任何代码**。

---

## 六、几个容易踩的坑

1. **图片路径要写 `/images/xxx.jpg`**，开头的 `/` 不能省，否则详情页会加载不出来。
2. **`year` 加引号**：`year: '2024'`，不加引号某些情况下会被当成数字。
3. **PDF 别太大**：单个建议 5MB 内；几十页的手册可以拆分或压缩图片后再导出。
4. **别提交 `node_modules/` 和 `dist/`**：`.gitignore` 已经排除了。
5. **改完 `consts.ts` 记得重启 dev server**，偶尔会缓存旧值。

---

## 七、想改样子

- 配色、字号、间距：`src/styles/global.css` 文件开头的 `:root` 变量，深色模式在 `prefers-color-scheme: dark` 里
- 首屏文案结构：`src/pages/index.astro`
- 作品卡片布局：`global.css` 里的 `.work-grid` / `.work-card`

改之前建议先 `git commit` 一次，方便回退。
