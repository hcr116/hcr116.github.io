# 内容保护：做了什么、能挡什么、挡不住什么

> 结论先说：**截图拦不住，扒代码也拦不住。**
> 这里做的是「让搬运有成本、让来源可追溯」，不是「让人拿不到」。

---

## 一、已经做的四件事

| # | 手段 | 在哪 | 挡什么 |
| --- | --- | --- | --- |
| 1 | **视频烧可见水印** | `public/video/vfx/*.mp4` 左下角 `hcr116.github.io` | 截图/录屏被转出去时，出处跟着走 |
| 2 | **不可见文字水印** | 每个页面的 `<body>` 里（零宽字符编码） | 整段文字被复制走时，来源藏在里面 |
| 3 | **媒体防护** | `global.css` | 拖拽存图、手机长按存图 |
| 4 | **版权声明** | `<meta name="copyright">` + `robots: noai` | 愿意遵守的爬虫 / 提高转载门槛 |

**没有做**：全站禁选中、禁右键、禁 F12。

原因：这些只挡不折腾的普通人（比如想复制你邮箱的招聘方），对真想扒的人零成本，还会伤无障碍和 SEO。

---

## 二、每条怎么用

### 1. 视频水印（已经烧进文件）

```bash
node scripts/vfx-watermark.mjs --dry   # 只看会处理哪些
node scripts/vfx-watermark.mjs         # 烧水印（会覆盖原文件）
```

- 字体：`C:/Windows/Fonts/consola.ttf`（可用 `FONT=...` 换）
- 样式：左下、`white@0.28`、字号 `w*0.017`、带一点黑阴影
- 副作用：会重新编码，实测反而变小了（3.9MB → 1.9MB）
- **原始文件**：跑之前的备份在 `tmp/vfx-original/`（不进仓库）

### 2. 不可见文字水印（读出来的方法）

页面里就有一段零宽字符，肉眼看是空的。有人把整段搬走后：

```bash
# 把他那段文字存成 txt，然后
node scripts/wm-check.mjs --file stolen.txt

# 或者直接贴在命令行
node scripts/wm-check.mjs "粘贴的正文……"
```

输出：

```
[wm] 水印内容：hcr116.github.io
[wm] 零宽字符数：128
```

**原理**：`hcr116.github.io` 转成字节，每个 bit 用 ZWSP(0) / ZWNJ(1) 表示，
前后用 WORD JOINER 包住，所以能在一大段文字里准确定位。

**局限**：只防"整段复制"。逐字重打、截图、或者粘贴到会过滤零宽字符的编辑器（少数）就没了。

### 3. 媒体防护（CSS）

```css
img, video, canvas, picture {
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
}
```

- 只管媒体，**正文照常能选中、邮箱照常能复制**
- 移动端额外去掉长按菜单（`-webkit-touch-callout: none`）
- 局限：右键「图片另存为」在某些浏览器仍可用；F12 里照样能拿到 URL

### 4. 版权声明

- `<meta name="copyright">`：`© 2026 黄晨睿 · hcr116.github.io · 未经许可请勿转载`
- `robots.txt` + `<meta name="robots">` 里的 `noai, noimageai`
- 仓库里的 `LICENSE`：代码可参考，文字/图片/视频保留所有权利

---

## 三、Cloudflare（想再进一步时做）

GitHub Pages 是纯静态托管，**改不了响应头**，所以防盗链、限流这些做不了。
要做得把域名挂到 Cloudflare（免费版够用）：

1. 在 Cloudflare 添加站点 `hcr116.github.io`（或用你自己的域名）
2. 按提示把 DNS 服务器改到 Cloudflare
3. 打开这几项：
   - **Hotlink Protection** —— 别的站直接引你的 mp4 会失败
   - **Bot Fight Mode** —— 挡一批批量抓取
   - **Security Level: Medium**
4. 可选：Rules 里给 `/video/*` 加一条「只允许本站 referer」

**代价**：DNS 挪走后，以后改解析要去 Cloudflare；GitHub Pages 的自定义域名需要在仓库里配 CNAME。

> 我的建议：**现在不做**。等你发现有站真的在盗链/盗搬，再上这一层。

---

## 四、真被搬了怎么办

1. 用 `wm-check.mjs` 证明来源（文字）／看视频水印（视频）
2. 平台投诉：B站/知乎/公众号都有「侵权投诉」入口，附上你的原始链接 + 水印证据
3. 一般到这一步对方就删了；真要起诉才需要公证，个人站不值当

---

## 五、一句话总结

**做的这些是"防盗门"，不是"保险箱"。**
真正能保护内容的，是持续产出 + 让人知道这是谁做的 —— 水印和日期戳干的就是这件事。
